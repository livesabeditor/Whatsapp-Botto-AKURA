export const MessageType = {
    text: 'conversation',
    extendedText: 'extendedTextMessage',
    contact: 'contactMessage',
    contactsArray: 'contactsArrayMessage',
    groupInviteMessage: 'groupInviteMessage',
    location: 'locationMessage',
    liveLocation: 'liveLocationMessage',
    image: 'imageMessage',
    video: 'videoMessage',
    sticker: 'stickerMessage',
    document: 'documentMessage',
    audio: 'audioMessage',
    product: 'productMessage'
} as const

export type MessageTypeValue = (typeof MessageType)[keyof typeof MessageType] | string

export const Mimetype = {
    jpeg: 'image/jpeg',
    png: 'image/png',
    mp4: 'video/mp4',
    gif: 'video/gif',
    pdf: 'application/pdf',
    ogg: 'audio/ogg; codecs=opus',
    mp4Audio: 'audio/mp4',
    webp: 'image/webp'
} as const

export type MimetypeValue = (typeof Mimetype)[keyof typeof Mimetype]
