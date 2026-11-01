import { EventEmitter } from 'events'
import chalk from 'chalk'
import qrImage from 'qr-image'
import moment from 'moment'
import pino from 'pino'
import type { Contact, GroupMetadata, WAMessage, WASocket } from '@whiskeysockets/baileys'
import { IConfig, IExtendedGroupMetadata, IGroupModel, ISimplifiedMessage, IUserModel } from '../typings'
import Utils from './Utils'
import DatabaseHandler from '../Handlers/DatabaseHandler'
import MongoAuthState from './MongoAuthState'
import { MessageType, MessageTypeValue, Mimetype, MimetypeValue } from './MessageTypes'

type BaileysModule = typeof import('@whiskeysockets/baileys')
type LegacyContact = Partial<Contact> & { id: string; jid: string; vname?: string }
type LegacyCall = { from: string; id: string }
type SendOptions = {
    quoted?: WAMessage
    caption?: string
    mimetype?: string
    contextInfo?: Record<string, unknown>
    thumbnail?: Buffer
    gifPlayback?: boolean
}

const importBaileys = new Function('return import("@whiskeysockets/baileys")') as () => Promise<BaileysModule>
const DEFAULT_PROFILE_PICTURE = 'https://upload.wikimedia.org/wikipedia/commons/a/ac/Default_pfp.jpg'

export default class WAClient extends EventEmitter {
    assets = new Map<string, Buffer>()
    DB = new DatabaseHandler()
    QR: Buffer | null = null
    state: 'connecting' | 'open' | 'close' = 'connecting'
    private socket?: WASocket
    private baileys?: BaileysModule
    private authStore?: MongoAuthState
    private started = false
    private reconnectScheduled = false
    private readonly chatJids = new Set<string>()

    contacts: Record<string, LegacyContact> = new Proxy<Record<string, LegacyContact>>(
        {},
        {
            get: (target, key) => {
                if (typeof key !== 'string') return Reflect.get(target, key)
                return Reflect.get(target, key) || this.placeholderContact(key)
            },
            set: (target, key, value) => Reflect.set(target, key, value)
        }
    )

    constructor(public config: IConfig) {
        super()
    }

    get user(): LegacyContact {
        const account = this.socket?.user
        if (!account) return { id: '', jid: '', notify: '', name: '' }
        const jid = account.id || account.jid || ''
        return { ...account, id: account.id || jid, jid, vname: account.verifiedName }
    }

    connect = async (): Promise<void> => {
        if (this.started) return
        this.started = true
        this.baileys = await importBaileys()
        this.authStore = await MongoAuthState.create(
            this.config.session,
            this.baileys.initAuthCreds,
            this.baileys.BufferJSON
        )
        if (this.authStore.legacySessionDetected)
            this.log('A legacy session was found and preserved; this client needs its own WhatsApp pairing.', true)
        await this.authStore.saveCreds()
        await this.openSocket()
    }

