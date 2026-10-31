<div align="center">
# **WhatsApp-Botto-AKURA**
## [![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/) [![NodeJs](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/en/)

> A modular WhatsApp bot built with TypeScript.

</div><br/>

## Highlights

- Modular, object-oriented TypeScript codebase.
- WhatsApp connection through Baileys.
- `.flow` and `.support` show the same four AKURA group links.
- Set the owner privately with the `OWNER_NUMBER` environment variable; use international digits without `+`.

## Setup

1. Install the dependencies with `npm install`.
2. Copy `.env.example` to `.env` and fill in `MONGO_URI`, your private `OWNER_NUMBER`, `QR_WEB_PASSWORD`, and a random `QR_WEB_SESSION_SECRET`.
3. Keep `.env` out of version control. Do not put the pairing-page password, owner phone number, or relay token in public source.
4. Run `npm run build`, then `npm start`.

The bot's QR relay is optional. To use it, set `QR_RELAY_URL` and `QR_RELAY_TOKEN` in the bot's private runtime environment to the values for the protected pairing site.

## Features

See [Features.md](https://github.com/livesabeditor/Whatsapp-Botto-AKURA/blob/main/Features.md) for the command list.

## Contributing

Open an issue for bugs or feature requests. Run `npm run lint` and `npm run build` before opening a pull request.

## Community

The bot commands `.flow` and `.support` list the four AKURA WhatsApp communities configured in the source.

## License

GPL-3.0. See [LICENSE](LICENSE).
