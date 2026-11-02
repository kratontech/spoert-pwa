# SPOERT PWA (frontend-only)

Versi frontend-only dari SPOERT (Laravel) — React + TypeScript + Vite + Tailwind + PWA.
Semua data hanya hidup di memori (tanpa `localStorage`) dan kembali ke data contoh saat di-refresh, jadi cocok untuk demo di Netlify tanpa backend.
Tab-tab di browser yang sama saling sinkron lewat `BroadcastChannel`: booking tamu langsung tampil di panel owner/kasir, status ikut berubah saat DP diverifikasi, dan booking tamu hilang begitu tab tamu di-refresh/ditutup/pindah halaman. Login disimpan per tab (`sessionStorage`).

## Jalankan
```
npm install
npm run dev        # pengembangan
npm run build      # build produksi ke dist/
```

## Deploy ke Netlify
Hubungkan repo atau seret folder `dist/`. `netlify.toml` sudah berisi build command dan redirect SPA.

## Akun demo (password: `password`)
owner@spoert.test · kasir@spoert.test · member@spoert.test

## Yang sudah ada
- Booking Board publik (pilih sampai N jam, satu lapangan, satu tanggal), pengumuman, promo
- Booking tamu tanpa akun + cek booking (kode + no. HP) + unggah bukti pembayaran
- Pembayaran via transfer bank atau QRIS: pilih metode, lalu tampil info rekening atau gambar QRIS statis (diunggah owner di Pengaturan, bisa diunduh pelanggan)
- Area member: daftar, booking, bukti bayar, batal mandiri (batas jam), invoice
- Admin: dashboard, board, daftar/detail booking, pembayaran DP/cicilan/lunas, void, verifikasi bukti,
  diskon, pindah jadwal, no-show, selesai, member, staf, lapangan & kategori, blokir jadwal,
  aturan harga (validasi bentrok), promo, pengumuman, pengaturan (profil usaha, rekening bank, gambar QRIS, ketentuan),
  hak akses kasir, activity log, filter tanggal opsional di daftar booking
- Laporan (owner & kasir): uang masuk per hari/bulan/tahun, periode kustom, filter metode/lapangan/penerima, lifecycle booking & piutang, grafik, rincian transaksi dengan pencarian/urut/pagination, ekspor PDF dan Excel (library ekspor dimuat lazy)
- Logika: harga per slot (snapshot), anti double booking, minimal DP, status otomatis,
  kode promo (hari/jam/kuota/sekali per pelanggan/khusus member), auto-cancel booking lewat batas bayar
- PWA: bisa dipasang, offline-capable, tombol "Pasang aplikasi", tema gelap

## Batasan versi demo
- Tidak ada server: "email reset password" tidak ada, dan siapa pun bisa mengubah data lewat devtools.
- Jam tutup lewat tengah malam belum didukung.
- Inventaris F&B dan struk thermal 80mm belum dibuat (di Laravel asli juga belum selesai).
- Cetak langsung dari browser tidak tersedia; gunakan ekspor PDF atau Excel.
- Bukti pembayaran dan gambar QRIS disimpan sebagai data URL di memori (maks. 1,5 MB per file), jadi gambar QRIS hilang saat refresh dan perlu diunggah ulang.
- Sinkron antar-tab hanya di browser & origin yang sama (bukan lintas perangkat/incognito). Refresh satu tab saat tab lain masih terbuka akan mengambil kondisi dari tab itu; data baru kembali ke awal setelah semua tab ditutup.
