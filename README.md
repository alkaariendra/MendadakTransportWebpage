# Mendadak Transport Webpage

Static landing page for Mendadak Transport.

## Local Preview

Open `index.html` directly in a browser, or run:

```bash
python -m http.server 5174
```

Then visit `http://127.0.0.1:5174/`.

## Lead Notifications

AI web sends completed lead summaries through the same Telegram Bot API used by Mendadak Ads Agent when these environment variables are set:

```env
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
```

`LEAD_WEBHOOK_URL` remains supported as a fallback. WhatsApp opens only if both automatic channels are unavailable.
