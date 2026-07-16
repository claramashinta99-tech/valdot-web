# Valdot

Katalog drama pendek berbasis Sansekai API, dioptimalkan untuk Cloudflare Pages.

## Fitur

- Daftar drama terbaru dan trending
- Pencarian
- Halaman detail dan sinopsis
- Cloudflare Pages Function sebagai proxy API
- Cache edge untuk menghemat rate limit upstream
- Responsive untuk HP dan desktop

> Valdot hanya menampilkan metadata dan mengarahkan pengguna mencari tontonan di platform resmi. Proyek ini tidak menyediakan endpoint episode, decrypt stream, atau proxy video.

## Deploy ke Cloudflare Pages

1. Masuk ke Cloudflare Dashboard.
2. Workers & Pages → Create → Pages → Connect to Git.
3. Pilih repository `claramashinta99-tech/valdot-web`.
4. Framework preset: `None`.
5. Build command: kosong.
6. Build output directory: `/`.
7. Deploy.
8. Setelah aktif, buka Custom domains dan tambahkan domain milikmu.

Cloudflare akan mendeteksi folder `functions/` secara otomatis.
