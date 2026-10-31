import { MessageType } from '../../lib/MessageTypes'
import { join } from 'path'
import MessageHandler from '../../Handlers/MessageHandler'
import BaseCommand from '../../lib/BaseCommand'
import WAClient from '../../lib/WAClient'
import { IPackage, ISimplifiedMessage } from '../../typings'

export default class Command extends BaseCommand {
    constructor(client: WAClient, handler: MessageHandler) {
        super(client, handler, {
            command: 'akura',
            description: 'Displays AKURA bot information',
            category: 'misc',
            usage: `${client.config.prefix}akura`,
            dm: true
        })
    }

    run = async (M: ISimplifiedMessage): Promise<void> => {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const pkg: IPackage = require(join(__dirname, '..', '..', '..', 'package.json'))
        const image = this.client.assets.get('akura')
        if (!image) return void null
        return void M.reply(
            image,
            MessageType.image,
            undefined,
            undefined,
            `🖤 *${process.env.NAME || 'AKURA'}* 🖤\n\n🍀 *Description: ${pkg.description}*\n\n🌐 *URL: ${
                pkg.homepage
            }*\n\n📂 *Repository: ${pkg.repository.url}*`
        )
    }
}
