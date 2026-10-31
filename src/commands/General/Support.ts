import MessageHandler from '../../Handlers/MessageHandler'
import BaseCommand from '../../lib/BaseCommand'
import { formatAkuraGroupLinks } from '../../lib/AkuraLinks'
import WAClient from '../../lib/WAClient'
import { ISimplifiedMessage } from '../../typings'

export default class Command extends BaseCommand {
    constructor(client: WAClient, handler: MessageHandler) {
        super(client, handler, {
            command: 'support',
            description: 'Shows the AKURA support groups',
            category: 'general',
            usage: `${client.config.prefix}support`,
            dm: true
        })
    }

    run = async (M: ISimplifiedMessage): Promise<void> => {
        await M.reply(formatAkuraGroupLinks())
    }
}
