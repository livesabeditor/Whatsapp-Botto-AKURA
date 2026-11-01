import { Schema, model } from 'mongoose'

const AuthKeySchema = new Schema(
    {
        ID: { type: String, required: true },
        type: { type: String, required: true },
        keyId: { type: String, required: true },
        value: { type: String, required: true }
    },
    { versionKey: false }
)

AuthKeySchema.index({ ID: 1, type: 1, keyId: 1 }, { unique: true })

export default model('baileys_auth_key', AuthKeySchema)
