import { MessageType } from '../lib/MessageTypes'
import WAClient from '../lib/WAClient'

export default class CallHandler {
    constructor(public client: WAClient) {}

    rejectCall = async (caller: string, callID: string): Promise<void> => {
        await this.client.rejectCall(caller, callID)
        await this.client.sendMessage(caller, `I'm sorry. I'm not able to pick up calls.`, MessageType.text)
    }
}
