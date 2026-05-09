# Mendadak Order Bot

Bot ini menerima lead dari website lalu mengirim notifikasi ke grup WhatsApp via Baileys.

## Setup VPS

1. Install Node.js 20+.
2. Masuk folder ini:

```bash
npm install
cp .env.example .env
```

3. Isi `.env`:

```text
PORT=4000
LEAD_WEBHOOK_SECRET=secret_yang_sama_dengan_vercel
WHATSAPP_GROUP_JID=120363xxxxxxxxxxxx@g.us
```

4. Start:

```bash
npm start
```

5. Scan QR dengan WhatsApp yang akan menjadi bot.
6. Setelah bot masuk grup orderan, ambil JID grup:

```bash
curl -H "x-lead-secret: secret_yang_sama_dengan_vercel" http://localhost:4000/groups
```

7. Set `WHATSAPP_GROUP_JID` di `.env`, restart bot.

## Vercel Env

Set di project website:

```text
LEAD_WEBHOOK_URL=https://domain-server-kamu.com/send-lead
LEAD_WEBHOOK_SECRET=secret_yang_sama_dengan_bot
ADMIN_WHATSAPP_NUMBER=6289697301342
```

Jika `LEAD_WEBHOOK_URL` belum diset, website otomatis fallback membuka WhatsApp admin.