    private openSocket = async (): Promise<void> => {
        if (!this.baileys || !this.authStore) throw new Error('WhatsApp auth state is unavailable')
        const socket = this.baileys.default({
            auth: this.authStore.state,
            browser: ['AKURA', 'Chrome', '1.0.0'],
            logger: pino({ level: 'silent' }) as any
        })
        this.socket = socket
        this.state = 'connecting'

        socket.ev.on('connection.update', async (update) => {
            if (update.qr) {
                this.QR = qrImage.imageSync(update.qr)
                this.log(`WhatsApp QR is ready | Authenticate at the protected AKURA pairing page on port ${process.env.PORT || 4040}`)
            }
            if (update.connection === 'open') {
                this.state = 'open'
                this.QR = null
                this.reconnectScheduled = false
                this.emit('open')
            }
            if (update.connection === 'close') {
                this.state = 'close'
                this.QR = null
                const statusCode = (update.lastDisconnect?.error as any)?.output?.statusCode
                const loggedOut = statusCode === this.baileys?.DisconnectReason.loggedOut
                if (loggedOut) {
                    this.log('WhatsApp reports this session is logged out. Saved auth is preserved; owner action is required.', true)
                    return
                }
                this.log('WhatsApp connection closed; reconnecting.', true)
                this.scheduleReconnect()
            }
        })

        socket.ev.on('creds.update', async () => {
            try {
                await this.authStore?.saveCreds()
            } catch {
                this.log('WhatsApp credentials could not be saved to the private database.', true)
            }
        })

        socket.ev.on('messages.upsert', ({ messages, type }) => {
            if (type !== 'notify') return
            for (const message of messages) {
                const jid = message.key.remoteJid
                if (jid) this.chatJids.add(jid)
                if (!message.key.fromMe) void this.emitNewMessage(message)
            }
        })

        socket.ev.on('group-participants.update', (event) => {
            this.emit('group-participants-update', {
                jid: event.id,
                participants: event.participants,
                actor: event.author || undefined,
                action: event.action
            })
        })

        socket.ev.on('call', (calls) => {
            for (const call of calls) {
                if (call.status === 'offer') this.emit('call', { from: call.from, id: call.id } as LegacyCall)
            }
        })

        socket.ev.on('contacts.upsert', (items) => items.forEach((contact) => this.storeContact(contact)))
        socket.ev.on('contacts.update', (items) => {
            for (const item of items) {
                if (item.id) this.storeContact({ ...this.contacts[item.id], ...item, id: item.id } as Contact)
            }
        })
        socket.ev.on('messaging-history.set', ({ chats, contacts }) => {
            chats.forEach((chat) => chat.id && this.chatJids.add(chat.id))
            contacts.forEach((contact) => this.storeContact(contact))
        })
        socket.ev.on('chats.upsert', (chats) => chats.forEach((chat) => chat.id && this.chatJids.add(chat.id)))
    }

    private scheduleReconnect = (): void => {
        if (this.reconnectScheduled) return
        this.reconnectScheduled = true
        const timer = setTimeout(() => {
            this.reconnectScheduled = false
            void this.openSocket().catch(() => this.scheduleReconnect())
        }, 3000)
        timer.unref?.()
    }

    private storeContact = (contact: Contact): void => {
        const jid = contact.jid || contact.id
        const normalized: LegacyContact = { ...contact, jid, vname: contact.verifiedName }
        for (const id of [contact.id, contact.jid, contact.lid]) if (id) this.contacts[id] = normalized
    }

    private placeholderContact = (jid: string): LegacyContact => {
        const username = jid.split('@')[0]
        return { id: jid, jid, notify: username, name: username }
    }

    emitNewMessage = async (message: WAMessage): Promise<void> => {
        this.emit('new-message', await this.simplifyMessage(message))
    }

    supportedMediaMessages: string[] = [MessageType.image, MessageType.video]

