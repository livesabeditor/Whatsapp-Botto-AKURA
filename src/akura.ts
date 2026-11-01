import { config } from 'dotenv'

config()

import MessageHandler from './Handlers/MessageHandler'
import WAClient from './lib/WAClient'
import Server from './lib/Server'
import mongoose from 'mongoose'
import chalk from 'chalk'
import CallHandler from './Handlers/CallHandler'
import AssetHandler from './Handlers/AssetHandler'
import EventHandler from './Handlers/EventHandler'

if (!process.env.MONGO_URI) throw new Error('MONGO URL IS NOT PROVIDED')
const configuredNumbers = [...(process.env.OWNER_NUMBER || '').split(','), ...(process.env.MODS || '').split(',')]
const mods = [...new Set(configuredNumbers.map((number) => number.replace(/\D/g, '')).filter(Boolean))].map(
    (number) => `${number}@s.whatsapp.net`
)
const client = new WAClient({
    name: process.env.NAME || 'AKURA',
    session: process.env.SESSION || 'AKURA',
    prefix: process.env.PREFIX || '.',
    mods
})
client.log('Starting...')

const messageHandler = new MessageHandler(client)
const callHandler = new CallHandler(client)
const assetHandler = new AssetHandler(client)
const eventHandler = new EventHandler(client)
messageHandler.loadCommands()
assetHandler.loadAssets()

const db = mongoose.connection

new Server(Number(process.env.PORT) || 4040, client)

const start = async () => {
    client.once('open', async () => {
        const account = client.user
        client.log(
            chalk.green(
                `Connected to WhatsApp as ${chalk.blueBright(
                    account.notify || account.vname || account.name || account.jid.split('@')[0]
                )}`
            )
        )
        if (process.env.CRON)
            client.log('Configured bulk chat-clearing schedule was not started; safe message-range behavior is not yet verified.', true)
    })

    client.on('call', async (call: { from: string; id: string }) => {
        const number = call.from
        client.log(`${chalk.blue('CALL')} From ${client.getContact(number).notify || number}`)
        await callHandler.rejectCall(number, call.id)
    })

    client.on('new-message', messageHandler.handleMessage)
    client.on('group-participants-update', eventHandler.handle)
    await client.connect()
}

mongoose.connect(encodeURI(process.env.MONGO_URI), {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useCreateIndex: true
})

db.once('open', () => {
    client.log(chalk.green('Connected to Database!'))
    void start()
})
