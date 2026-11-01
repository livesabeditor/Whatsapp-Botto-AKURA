import type { WAMessage } from '@whiskeysockets/baileys'
import { MessageTypeValue, MimetypeValue } from '../lib/MessageTypes'
import { IExtendedGroupMetadata } from '.'

export interface ISimplifiedMessage {
    type: MessageTypeValue
    content: string | null
    args: string[]
    reply(
        content: string | Buffer,
        type?: MessageTypeValue,
        mime?: MimetypeValue,
        mention?: string[],
        caption?: string,
        thumbnail?: Buffer
    ): Promise<unknown>
    mentioned: string[]
    groupMetadata: IExtendedGroupMetadata | null
    chat: 'group' | 'dm'
    from: string
    sender: {
        jid: string
        username: string
        isAdmin: boolean
    }
    quoted?: {
        message?: WAMessage | null
        sender?: string | null
    } | null
    WAMessage: WAMessage
    urls: string[]
}
