import { MessageType } from '../../lib/MessageTypes'
import MessageHandler from '../../Handlers/MessageHandler'
import BaseCommand from '../../lib/BaseCommand'
import WAClient from '../../lib/WAClient'
import { ISimplifiedMessage } from '../../typings'

export default class Command extends BaseCommand {
    constructor(client: WAClient, handler: MessageHandler) {
        super(client, handler, {
            command: 'retrieve',
            description: 'Retrieves quoted view-once media',
            adminOnly: true,
            category: 'misc',
            usage: `${client.config.prefix}retrieve`
        })
    }

    run = async (M: ISimplifiedMessage): Promise<void> => {
        const quotedMessage = M.quoted?.message
        if (!quotedMessage) return void (await M.reply('Please quote the message you want to retrieve'))

        const content = quotedMessage.message as Record<string, unknown> | undefined
        const wrapperNames = ['viewOnceMessage', 'viewOnceMessageV2', 'viewOnceMessageV2Extension']
        const media = wrapperNames
            .map((name) => (content?.[name] as { message?: Record<string, unknown> } | undefined)?.message)
            .find((message) => message && (message.imageMessage || message.videoMessage))
        if (!media) return void (await M.reply('Quote a view-once photo or video to retrieve it'))

        const type = media.videoMessage ? MessageType.video : MessageType.image
        const buffer = await this.client.downloadMediaMessage(quotedMessage)
        await M.reply(buffer, type, undefined, undefined, 'Here you go.')
    }
}
