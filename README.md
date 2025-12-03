
# Sistem Monitoring Misi SAFINAH-ONE NOVITA

Aplikasi web ini adalah dashboard monitoring misi berbasis Next.js (App Router), menggunakan Supabase untuk data _realtime_ dan Leaflet.js untuk visualisasi peta. Aplikasi ini memungkinkan pemantauan posisi, status misi, dan gambar secara langsung.

## Fitur Utama

**Peta Interaktif**: Menampilkan posisi kapal, lintasan, dan titik-titik penting misi secara _realtime_ menggunakan Leaflet.js.
**Data Navigasi _Realtime_**: Memperbarui data seperti koordinat, kecepatan (SOG), dan arah (COG) secara langsung dari database.
**Log Status Misi**: Memvisualisasikan kemajuan misi (Persiapan, Start, Floating ball set, dll.) dengan indikator warna.
**Galeri Gambar**: Menampilkan gambar yang diunggah dari kamera atas dan bawah.
**Manajemen Kunci API yang Aman**: Menggunakan variabel lingkungan (`.env`) untuk menjaga kerahasiaan kunci API Supabase.

---

## 🚀 Memulai

Ikuti langkah-langkah berikut untuk menginisiasi dan menjalankan proyek di lingkungan lokal Anda.

### 1. Klon Repositori

Jika Anda menggunakan Git, klon repositori proyek ini.

```bash
git clone https://github.com/AMMAR839/Safinah_React.git
cd Safinah_React
````

### 2\. Instalasi Dependensi

Instal semua paket yang diperlukan dengan npm atau Yarn.

```bash
npm install
# atau
yarn
```

### 3\. Konfigurasi Lingkungan

Buat file `.env.local` di root proyek. Ini akan digunakan untuk menyimpan kunci API Supabase Anda.

```bash
touch .env.local
```

Tambahkan URL dan kunci anonim Supabase Anda ke dalam file tersebut. Pastikan kunci dimulai dengan `NEXT_PUBLIC_` agar dapat diakses oleh kode sisi klien.

```env

```

### 4\. Menjalankan Server Pengembangan

Jalankan server pengembangan Next.js.

```bash
npm run dev
# atau
yarn dev
```

Server akan berjalan secara lokal di `http://localhost:3000`. Buka URL tersebut di browser Anda untuk melihat dashboard.

-----

## ⚙️ Struktur Proyek

Proyek ini menggunakan **App Router** terbaru dari Next.js. Berikut adalah penjelasan singkat tentang struktur foldernya:

  * **`app/`**: Berisi semua kode aplikasi, tata letak, dan halaman.
      * `layout.tsx`: Mendefinisikan struktur UI yang dibagikan (`<Header>`, dll.) untuk seluruh aplikasi.
      * `page.tsx`: Halaman utama dan logika inti dari dashboard.
      * `components/`: Folder untuk komponen UI yang dapat digunakan kembali.
  * **`public/`**: Berisi aset statis seperti gambar logo, ikon, dan ikon peta.
  * **`.env.local`**: File untuk variabel lingkungan yang sensitif.
  * **`tsconfig.json`**: File konfigurasi TypeScript.

<!-- end list -->

```
```
