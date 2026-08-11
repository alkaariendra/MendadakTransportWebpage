# 📋 BRIEF CREDENTIAL & PANDUAN AKSES SISTEM MENDADAK TRANSPORT
*Dokumentasi Resmi Operasional, Credential Database, Telegram Bot, & Backup Data*

---

## 🌐 1. Akses Web & Domain Utama

| Nama Layanan | URL / Link Akses | Fungsi & Keterangan |
| :--- | :--- | :--- |
| **Main Website** | [mendadaktransport.com](https://www.mendadaktransport.com/) | Website utama rental & katalog armada (tersinkronkan status unit real-time) |
| **Workspace Aplikasi Rekap** | [rekap.mendadaktransport.my.id/rekap](https://rekap.mendadaktransport.my.id/rekap) | Web App Rekap Kontrak, Sewa Harian, Buku Kas, Invoice, & List Armada |
| **GitHub Repository** | [github.com/alkaariendra/MendadakTransportWebpage](https://github.com/alkaariendra/MendadakTransportWebpage) | Repository source code proyek |
| **Direktori Lokal** | `D:\SCRIPT\YapAutoBot-NTE-main\Web Nopal Bedel` | Folder source code proyek di komputer lokal |

---

## 👤 2. Identitas Admin & Rekening Resmi

- **Nama Admin / Pemilik**: **`MUHAMMAD NAUFAL ALFAREZ`**
- **Rekening Resmi Pembayaran**:
  - 🏦 **Bank BCA**: `0562196852` a.n. **MUHAMMAD NAUFAL ALFAREZ**
  - 💳 **Bank Mandiri**: `1610016112422` a.n. **MUHAMMAD NAUFAL ALFAREZ**
- **Tanda Tangan Official (PNG)**:  
  File `assets/ttd-mendadak.png` (otomatis terpasang pada cetakan Web Invoice resmi).

---

## ☁️ 3. Credential Cloud Database (Upstash Redis)

Seluruh data transaksi dan rekap disinkronkan secara real-time ke Cloud Database Upstash Redis:

- **REST API URL**: `https://peaceful-gnat-190124.upstash.io`
- **REST API Token**: `gQAAAAAAAuasAQIgcDEwNjcwN2FhYTUzMTI0MTA3YjA0ZjMwYjY3NjJkNTllMg`
- **Vercel API Endpoint Sync**: `https://rekap.mendadaktransport.my.id/api/sync`
- **Daftar Kunci Database (Redis Keys)**:
  - `rekap:kontrak` — Master Data Rekap Kontrak Bulanan & Tahunan (6 Unit)
  - `rekap:daily` — Data Sewa Harian & Invoice
  - `rekap:cash` — Buku Kas (Pemasukan Sewa, BBM, Servis, & Angsuran Leasing Mandiri Finance)
  - `rekap:armada` — Master Armada & Status Plat Nomor

---

## 📱 4. Sistem Bot Telegram Invoice Otomatis

Aplikasi dilengkapi bot backend serverless yang mengecek tanggal jatuh tempo tiap unit kontrak secara otomatis dan mengirimi Anda rangkuman invoice tagihan ke Telegram:

- **Vercel Telegram API Endpoint**:  
  `https://rekap.mendadaktransport.my.id/api/telegram-invoice`

- **Cara Menghubungkan Bot Telegram**:
  1. Buat Bot di Telegram melalui **`@BotFather`** (`/newbot`) ➔ Dapatkan **`Bot Token`**.
  2. Cari **Chat ID** Anda melalui bot **`@userinfobot`** ➔ Dapatkan **`Chat ID`**.
  3. Buka Web Workspace [rekap.mendadaktransport.my.id/rekap](https://rekap.mendadaktransport.my.id/rekap).
  4. Klik tombol **`📱 Bot Telegram Invoice`** di Tab 1 ➔ Masukkan Token & Chat ID ➔ Klik **`💾 Simpan Setting`**.
  5. Klik **`🚀 Kirim Invoice Hari Ini`** untuk melakukan pengujian pengiriman tagihan.

- **Kunci Penyimpanan di Browser (LocalStorage Keys)**:
  - `MT_TG_BOT_TOKEN`
  - `MT_TG_CHAT_ID`

---

## 📦 5. Lokasi File Cadangan (Backup Lokal)

Seluruh data dan source code aplikasi telah dibackup secara otomatis di komputer Anda:

- **Arsip ZIP Lengkap**:  
  `D:\SCRIPT\YapAutoBot-NTE-main\Web Nopal Bedel\backups\MENDADAK_TRANSPORT_LOCAL_BACKUP_2026-08-11.zip`
- **Snapshot JSON Data**:  
  `D:\SCRIPT\YapAutoBot-NTE-main\Web Nopal Bedel\backups\backup_local_2026-08-11_0130\MENDADAK_TRANSPORT_SNAPSHOT.json`
- **Tombol Download 1-Click di Web**:  
  Tombol **`💾 Backup Data`** pada navbar kanan atas web.

---

## 🛠️ 6. Otomatisasi Build (NusaWebBonus / Project Frontend)

Mengenai otomatisasi build Vite / NPM di folder `D:\SCRIPT\YapAutoBot-NTE-main\NusaWebBonus\current\app`:

- Perintah otomatisasi build sekali jalan:
  ```bash
  cd D:\SCRIPT\YapAutoBot-NTE-main\NusaWebBonus\current\app
  npm install && npm run build
  ```
- *Penjelasan*: Perintah di atas mengunduh seluruh dependensi frontend (`npm install`) secara otomatis dan langsung mengkompilasi CSS/JS menjadi asset produksi (`npm run build`) tanpa risiko mengubah database atau data transaksi.

---
*Mendadak Transport Operational System — Dokumentasi Resmi Admin*