    simplifyMessage = async (message: WAMessage): Promise<ISimplifiedMessage> => {
        const normalized = this.baileys?.normalizeMessageContent(message.message) || message.message || {}
        message.message = normalized
        const jid = message.key.remoteJid || ''
        const chat = jid.endsWith('@g.us') ? 'group' : 'dm'
        const senderJid = chat === 'group' ? message.key.participant || jid : jid
        const type = (Object.keys(normalized)[0] || '') as MessageTypeValue
        const groupMetadata = chat === 'group' ? await this.groupMetadata(jid).catch(() => null) : null
        const contact = this.getContact(senderJid)
        const sender = {
            jid: senderJid,
            username: contact.notify || contact.vname || contact.name || 'User',
            isAdmin: Boolean(groupMetadata?.admins?.includes(senderJid))
        }
        const typedMessage = normalized as Record<string, any>
        const content: string | null =
            type === MessageType.text
                ? typedMessage.conversation || null
                : type === MessageType.extendedText
                ? typedMessage.extendedTextMessage?.text || null
                : this.supportedMediaMessages.includes(type)
                ? typedMessage[type]?.caption || ''
                : null
        const contextInfo = typedMessage[type]?.contextInfo
        const quotedContent = contextInfo?.quotedMessage
        const quoted: ISimplifiedMessage['quoted'] = quotedContent
            ? {
                  message: {
                      key: {
                          remoteJid: jid,
                          participant: contextInfo.participant || undefined,
                          fromMe: contextInfo.participant === this.user.jid,
                          id: contextInfo.stanzaId || ''
                      },
                      message: this.baileys?.normalizeMessageContent(quotedContent) || quotedContent
                  } as WAMessage,
                  sender: contextInfo.participant || (contextInfo.participant === this.user.jid ? this.user.jid : null)
              }
            : { message: null, sender: contextInfo?.participant || null }
        const mentions = (contextInfo?.mentionedJid || []).filter((value: unknown): value is string => typeof value === 'string')
        return {
            type,
            content,
            chat,
            sender,
            quoted,
            args: content?.split(' ') || [],
            reply: async (
                replyContent: string | Buffer,
                replyType?: MessageTypeValue,
                mime?: MimetypeValue,
                mention?: string[],
                caption?: string,
                thumbnail?: Buffer
            ) => {
                await this.sendMessage(jid, replyContent, replyType || MessageType.text, {
                    quoted: message,
                    caption,
                    mimetype: mime,
                    contextInfo: mention ? { mentionedJid: mention } : undefined,
                    thumbnail
                })
            },
            mentioned: mentions,
            from: jid,
            groupMetadata,
            WAMessage: message,
            urls: this.util.getUrls(content || '')
        }
    }

    sendMessage = async (
        jid: string,
        content: string | Buffer,
        type: MessageTypeValue = MessageType.text,
        options: SendOptions = {}
    ): Promise<unknown> => {
        if (!this.socket) throw new Error('WhatsApp socket is not connected')
        const messageOptions: Record<string, unknown> = {}
        if (options.quoted) messageOptions.quoted = options.quoted
        const contextInfo = options.contextInfo
        let payload: Record<string, unknown>
        const value = typeof content === 'string' ? content : content
        if (type === MessageType.image) {
            payload = { image: value, caption: options.caption, mimetype: options.mimetype, contextInfo }
            if (options.thumbnail) payload.jpegThumbnail = options.thumbnail.toString('base64')
        } else if (type === MessageType.video) {
            payload = {
                video: value,
                caption: options.caption,
                mimetype: options.mimetype,
                gifPlayback: options.gifPlayback || options.mimetype === Mimetype.gif,
                contextInfo
            }
        } else if (type === MessageType.audio) {
            payload = { audio: value, mimetype: options.mimetype, contextInfo }
        } else if (type === MessageType.sticker) {
            payload = { sticker: value }
        } else if (type === MessageType.document) {
            payload = { document: value, mimetype: options.mimetype || 'application/octet-stream', caption: options.caption, contextInfo }
        } else {
            payload = { text: typeof content === 'string' ? content : content.toString('utf8'), contextInfo }
        }
        return this.socket.sendMessage(jid, payload as any, messageOptions as any)
    }

    downloadMediaMessage = async (message: WAMessage): Promise<Buffer> => {
        if (!this.baileys) this.baileys = await importBaileys()
        return (await this.baileys.downloadMediaMessage(message, 'buffer', {})) as Buffer
    }

    getProfilePicture = async (jid: string): Promise<string> => {
        if (!this.socket) throw new Error('WhatsApp socket is not connected')
        return (await this.socket.profilePictureUrl(jid, 'image').catch(() => undefined)) || DEFAULT_PROFILE_PICTURE
    }

    getStatus = async (jid: string): Promise<{ status?: string }> => {
        if (!this.socket) return {}
        const result = await this.socket.fetchStatus(jid).catch(() => undefined)
        return (result?.[0] || {}) as { status?: string }
    }

