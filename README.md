
# 🐺 REX Dashboard

A web dashboard for the REX Discord bot, featuring REX branding and a foundation for Discord OAuth2 authentication and server management.

## 🚀 Project Status

**Status:** Development — Cloudflare integration in progress.

The project currently contains the original Flask website starter and an initial Cloudflare Workers configuration. The full dashboard has not yet been migrated to the Cloudflare Workers runtime.

## ✨ Planned Features

- Discord OAuth2 login
- View Discord servers you own or can manage
- Server-specific dashboard and settings
- REX branding and responsive website styling
- Integration with the REX Discord bot
- Secure configuration and persistent settings storage

These features require implementation and testing before they can be considered production-ready.

## 🛠️ Technology

- Python
- Flask
- HTML and CSS
- Discord OAuth2 API
- Cloudflare Workers (Python)
- GitHub for source control

## 📁 Project Structure

```text
rex-dashboard/
├── app.py
├── requirements.txt
├── pyproject.toml
├── wrangler.jsonc
├── src/
│   └── worker.py
├── templates/
├── static/
├── .env.example
├── .gitignore
└── README.md
```

## ☁️ Cloudflare Deployment

The project is being prepared for Cloudflare Workers using Python support.

1. Push the project files to the connected GitHub repository.
2. Connect the repository to your Cloudflare Worker.
3. Configure the Python Worker entry point and dependencies.
4. Add required environment variables and secrets through Cloudflare.
5. Deploy and test the Worker using its `workers.dev` URL.
6. Complete and test the Flask application migration before connecting the production domain.

The current Worker entry point is a basic test scaffold. It does not yet provide the complete Discord dashboard.

## 🔐 Environment Variables

Configure credentials securely through Cloudflare's Variables and Secrets settings when the application is ready.

The final application will require values for items such as:

- Discord OAuth2 client ID
- Discord OAuth2 client secret
- Discord OAuth2 redirect URL
- Flask session secret

Use `.env.example` to document required variable names. Never commit real credentials, bot tokens, or secret keys to GitHub.

## 💾 Storage

The original Flask starter uses local JSON-file storage for settings. Before production deployment on Cloudflare Workers, this must be replaced with a suitable persistent storage service, such as Cloudflare KV or D1.

## 🧪 Testing

Before public release, test:

- Worker deployment and health endpoint
- Discord OAuth2 login and callback
- Server access permissions
- Settings persistence
- Session security
- Integration with the REX Discord bot

## 📜 License

No license has been selected yet. All rights and reuse permissions remain subject to the applicable rights holders until a license is added.
```

## What to do next

1. Open `README.md` in your GitHub repository.
2. Click the pencil icon to edit it.
3. Replace the existing content with the Markdown above.
4. Click **Commit changes**.

**Important:** This only updates the project documentation. It won't fix deployment by itself. The next technical step is to get the Python Worker running, then migrate the real Flask dashboard so its Discord login and settings work correctly.