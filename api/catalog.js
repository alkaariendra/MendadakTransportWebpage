export const SERVICE_CATALOG_TEXT = `
Mendadak Transport menjual layanan berikut:

1. Rental mobil Lombok
- Bisa lepas kunci atau dengan driver, mengikuti ketersediaan unit.
- Area layanan: Lombok, Mataram, Senggigi, Mandalika, Kuta Lombok, Bandara Lombok, Lombok Barat, Lombok Tengah, dan rute wisata Lombok.
- Harga dapat berubah mengikuti tanggal, rute, durasi, dan ketersediaan armada.

Katalog armada dan harga dari website:
- Honda Jazz (City Car): lepas kunci Rp450.000 / 24 jam; driver + BBM Rp700.000 / 12 jam.
- Toyota Agya (City Car): lepas kunci Rp350.000 / 24 jam; driver + BBM Rp650.000 / 12 jam.
- New Honda Brio (City Car): lepas kunci Rp350.000 / 24 jam; driver + BBM Rp650.000 / 12 jam.
- All New Avanza (MPV): lepas kunci Rp400.000 / 24 jam; driver + BBM Rp750.000 / 12 jam.
- Xpander (MPV): lepas kunci Rp400.000 / 24 jam; driver + BBM Rp750.000 / 12 jam.
- All New Xenia (MPV): lepas kunci Rp400.000 / 24 jam; driver + BBM Rp750.000 / 12 jam.
- Fortuner (SUV): lepas kunci Rp1.000.000 / 24 jam; driver + BBM Rp1.600.000 / 24 jam.
- Innova Zenix (Premium MPV): lepas kunci Rp950.000 / 24 jam; driver + BBM Rp1.650.000 / 12 jam.
- Innova Reborn (Premium MPV): lepas kunci Rp550.000 / 24 jam; driver + BBM Rp900.000 / 12 jam.
- Zenix G HEV (Premium MPV): lepas kunci Rp700.000 / 24 jam; driver + BBM Rp1.200.000 / 12 jam.
- All New Hiace Premio (Minibus): driver + BBM Rp1.650.000 / 12 jam.
- Hiace Commuter (Minibus): driver + BBM Rp1.100.000 / 12 jam.
- Pajero Sport (SUV): driver + BBM Rp1.600.000 / 12 jam.
- Alphard (Luxury): driver + BBM Rp4.500.000 / 12 jam.

2. Rental motor
- Vespa Matic: lepas kunci Rp300.000 / 24 jam.
- Yamaha XMAX: lepas kunci Rp400.000 / 24 jam.

3. Paket tour Lombok
- Paket A 2 Hari 1 Malam: harga menyesuaikan jumlah peserta. Private trip singkat untuk pantai, gili, sunset, kuliner lokal, dan destinasi populer sesuai jam kedatangan.
- Tour 3 Hari 2 Malam Paket B: mulai Rp962.000 / person.
- Tour 3 Hari 2 Malam Paket C: mulai Rp1.080.000 / person.
- Tour 3 Hari 2 Malam Paket D: mulai Rp952.000 / person.
- Tour 3 Hari 2 Malam Paket E: mulai Rp950.000 / person.
- Paket tour bersifat private tour tanpa gabung dan dapat disesuaikan dengan tujuan, durasi, jumlah peserta, dan armada.

4. Layanan lain
- Antar jemput Bandara Lombok.
- Transport acara, kantor, keluarga, dan kebutuhan harian.
- Admin WhatsApp menangani konfirmasi akhir, ketersediaan, jadwal, rute, dan harga final.
`.trim();

export const REQUIRED_LEAD_FIELDS = `
Data minimal sebelum membuat ringkasan:
- Nama pelanggan.
- Nomor HP/WhatsApp.
- Layanan yang diminati: armada/paket/rute/kebutuhan.
- Tanggal atau waktu kebutuhan jika belum jelas.

Data tambahan sesuai layanan:
- Rental mobil/motor: tipe sewa lepas kunci atau driver, durasi, dan pengantaran/pengambilan. Jika pengantaran, minta alamat/titik antar. Jika pengambilan, catat pelanggan ambil ke lokasi Mendadak Transport.
- Paket tour: paket/tour yang diminati, tanggal mulai, durasi jika berbeda, dan jumlah peserta jika pelanggan sudah tahu.
- Antar jemput bandara: tanggal, jam, titik jemput, tujuan, dan jumlah penumpang jika pelanggan sudah tahu.
`.trim();