    groupMetadata = async (jid: string): Promise<IExtendedGroupMetadata> => {
        if (!this.socket) throw new Error('WhatsApp socket is not connected')
        const metadata: GroupMetadata = await this.socket.groupMetadata(jid)
        const participants = metadata.participants.map((participant) => ({
            ...participant,
            jid: participant.id,
            isAdmin: participant.isAdmin || participant.admin === 'admin' || participant.admin === 'superadmin'
        }))
        return {
            ...metadata,
            participants,
            admins: participants.filter((participant) => participant.isAdmin).map((participant) => participant.jid)
        }
    }

    fetchGroupMetadataFromWA = (jid: string): Promise<IExtendedGroupMetadata> => this.groupMetadata(jid)

    groupInviteCode = async (jid: string): Promise<string | undefined> => this.requireSocket().groupInviteCode(jid)

    groupRemove = async (jid: string, participants: string[]): Promise<unknown> =>
        this.requireSocket().groupParticipantsUpdate(jid, participants, 'remove')

    groupMakeAdmin = async (jid: string, participants: string[]): Promise<unknown> =>
        this.requireSocket().groupParticipantsUpdate(jid, participants, 'promote')

    groupDemoteAdmin = async (jid: string, participants: string[]): Promise<unknown> =>
        this.requireSocket().groupParticipantsUpdate(jid, participants, 'demote')

    groupLeave = async (jid: string): Promise<void> => this.requireSocket().groupLeave(jid)

    deleteMessage = async (jid: string, key: WAMessage['key']): Promise<unknown> =>
        this.requireSocket().sendMessage(jid, { delete: key })

    rejectCall = async (caller: string, callID: string): Promise<void> => this.requireSocket().rejectCall(callID, caller)

    private requireSocket = (): WASocket => {
        if (!this.socket) throw new Error('WhatsApp socket is not connected')
        return this.socket
    }

    getContact = (jid: string): LegacyContact => this.contacts[jid] || this.placeholderContact(jid)

    log = (text: string, error?: boolean): void => {
        console.log(
            chalk[error ? 'red' : 'green']('[AKURA]'),
            chalk.blue(moment(Date.now() * 1000).format('DD/MM HH:mm:ss')),
            chalk.yellowBright(text)
        )
    }

    getUser = async (jid: string): Promise<IUserModel> => {
        let user = await this.DB.user.findOne({ jid })
        if (!user) user = await new this.DB.user({ jid }).save()
        return user
    }

    banUser = async (jid: string): Promise<void> => {
        const result = await this.DB.user.updateOne({ jid }, { $set: { ban: true } })
        if (!result.nModified) await new this.DB.user({ jid, ban: true }).save()
    }

    unbanUser = async (jid: string): Promise<void> => {
        const result = await this.DB.user.updateOne({ jid }, { $set: { ban: false } })
        if (!result.nModified) await new this.DB.user({ jid, ban: false }).save()
    }

    setXp = async (jid: string, min: number, max: number): Promise<void> => {
        const Xp = Math.floor(Math.random() * max) + min
        const result = await this.DB.user.updateOne({ jid }, { $inc: { Xp } })
        if (!result.nModified) await new this.DB.user({ jid, Xp }).save()
    }

    modifyAllChats = async (
        action: 'archive' | 'unarchive' | 'pin' | 'unpin' | 'mute' | 'unmute' | 'delete' | 'clear'
    ): Promise<{ status: 200 | 500 }> => {
        if (action === 'clear') {
            this.log('Bulk chat clearing was not run: the new API requires explicit message-range data.', true)
            return { status: 500 }
        }
        return { status: 500 }
    }

    util = new Utils()

    getGroupData = async (jid: string): Promise<IGroupModel> =>
        (await this.DB.group.findOne({ jid })) || (await new this.DB.group({ jid }).save())
}

export enum toggleableGroupActions {
    events = 'events',
    NSFW = 'nsfw',
    safe = 'safe',
    mod = 'mod'
}
