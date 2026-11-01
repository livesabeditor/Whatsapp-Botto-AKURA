import express, { NextFunction, Request, Response } from 'express'
import { createHash, createHmac, timingSafeEqual } from 'crypto'
import { EventEmitter } from 'events'
import WAClient from './WAClient'
import { join } from 'path'

const SESSION_COOKIE = 'akura_pairing_session'
const SESSION_TTL_SECONDS = 60 * 60

export default class Server extends EventEmitter {
    app = express()

    constructor(public PORT: number, public client: WAClient) {
        super()
        this.app.disable('x-powered-by')
        this.app.use(express.json({ limit: '2kb' }))
        this.app.use((req, res, next) => {
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private')
            res.setHeader('Pragma', 'no-cache')
            res.setHeader('Referrer-Policy', 'no-referrer')
            res.setHeader('X-Content-Type-Options', 'nosniff')
            res.setHeader('X-Frame-Options', 'DENY')
            res.setHeader(
                'Content-Security-Policy',
                "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'"
            )
            next()
        })
        this.app.post('/api/login', this.login)
        this.app.post('/api/logout', this.logout)
        this.app.get('/api/status', this.requirePairingSession, this.status)
        this.app.use(express.static(join(__dirname, '..', '..', 'public'), { etag: false, maxAge: 0 }))
        this.app.listen(PORT, '127.0.0.1', () => this.client.log(`Server Started on loopback port ${PORT}`))
    }

    login = (req: Request, res: Response): void => {
        const password = process.env.QR_WEB_PASSWORD || ''
        const sessionSecret = process.env.QR_WEB_SESSION_SECRET || ''
        if (!password || !sessionSecret) {
            res.status(503).json({ error: 'Pairing page is not configured' })
            return
        }
        const submitted = typeof req.body?.password === 'string' ? req.body.password : ''
        const expectedHash = createHash('sha256').update(password).digest()
        const submittedHash = createHash('sha256').update(submitted).digest()
        if (!timingSafeEqual(expectedHash, submittedHash)) {
            res.status(401).json({ error: 'Invalid password' })
            return
        }
        const expires = Date.now() + SESSION_TTL_SECONDS * 1000
        const signature = createHmac('sha256', sessionSecret).update(`akura:${expires}`).digest('hex')
        res.setHeader(
            'Set-Cookie',
            `${SESSION_COOKIE}=${expires}.${signature}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${SESSION_TTL_SECONDS}`
        )
        res.json({ ok: true })
    }

    logout = (_req: Request, res: Response): void => {
        res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`)
        res.json({ ok: true })
    }

    requirePairingSession = (req: Request, res: Response, next: NextFunction): void => {
        const password = process.env.QR_WEB_PASSWORD || ''
        const sessionSecret = process.env.QR_WEB_SESSION_SECRET || ''
        const cookie = req.headers.cookie?.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${SESSION_COOKIE}=`))
        const token = cookie?.slice(SESSION_COOKIE.length + 1) || ''
        const [expiresText, receivedSignature] = token.split('.')
        const expires = Number(expiresText)
        if (!password || !sessionSecret || !Number.isSafeInteger(expires) || expires <= Date.now() || !receivedSignature) {
            res.status(401).json({ error: 'Authentication required' })
            return
        }
        const expectedSignature = createHmac('sha256', sessionSecret).update(`akura:${expires}`).digest()
        const suppliedSignature = Buffer.from(receivedSignature, 'hex')
        if (suppliedSignature.length !== expectedSignature.length || !timingSafeEqual(expectedSignature, suppliedSignature)) {
            res.status(401).json({ error: 'Authentication required' })
            return
        }
        next()
    }

    status = (_req: Request, res: Response): void => {
        const connected = this.client.state === 'open'
        const qrDataUrl = !connected && this.client.QR ? `data:image/png;base64,${this.client.QR.toString('base64')}` : null
        const status = connected ? 'connected' : qrDataUrl ? 'waiting' : this.client.state
        res.json({
            status,
            message: connected
                ? 'WhatsApp is linked'
                : qrDataUrl
                ? 'Ready to scan'
                : this.client.state === 'close'
                ? 'Connection stopped; saved auth was preserved. Owner action is required.'
                : 'Waiting for WhatsApp connection…',
            qrDataUrl
        })
    }
}
