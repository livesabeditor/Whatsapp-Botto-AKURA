import type {
    AuthenticationCreds,
    AuthenticationState,
    SignalDataTypeMap,
    SignalKeyStore
} from '@whiskeysockets/baileys'
import AuthKeyModel from './Mongo/Models/AuthKey'
import SessionModel from './Mongo/Models/Session'

export interface BufferJSONHelpers {
    replacer: (key: string, value: unknown) => unknown
    reviver: (key: string, value: unknown) => unknown
}

export default class MongoAuthState {
    private writeQueue: Promise<unknown> = Promise.resolve()
    readonly state: AuthenticationState
    readonly legacySessionDetected: boolean

    private constructor(
        private readonly id: string,
        creds: AuthenticationCreds,
        private readonly initAuthCreds: () => AuthenticationCreds,
        private readonly bufferJSON: BufferJSONHelpers,
        legacySessionDetected: boolean
    ) {
        this.legacySessionDetected = legacySessionDetected
        const keys: SignalKeyStore = {
            get: this.getKeys,
            set: this.setKeys,
            clear: this.clearKeys
        }
        this.state = { creds, keys }
    }

    static create = async (
        id: string,
        initAuthCreds: () => AuthenticationCreds,
        bufferJSON: BufferJSONHelpers
    ): Promise<MongoAuthState> => {
        const existing = await SessionModel.findOne({ ID: id }).exec()
        const savedCreds = existing?.get('baileysCreds') as unknown
        const creds = savedCreds
            ? (JSON.parse(
                  typeof savedCreds === 'string' ? savedCreds : JSON.stringify(savedCreds),
                  bufferJSON.reviver
              ) as AuthenticationCreds)
            : initAuthCreds()
        return new MongoAuthState(id, creds, initAuthCreds, bufferJSON, Boolean(existing?.session && !savedCreds))
    }

    saveCreds = async (): Promise<void> => {
        await this.enqueue(async () => {
            const serialized = JSON.stringify(this.state.creds, this.bufferJSON.replacer)
            if (!serialized) throw new Error('Could not serialize WhatsApp credentials')
            await SessionModel.updateOne(
                { ID: this.id },
                { $set: { baileysCreds: JSON.parse(serialized) } },
                { upsert: true }
            ).exec()
        })
    }

    reset = async (): Promise<void> =>
        this.enqueue(async () => {
            await AuthKeyModel.deleteMany({ ID: this.id }).exec()
            const freshCreds = this.initAuthCreds()
            const serialized = JSON.stringify(freshCreds, this.bufferJSON.replacer)
            if (!serialized) throw new Error('Could not serialize fresh WhatsApp credentials')
            await SessionModel.updateOne(
                { ID: this.id },
                { $set: { baileysCreds: JSON.parse(serialized) } },
                { upsert: true }
            ).exec()
            this.state.creds = freshCreds
        })

    private getKeys = async <T extends keyof SignalDataTypeMap>(
        type: T,
        ids: string[]
    ): Promise<{ [id: string]: SignalDataTypeMap[T] }> => {
        if (!ids.length) return {}
        const records = await AuthKeyModel.find(
            { ID: this.id, type, keyId: { $in: ids } },
            { keyId: 1, value: 1 }
        )
            .lean()
            .exec()
        const result: { [id: string]: SignalDataTypeMap[T] } = {}
        for (const record of records) {
            result[record.keyId] = JSON.parse(record.value, this.bufferJSON.reviver) as SignalDataTypeMap[T]
        }
        return result
    }

    private setKeys = async (data: Parameters<SignalKeyStore['set']>[0]): Promise<void> =>
        this.enqueue(async () => {
            const operations: any[] = []
            for (const [type, entries] of Object.entries(data as Record<string, Record<string, unknown | null>>)) {
                if (!entries) continue
                for (const [keyId, value] of Object.entries(entries)) {
                    const filter = { ID: this.id, type, keyId }
                    if (value === null) {
                        operations.push({ deleteOne: { filter } })
                    } else {
                        operations.push({
                            updateOne: {
                                filter,
                                update: { $set: { value: JSON.stringify(value, this.bufferJSON.replacer) } },
                                upsert: true
                            }
                        })
                    }
                }
            }
            if (operations.length) await AuthKeyModel.bulkWrite(operations, { ordered: true })
        })

    private clearKeys = async (): Promise<void> =>
        this.enqueue(async () => {
            await AuthKeyModel.deleteMany({ ID: this.id }).exec()
        })

    private enqueue = <T>(task: () => Promise<T>): Promise<T> => {
        const current = this.writeQueue.then(task, task)
        this.writeQueue = current.then(
            () => undefined,
            () => undefined
        )
        return current
    }
}
