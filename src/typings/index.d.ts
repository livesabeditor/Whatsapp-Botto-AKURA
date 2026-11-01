import type { GroupMetadata } from '@whiskeysockets/baileys'

export * from './message'
export * from './command'
export * from './mongo'

export interface IConfig {
    name: string
    mods?: string[]
    prefix: string
    session: string
}

export interface IParsedArgs {
    args: string[]
    flags: string[]
    joined: string
}

export type IExtendedGroupMetadata = Omit<GroupMetadata, 'participants'> & {
    participants: Array<GroupMetadata['participants'][number] & { jid: string }>
    admins?: string[]
}

export interface ISession {
    clientID: string
    serverToken: string
    clientToken: string
    encKey: string
    macKey: string
}

export interface IGroup {
    jid: string
    events: boolean
    nsfw: boolean
    safe: boolean
    mod: boolean
}

export interface IUser {
    jid: string
    ban: boolean
    warnings: number
    Xp: number
}

export interface IPackage {
    description: string
    dependencies: { [key: string]: string }
    homepage: string
    repository: {
        url: string
    }
}
