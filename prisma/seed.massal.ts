/**
 * prisma/seed.massal.ts
 *
 * Generator data massal untuk SISPOS:
 * - 3 Puskesmas (termasuk Puskesmas Mergangsan demo)
 * - 30 Posyandu (20 Mergangsan + 5 Gedongtengen + 5 Umbulharjo, dengan koordinat Leaflet)
 * - ~1.000+ Warga + Balita tersebar merata (rata-rata 40-60 per posyandu)
 * - Distribusi status gizi bertingkat per posyandu (sehat/sedang/rawan/kritis/outlier)
 *
 * DEV/DEMO ONLY — tidak untuk produksi
 *
 * Dipanggil dari prisma/seed.ts sebagai `await seedMassal(prisma)`.
 * Bisa dijalankan standalone: ts-node prisma/seed.massal.ts
 */

import bcrypt from 'bcrypt'
import { JenisKelamin, PrismaClient, StatusGizi, StatusVerifikasi } from '@prisma/client'

const BCRYPT_ROUNDS = 8 // Lebih cepat dari 10 untuk data bulk; acceptable untuk demo

// ============================================================
// DATA PUSKESMAS (3 total)
// ============================================================

const PUSKESMAS_DATA = [
  {
    namaPuskesmas: 'Puskesmas Mergangsan',
    email: 'demo@puskesmas-mergangsan.go.id',
    alamat: 'Jl. Kenari No. 10, Mergangsan, Kota Yogyakarta',
    nomorTelepon: '0274512345',
    wilayahKerja: 'Kecamatan Mergangsan',
    passwordPlain: 'Demo1234!',
  },
  {
    namaPuskesmas: 'Puskesmas Gedongtengen',
    email: 'admin@puskesmas-gedongtengen.go.id',
    alamat: 'Jl. Tentara Pelajar No. 1, Gedongtengen, Kota Yogyakarta',
    nomorTelepon: '0274678901',
    wilayahKerja: 'Kecamatan Gedongtengen',
    passwordPlain: 'Massal1234!',
  },
  {
    namaPuskesmas: 'Puskesmas Umbulharjo',
    email: 'admin@puskesmas-umbulharjo.go.id',
    alamat: 'Jl. Veteran No. 22, Umbulharjo, Kota Yogyakarta',
    nomorTelepon: '0274789012',
    wilayahKerja: 'Kecamatan Umbulharjo',
    passwordPlain: 'Massal1234!',
  },
]

// ============================================================
// DATA POSYANDU (30 total: 20 Mergangsan + 5 Gedongtengen + 5 Umbulharjo)
// ============================================================

type StatusGroup = 'sehat' | 'sedang' | 'rawan' | 'kritis' | 'outlier'

interface PosyanduEntry {
  puskesmasEmail: string
  namaPosyandu: string
  kecamatan: string
  kelurahan: string
  rw: string
  latitude: number
  longitude: number
  statusGroup: StatusGroup
  targetBalita: number
}

const POSYANDU_DATA: PosyanduEntry[] = [
  // --- Mergangsan existing (5 posyandu, total 212) ---
  {
    puskesmasEmail: 'demo@puskesmas-mergangsan.go.id',
    namaPosyandu: 'Posyandu Mawar',
    kecamatan: 'Mergangsan',
    kelurahan: 'Wirogunan',
    rw: '003',
    latitude: -7.8160,
    longitude: 110.3700,
    statusGroup: 'rawan',
    targetBalita: 52,
  },
  {
    puskesmasEmail: 'demo@puskesmas-mergangsan.go.id',
    namaPosyandu: 'Posyandu Melati',
    kecamatan: 'Mergangsan',
    kelurahan: 'Brontokusuman',
    rw: '002',
    latitude: -7.8190,
    longitude: 110.3680,
    statusGroup: 'sehat',
    targetBalita: 38,
  },
  {
    puskesmasEmail: 'demo@puskesmas-mergangsan.go.id',
    namaPosyandu: 'Posyandu Anggrek',
    kecamatan: 'Mergangsan',
    kelurahan: 'Mergangsan',
    rw: '005',
    latitude: -7.8140,
    longitude: 110.3720,
    statusGroup: 'sedang',
    targetBalita: 44,
  },
  {
    // D-13: Cluster stunting kritis di Wirogunan RW 007
    puskesmasEmail: 'demo@puskesmas-mergangsan.go.id',
    namaPosyandu: 'Posyandu Dahlia',
    kecamatan: 'Mergangsan',
    kelurahan: 'Wirogunan',
    rw: '007',
    latitude: -7.8175,
    longitude: 110.3710,
    statusGroup: 'kritis',
    targetBalita: 36,
  },
  {
    puskesmasEmail: 'demo@puskesmas-mergangsan.go.id',
    namaPosyandu: 'Posyandu Kenanga',
    kecamatan: 'Mergangsan',
    kelurahan: 'Brontokusuman',
    rw: '009',
    latitude: -7.8200,
    longitude: 110.3660,
    statusGroup: 'outlier',
    targetBalita: 42,
  },

  // --- Gedongtengen (5 posyandu, total 208) ---
  {
    puskesmasEmail: 'admin@puskesmas-gedongtengen.go.id',
    namaPosyandu: 'Posyandu Seruni',
    kecamatan: 'Gedongtengen',
    kelurahan: 'Pringgokusuman',
    rw: '001',
    latitude: -7.7920,
    longitude: 110.3620,
    statusGroup: 'sehat',
    targetBalita: 42,
  },
  {
    puskesmasEmail: 'admin@puskesmas-gedongtengen.go.id',
    namaPosyandu: 'Posyandu Cempaka',
    kecamatan: 'Gedongtengen',
    kelurahan: 'Sosromenduran',
    rw: '003',
    latitude: -7.7935,
    longitude: 110.3610,
    statusGroup: 'sedang',
    targetBalita: 44,
  },
  {
    puskesmasEmail: 'admin@puskesmas-gedongtengen.go.id',
    namaPosyandu: 'Posyandu Kamboja',
    kecamatan: 'Gedongtengen',
    kelurahan: 'Pringgokusuman',
    rw: '006',
    latitude: -7.7950,
    longitude: 110.3630,
    statusGroup: 'sedang',
    targetBalita: 40,
  },
  {
    puskesmasEmail: 'admin@puskesmas-gedongtengen.go.id',
    namaPosyandu: 'Posyandu Aster',
    kecamatan: 'Gedongtengen',
    kelurahan: 'Sosromenduran',
    rw: '008',
    latitude: -7.7960,
    longitude: 110.3640,
    statusGroup: 'rawan',
    targetBalita: 38,
  },
  {
    puskesmasEmail: 'admin@puskesmas-gedongtengen.go.id',
    namaPosyandu: 'Posyandu Bougenville',
    kecamatan: 'Gedongtengen',
    kelurahan: 'Pringgokusuman',
    rw: '011',
    latitude: -7.7975,
    longitude: 110.3650,
    statusGroup: 'kritis',
    targetBalita: 44,
  },

  // --- Umbulharjo (5 posyandu, total 208) ---
  {
    puskesmasEmail: 'admin@puskesmas-umbulharjo.go.id',
    namaPosyandu: 'Posyandu Flamboyan',
    kecamatan: 'Umbulharjo',
    kelurahan: 'Muja Muju',
    rw: '002',
    latitude: -7.8050,
    longitude: 110.3870,
    statusGroup: 'sehat',
    targetBalita: 42,
  },
  {
    puskesmasEmail: 'admin@puskesmas-umbulharjo.go.id',
    namaPosyandu: 'Posyandu Teratai',
    kecamatan: 'Umbulharjo',
    kelurahan: 'Tahunan',
    rw: '004',
    latitude: -7.8070,
    longitude: 110.3890,
    statusGroup: 'sedang',
    targetBalita: 44,
  },
  {
    puskesmasEmail: 'admin@puskesmas-umbulharjo.go.id',
    namaPosyandu: 'Posyandu Wijayakusuma',
    kecamatan: 'Umbulharjo',
    kelurahan: 'Warungboto',
    rw: '003',
    latitude: -7.8090,
    longitude: 110.3910,
    statusGroup: 'rawan',
    targetBalita: 40,
  },
  {
    puskesmasEmail: 'admin@puskesmas-umbulharjo.go.id',
    namaPosyandu: 'Posyandu Tulip',
    kecamatan: 'Umbulharjo',
    kelurahan: 'Sorosutan',
    rw: '006',
    latitude: -7.8110,
    longitude: 110.3930,
    statusGroup: 'kritis',
    targetBalita: 38,
  },
  {
    puskesmasEmail: 'admin@puskesmas-umbulharjo.go.id',
    namaPosyandu: 'Posyandu Lavender',
    kecamatan: 'Umbulharjo',
    kelurahan: 'Pandeyan',
    rw: '008',
    latitude: -7.8130,
    longitude: 110.3950,
    statusGroup: 'outlier',
    targetBalita: 44,
  },

  // --- Mergangsan tambahan (15 posyandu, ~750 balita) ---
  { puskesmasEmail: 'demo@puskesmas-mergangsan.go.id', namaPosyandu: 'Posyandu Seroja',     kecamatan: 'Mergangsan', kelurahan: 'Wirogunan',      rw: '001', latitude: -7.8145, longitude: 110.3680, statusGroup: 'sehat',   targetBalita: 55 },
  { puskesmasEmail: 'demo@puskesmas-mergangsan.go.id', namaPosyandu: 'Posyandu Asoka',      kecamatan: 'Mergangsan', kelurahan: 'Wirogunan',      rw: '002', latitude: -7.8155, longitude: 110.3692, statusGroup: 'sedang',  targetBalita: 48 },
  { puskesmasEmail: 'demo@puskesmas-mergangsan.go.id', namaPosyandu: 'Posyandu Bakung',     kecamatan: 'Mergangsan', kelurahan: 'Wirogunan',      rw: '004', latitude: -7.8165, longitude: 110.3705, statusGroup: 'rawan',   targetBalita: 52 },
  { puskesmasEmail: 'demo@puskesmas-mergangsan.go.id', namaPosyandu: 'Posyandu Nusa Indah', kecamatan: 'Mergangsan', kelurahan: 'Wirogunan',      rw: '005', latitude: -7.8172, longitude: 110.3715, statusGroup: 'kritis',  targetBalita: 45 },
  { puskesmasEmail: 'demo@puskesmas-mergangsan.go.id', namaPosyandu: 'Posyandu Tapak Dara', kecamatan: 'Mergangsan', kelurahan: 'Wirogunan',      rw: '006', latitude: -7.8152, longitude: 110.3725, statusGroup: 'sehat',   targetBalita: 58 },
  { puskesmasEmail: 'demo@puskesmas-mergangsan.go.id', namaPosyandu: 'Posyandu Lili',       kecamatan: 'Mergangsan', kelurahan: 'Brontokusuman',  rw: '001', latitude: -7.8185, longitude: 110.3655, statusGroup: 'sedang',  targetBalita: 50 },
  { puskesmasEmail: 'demo@puskesmas-mergangsan.go.id', namaPosyandu: 'Posyandu Begonia',    kecamatan: 'Mergangsan', kelurahan: 'Brontokusuman',  rw: '003', latitude: -7.8195, longitude: 110.3665, statusGroup: 'sehat',   targetBalita: 55 },
  { puskesmasEmail: 'demo@puskesmas-mergangsan.go.id', namaPosyandu: 'Posyandu Zinnia',     kecamatan: 'Mergangsan', kelurahan: 'Brontokusuman',  rw: '004', latitude: -7.8205, longitude: 110.3648, statusGroup: 'rawan',   targetBalita: 47 },
  { puskesmasEmail: 'demo@puskesmas-mergangsan.go.id', namaPosyandu: 'Posyandu Petunia',    kecamatan: 'Mergangsan', kelurahan: 'Brontokusuman',  rw: '005', latitude: -7.8215, longitude: 110.3658, statusGroup: 'sedang',  targetBalita: 53 },
  { puskesmasEmail: 'demo@puskesmas-mergangsan.go.id', namaPosyandu: 'Posyandu Crisan',     kecamatan: 'Mergangsan', kelurahan: 'Brontokusuman',  rw: '006', latitude: -7.8210, longitude: 110.3672, statusGroup: 'kritis',  targetBalita: 43 },
  { puskesmasEmail: 'demo@puskesmas-mergangsan.go.id', namaPosyandu: 'Posyandu Magnolia',   kecamatan: 'Mergangsan', kelurahan: 'Mergangsan',     rw: '001', latitude: -7.8138, longitude: 110.3730, statusGroup: 'sehat',   targetBalita: 56 },
  { puskesmasEmail: 'demo@puskesmas-mergangsan.go.id', namaPosyandu: 'Posyandu Alamanda',   kecamatan: 'Mergangsan', kelurahan: 'Mergangsan',     rw: '002', latitude: -7.8128, longitude: 110.3742, statusGroup: 'sedang',  targetBalita: 49 },
  { puskesmasEmail: 'demo@puskesmas-mergangsan.go.id', namaPosyandu: 'Posyandu Gladiol',    kecamatan: 'Mergangsan', kelurahan: 'Mergangsan',     rw: '003', latitude: -7.8118, longitude: 110.3752, statusGroup: 'rawan',   targetBalita: 51 },
  { puskesmasEmail: 'demo@puskesmas-mergangsan.go.id', namaPosyandu: 'Posyandu Amarilis',   kecamatan: 'Mergangsan', kelurahan: 'Mergangsan',     rw: '004', latitude: -7.8132, longitude: 110.3762, statusGroup: 'outlier', targetBalita: 44 },
  { puskesmasEmail: 'demo@puskesmas-mergangsan.go.id', namaPosyandu: 'Posyandu Edelweiss',  kecamatan: 'Mergangsan', kelurahan: 'Mergangsan',     rw: '006', latitude: -7.8142, longitude: 110.3748, statusGroup: 'sedang',  targetBalita: 55 },
]

// ============================================================
// DISTRIBUSI STATUS GIZI (weighted random per statusGroup)
// ============================================================

const STATUS_GIZI_DIST: Record<StatusGroup, { s: string; w: number }[]> = {
  sehat:   [{ s: 'normal', w: 84 }, { s: 'kurang', w: 5 }, { s: 'pendek', w: 3 }, { s: 'lebih', w: 8 }],
  sedang:  [{ s: 'normal', w: 82 }, { s: 'kurang', w: 8 }, { s: 'pendek', w: 5 }, { s: 'buruk', w: 1 }, { s: 'lebih', w: 4 }],
  rawan:   [{ s: 'normal', w: 78 }, { s: 'kurang', w: 12 }, { s: 'pendek', w: 7 }, { s: 'buruk', w: 3 }],
  kritis:  [{ s: 'normal', w: 71 }, { s: 'kurang', w: 14 }, { s: 'pendek', w: 10 }, { s: 'buruk', w: 4 }, { s: 'sangat_pendek', w: 1 }],
  outlier: [{ s: 'lebih', w: 60 }, { s: 'obesitas', w: 25 }, { s: 'normal', w: 15 }],
}

// ============================================================
// NAMA IBU & BALITA (khas Jawa/Yogyakarta)
// ============================================================

const WARGA_IBU_NAMES = [
  'Siti Aminah Rahayu', 'Dewi Lestari Handayani', 'Sri Wahyuni', 'Rini Handayani Putri', 'Yuni Astuti Wibowo',
  'Eni Susanti', 'Wati Rahayu Saputri', 'Anik Suryani', 'Tutik Wulandari', 'Sari Utami Dewi',
  'Endah Priyatni', 'Ning Raharti Susilo', 'Retno Widayati', 'Umi Kulsum', 'Puji Lestari Wahyu',
  'Hartini Soewondo', 'Kustiyah Broto', 'Lastri Mulyani', 'Sumarni Dwiputri', 'Niken Cahyani',
  'Fitri Nurhalimah', 'Anisa Rachmawati', 'Lilis Sulistyowati', 'Murni Setyaningrum', 'Wiwik Handayani',
  'Rina Kusumastuti', 'Tri Wahyuningsih', 'Nanik Prihatiningsih', 'Devi Kurniasari', 'Riska Oktaviani',
  'Suci Ramadhani', 'Yayuk Setiawati', 'Ika Nuryati', 'Lia Febrianti', 'Mila Agustina',
  'Nita Permatasari', 'Ratih Puspitasari', 'Vera Kusumawati', 'Dian Pramesti', 'Hesti Widyastuti',
  'Aprilia Ratnasari', 'Erna Wahyuningsih', 'Kristina Dewi', 'Lutviana Sari', 'Melinda Cahyani',
  'Novi Andriani', 'Oktaviana Putri', 'Priyanti Lestari', 'Qomariyah Hidayah', 'Rukayah Susanti',
  'Sutinah Widianto', 'Mulyati Harsono', 'Susilowati Teguh', 'Hartatik Suwito', 'Mawar Handayani',
  'Rahayu Kurniawati', 'Siti Romlah', 'Dwi Lestari Santoso', 'Tri Astuti Suwandi', 'Listiyati Pranoto',
  'Siswanti Raharjo', 'Rubiyem Suranto', 'Niken Widiastuti', 'Kurnia Rahayu', 'Wahidah Sari',
  'Mariyam Sutopo', 'Ida Faridah', 'Jumini Setyawan', 'Sarsini Wibowo', 'Tatik Haryanti',
  'Mardiyem Sukoco', 'Supartini Harjo', 'Rokhayah Sujatno', 'Sri Haryati Budiono', 'Nawang Wulan',
]

const BALITA_NAMES_L = [
  'Muhammad Alfatih Ramadhan', 'Raka Aditya Pratama', 'Zhafran Malik Fawwaz',
  'Arsyad Fikri Maulana', 'Alvaro Rizky Mahendra', 'Daffa Putra Nugraha',
  'Faiz Ardiansyah', 'Ghazy Naufal Pratama', 'Haikal Mubaraq', 'Ilham Ferdianto',
  'Javier Aldo Santoso', 'Kevin Ardika Putra', 'Luthfi Hamdani', 'Maulana Yusuf',
  'Naufal Abidzar Rahman', 'Octa Bagus Prasetyo', 'Pandu Wicaksono', 'Qadafi Rizky',
  'Raditya Surya Prabowo', 'Sultan Farhan Akbar', 'Tirto Adi Nugroho', 'Umar Haidar',
  'Vito Bintang Erlangga', 'Wahyu Dian Saputra', 'Xander Arya Kusuma', 'Yoga Pratama',
  'Zidan Fadhilah Putra', 'Abyan Nabil Hafizh', 'Bintang Cahya Ramadhan', 'Candra Eka Putra',
  'Dimas Ari Wicaksono', 'Evan Eka Nugraha', 'Farhan Dzaki Maulana',
  'Gerry Habibie Putra', 'Hafidz Karim Santoso', 'Ibrahim Zaidan Rahman',
  'Joko Prasetyo Adi', 'Kenzo Aditya Putra', 'Leon Ariq Pradana', 'Marco Ivan Santoso',
  'Nabil Arsyad Putra', 'Omar Abdullah Faiz', 'Prama Putra Utama', 'Qais Haikal Arya',
  'Rama Satria Wibowo', 'Sandi Permana Putra', 'Tristan Ardika Nugroho',
  'Ujang Rahmat Sejati', 'Valentino Brata Adi', 'Wikan Pandu Saputra',
  'Yahya Rosyid Maulana', 'Zayn Arya Mahendra', 'Adrian Surya Pratama',
  'Barca Putra Jaya', 'Celvin Eka Prabowo', 'Dirgantara Adi Putra',
  'Eshan Malik Fadhila', 'Farel Bintang Adi', 'Gibran Arya Utama', 'Hanafi Rizky Putra',
  'Ivan Naufal Hakim', 'Julio Ardian Saputra', 'Kenan Adi Nugroho', 'Laksmana Pratama',
  'Mafaza Dzakir Faiz', 'Nahuel Ardika Putra', 'Onex Bagas Prabowo', 'Prasojo Adi Wibowo',
  'Qodratullah Arif', 'Rendra Bagus Pratama', 'Sidqi Fauzan Malik', 'Talha Afif Rahman',
  'Uwais Ahmad Sholeh', 'Vivaldi Putra Adi', 'Wildan Arsyad Nugroho',
  'Xio Putra Nugroho', 'Yans Dwi Prasetyo', 'Zuhal Fikri Maulana',
  'Abil Putra Santoso', 'Bramma Adi Wibowo', 'Cahyo Rekso Putra',
  'Danu Setyo Nugroho', 'Erwin Cahyo Pratama', 'Fikri Habib Maulana',
  'Gavin Nugroho Adi', 'Hafis Arya Santoso', 'Idris Karim Fadhila',
  'Jafar Putra Wibowo', 'Krisna Adi Pratama', 'Lutfi Cahya Nugroho',
]

const BALITA_NAMES_P = [
  'Aisyah Humaira Putri', 'Kayla Nasywa Azzahra', 'Naila Khairunnisa',
  'Keisya Anindita Prameswari', 'Salsabila Nur Aini', 'Zahra Aulia Ramadhani',
  'Alya Fadhilah Sari', 'Bunga Citra Lestari', 'Cantika Dwi Rahayu', 'Delia Putri Anjani',
  'Elsa Nurrahma', 'Fiona Maharani', 'Gita Ayu Puspita', 'Hana Safira Dewi',
  'Intan Permata Sari', 'Jasmine Revalina', 'Kirana Ayu Wulandari', 'Lalita Nindya Putri',
  'Maheswari Aditya', 'Nadia Zahra Fitri', 'Olivia Citra Dewi', 'Putri Raisa Amelia',
  'Qisthi Nur Aisyah', 'Raisa Andini Putri', 'Salwa Nabila Husna', 'Tiara Nadindra',
  'Ulfah Zulaikha', 'Vanya Aurelia', 'Wafda Nur Hikmah', 'Xena Callista Dewi',
  'Yasmine Putri Rahayu', 'Azzahra Malika Dewi', 'Bintari Ayu Sari',
  'Cilla Ayu Rahayu', 'Dara Rahayu Sari', 'Eka Sari Dewi', 'Fara Lestari Putri',
  'Ganeswari Ayu', 'Hasna Auliya Putri', 'Inayah Karima Sari',
  'Jihan Amira Dewi', 'Keyla Adinda Putri', 'Lana Azzahra Dewi',
  'Maya Cahyani Putri', 'Nabila Zahra Sari', 'Okta Sari Dewi',
  'Prameswari Ayu Putri', 'Qarina Salsabila Dewi', 'Reva Anindita Putri',
  'Sabrina Amalia Sari', 'Tari Cahya Rahayu', 'Uma Azzahra Putri',
  'Vika Novitasari Dewi', 'Winda Sari Rahayu', 'Nita Ardini Putri',
  'Yola Ramadhani Sari', 'Zea Putri Dewi', 'Adinda Khansa Sari',
  'Berliana Ayu Putri', 'Cahyani Rahayu Dewi', 'Diara Putri Rahayu',
  'Efira Nurul Sari', 'Fadia Zahra Dewi', 'Ghina Amira Putri',
  'Hilda Permata Sari', 'Ira Maharani Dewi', 'Junita Sari Rahayu',
  'Kiara Andina Putri', 'Lela Nurdia Sari', 'Meva Safira Dewi',
  'Nina Amalia Putri', 'Orla Putri Rahayu', 'Pita Rahayu Dewi',
  'Qisti Ananda Putri', 'Raina Dewi Sari', 'Siska Ramadhani Putri',
  'Triana Putri Dewi', 'Ulfa Maulida Sari', 'Vanda Rahayu Putri',
  'Weni Lestari Dewi', 'Xara Putri Sari', 'Yeni Safitri Rahayu',
  'Zebina Putri Dewi', 'Aldira Rahayu Sari', 'Belva Amira Putri',
  'Cici Permata Dewi', 'Dafina Putri Rahayu', 'Ghea Maharani Putri',
]

// ============================================================
// NAMA KADER (dipakai untuk seed kader per posyandu)
// ============================================================

const KADER_NAMES = [
  'Sumiyati Rahayu', 'Endang Sulistyowati', 'Kristanti Dewi', 'Wahyuni Hartono',
  'Sri Mulyani', 'Parti Lestari', 'Murti Handayani', 'Suprapti Winarni',
  'Katmi Sutrisno', 'Lasmi Wahyudi', 'Darwati Sudarmono', 'Harni Supriyadi',
  'Lilik Suryani', 'Tukini Rahardjo', 'Sarmi Wibowo', 'Watini Sukamto',
  'Sukini Priyatno', 'Tarmi Soetomo', 'Ngatini Hartojo', 'Karmini Subagyo',
  'Sugiyanti Supardi', 'Tumini Wiryanto', 'Rusmini Suwanto', 'Kartini Suharto',
  'Martini Soedibjo', 'Suratmi Wiryo', 'Parmi Sunarto', 'Sutarmi Basuki',
  'Warsini Santoso', 'Jumini Haryadi',
  'Turiyem Riyanto', 'Sakinem Hartono', 'Ponirah Sudiro', 'Tugiyem Slamet',
  'Kamirah Sulistyo', 'Dwi Astuti Hartono', 'Purwati Sudibyo', 'Suminah Suyono',
  'Marsini Wiyoto', 'Marsiyem Kariyo', 'Tukiyem Mulyono', 'Sarwati Supono',
  'Mujirah Sukamto', 'Winarsih Haryono', 'Riyanti Soetopo', 'Supiyah Wiranto',
  'Sadiyem Sudarto', 'Uminah Sutrisno', 'Tuginih Kusmanto', 'Wariyem Sutardi',
  'Ginah Sukarman', 'Mirah Wiryo', 'Sujirah Hartanto', 'Katiyem Sutrisno',
  'Suparni Hartono', 'Tuminah Sudarno', 'Kasinah Wiranto', 'Carinih Sukarno',
  'Tarinih Suryadi', 'Sukatni Hartanto',
]

// Kader config per posyandu (index sesuai POSYANDU_DATA)
// Format: [{ nama, role }] — HP + kaderIdx di-generate otomatis
const KADER_CONFIG: Array<Array<{ nama: string; role: 'kader' | 'ketua_kader' }>> = [
  // 0: Posyandu Mawar (Mergangsan) — seed.demo.ts sudah buat 2 kader; massal tambah 1
  [{ nama: 'Sumiyati Rahayu', role: 'kader' }],
  // 1: Posyandu Melati
  [{ nama: 'Endang Sulistyowati', role: 'ketua_kader' }, { nama: 'Kristanti Dewi', role: 'kader' }, { nama: 'Wahyuni Hartono', role: 'kader' }],
  // 2: Posyandu Anggrek
  [{ nama: 'Sri Mulyani', role: 'ketua_kader' }, { nama: 'Parti Lestari', role: 'kader' }, { nama: 'Murti Handayani', role: 'kader' }],
  // 3: Posyandu Dahlia
  [{ nama: 'Suprapti Winarni', role: 'ketua_kader' }, { nama: 'Katmi Sutrisno', role: 'kader' }],
  // 4: Posyandu Kenanga
  [{ nama: 'Lasmi Wahyudi', role: 'ketua_kader' }, { nama: 'Darwati Sudarmono', role: 'kader' }, { nama: 'Harni Supriyadi', role: 'kader' }],
  // 5: Posyandu Seruni (Gedongtengen)
  [{ nama: 'Lilik Suryani', role: 'ketua_kader' }, { nama: 'Tukini Rahardjo', role: 'kader' }, { nama: 'Sarmi Wibowo', role: 'kader' }],
  // 6: Posyandu Cempaka
  [{ nama: 'Watini Sukamto', role: 'ketua_kader' }, { nama: 'Sukini Priyatno', role: 'kader' }],
  // 7: Posyandu Kamboja
  [{ nama: 'Tarmi Soetomo', role: 'ketua_kader' }, { nama: 'Ngatini Hartojo', role: 'kader' }, { nama: 'Karmini Subagyo', role: 'kader' }],
  // 8: Posyandu Aster
  [{ nama: 'Sugiyanti Supardi', role: 'ketua_kader' }, { nama: 'Tumini Wiryanto', role: 'kader' }],
  // 9: Posyandu Bougenville
  [{ nama: 'Rusmini Suwanto', role: 'ketua_kader' }, { nama: 'Kartini Suharto', role: 'kader' }, { nama: 'Martini Soedibjo', role: 'kader' }],
  // 10: Posyandu Flamboyan (Umbulharjo)
  [{ nama: 'Suratmi Wiryo', role: 'ketua_kader' }, { nama: 'Parmi Sunarto', role: 'kader' }, { nama: 'Sutarmi Basuki', role: 'kader' }],
  // 11: Posyandu Teratai
  [{ nama: 'Warsini Santoso', role: 'ketua_kader' }, { nama: 'Jumini Haryadi', role: 'kader' }],
  // 12: Posyandu Wijayakusuma
  [{ nama: 'Suratmi Wiryo', role: 'ketua_kader' }, { nama: 'Katmi Sutrisno', role: 'kader' }],
  // 13: Posyandu Tulip
  [{ nama: 'Endang Sulistyowati', role: 'ketua_kader' }, { nama: 'Lilik Suryani', role: 'kader' }, { nama: 'Parti Lestari', role: 'kader' }],
  // 14: Posyandu Lavender
  [{ nama: 'Sri Mulyani', role: 'ketua_kader' }, { nama: 'Darwati Sudarmono', role: 'kader' }],
  // 15: Posyandu Seroja (Mergangsan tambahan - Wirogunan)
  [{ nama: 'Turiyem Riyanto', role: 'ketua_kader' }, { nama: 'Sakinem Hartono', role: 'kader' }, { nama: 'Ponirah Sudiro', role: 'kader' }],
  // 16: Posyandu Asoka
  [{ nama: 'Tugiyem Slamet', role: 'ketua_kader' }, { nama: 'Kamirah Sulistyo', role: 'kader' }],
  // 17: Posyandu Bakung
  [{ nama: 'Dwi Astuti Hartono', role: 'ketua_kader' }, { nama: 'Purwati Sudibyo', role: 'kader' }, { nama: 'Suminah Suyono', role: 'kader' }],
  // 18: Posyandu Nusa Indah
  [{ nama: 'Marsini Wiyoto', role: 'ketua_kader' }, { nama: 'Marsiyem Kariyo', role: 'kader' }],
  // 19: Posyandu Tapak Dara
  [{ nama: 'Tukiyem Mulyono', role: 'ketua_kader' }, { nama: 'Sarwati Supono', role: 'kader' }, { nama: 'Mujirah Sukamto', role: 'kader' }],
  // 20: Posyandu Lili (Mergangsan tambahan - Brontokusuman)
  [{ nama: 'Winarsih Haryono', role: 'ketua_kader' }, { nama: 'Riyanti Soetopo', role: 'kader' }],
  // 21: Posyandu Begonia
  [{ nama: 'Supiyah Wiranto', role: 'ketua_kader' }, { nama: 'Sadiyem Sudarto', role: 'kader' }, { nama: 'Uminah Sutrisno', role: 'kader' }],
  // 22: Posyandu Zinnia
  [{ nama: 'Tuginih Kusmanto', role: 'ketua_kader' }, { nama: 'Wariyem Sutardi', role: 'kader' }],
  // 23: Posyandu Petunia
  [{ nama: 'Ginah Sukarman', role: 'ketua_kader' }, { nama: 'Mirah Wiryo', role: 'kader' }, { nama: 'Sujirah Hartanto', role: 'kader' }],
  // 24: Posyandu Crisan
  [{ nama: 'Katiyem Sutrisno', role: 'ketua_kader' }, { nama: 'Suparni Hartono', role: 'kader' }],
  // 25: Posyandu Magnolia (Mergangsan tambahan - Mergangsan)
  [{ nama: 'Tuminah Sudarno', role: 'ketua_kader' }, { nama: 'Kasinah Wiranto', role: 'kader' }, { nama: 'Carinih Sukarno', role: 'kader' }],
  // 26: Posyandu Alamanda
  [{ nama: 'Tarinih Suryadi', role: 'ketua_kader' }, { nama: 'Sukatni Hartanto', role: 'kader' }],
  // 27: Posyandu Gladiol
  [{ nama: 'Turiyem Riyanto', role: 'ketua_kader' }, { nama: 'Purwati Sudibyo', role: 'kader' }, { nama: 'Winarsih Haryono', role: 'kader' }],
  // 28: Posyandu Amarilis
  [{ nama: 'Tukiyem Mulyono', role: 'ketua_kader' }, { nama: 'Sadiyem Sudarto', role: 'kader' }],
  // 29: Posyandu Edelweiss
  [{ nama: 'Ginah Sukarman', role: 'ketua_kader' }, { nama: 'Mirah Wiryo', role: 'kader' }, { nama: 'Sukatni Hartanto', role: 'kader' }],
]

// ============================================================
// JADWAL IMUNISASI DASAR (module-level — Kemenkes standard)
// ============================================================

const IMUNISASI_SCHEDULE = [
  { namaVaksin: 'BCG',         dosisKe: 1, ageMonth: 0 },
  { namaVaksin: 'Polio',       dosisKe: 1, ageMonth: 0 },
  { namaVaksin: 'Polio',       dosisKe: 2, ageMonth: 2 },
  { namaVaksin: 'DPT-HB-Hib', dosisKe: 1, ageMonth: 2 },
  { namaVaksin: 'Polio',       dosisKe: 3, ageMonth: 3 },
  { namaVaksin: 'DPT-HB-Hib', dosisKe: 2, ageMonth: 3 },
  { namaVaksin: 'Polio',       dosisKe: 4, ageMonth: 4 },
  { namaVaksin: 'DPT-HB-Hib', dosisKe: 3, ageMonth: 4 },
  { namaVaksin: 'Campak',      dosisKe: 1, ageMonth: 9 },
]

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/** Weighted random pick — deterministic via prime-scrambled index, spreads 0-99 evenly */
function pickWeighted(dist: { s: string; w: number }[], posIdx: number, balIdx: number): string {
  const roll = (posIdx * 37 + balIdx * 13) % 100
  let cumulative = 0
  for (const item of dist) {
    cumulative += item.w
    if (roll < cumulative) return item.s
  }
  return dist[dist.length - 1].s
}

/**
 * Generate 16-digit NIK from posIdx + balIdx.
 * Format: 3471 (DIY prefix) + posIdx:2 + balIdx:4 + suffix:6
 * T-07-02-02: pattern guaranteed unique within seed scope.
 */
function genNIK(posIdx: number, balIdx: number): string {
  return (
    '3471' +
    String(posIdx).padStart(2, '0') +
    String(balIdx).padStart(4, '0') +
    String(posIdx * 100 + balIdx).padStart(6, '0')
  )
}

/** Generate 12-digit HP number from posIdx + balIdx (no collision with demo accounts) */
function genHP(posIdx: number, balIdx: number): string {
  return '0812' + String(posIdx).padStart(3, '0') + String(balIdx).padStart(5, '0')
}

/** Generate tanggal lahir balita usia 6-59 bulan (seed-deterministic) */
function genTanggalLahirBalita(seed: number): Date {
  const ageMonths = 6 + (seed % 54) // 6..59 bulan
  const today = new Date()
  return new Date(today.getTime() - ageMonths * 30 * 24 * 60 * 60 * 1000)
}

/** Approximate Z-Score values based on statusGizi category */
function getZScores(
  statusGizi: string,
  seed: number,
): { zBbU: number; zTbU: number; zScoreBbTb: number } {
  switch (statusGizi) {
    case 'normal':
      return {
        zBbU: -1.5 + (seed % 30) * 0.1,
        zTbU: -1.0 + (seed % 20) * 0.1,
        zScoreBbTb: -0.5 + (seed % 10) * 0.1,
      }
    case 'kurang':
      return {
        zBbU: -2.8 + (seed % 8) * 0.1,
        zTbU: -1.5 + (seed % 10) * 0.1,
        zScoreBbTb: -1.2 + (seed % 8) * 0.1,
      }
    case 'buruk':
      return {
        zBbU: -3.5 + (seed % 5) * 0.1,
        zTbU: -2.5 + (seed % 5) * 0.1,
        zScoreBbTb: -2.0 + (seed % 5) * 0.1,
      }
    case 'pendek':
      return {
        zBbU: -1.0 + (seed % 20) * 0.1,
        zTbU: -2.8 + (seed % 8) * 0.1,
        zScoreBbTb: -0.5 + (seed % 10) * 0.1,
      }
    case 'sangat_pendek':
      return {
        zBbU: -1.5 + (seed % 10) * 0.1,
        zTbU: -3.8 + (seed % 8) * 0.1,
        zScoreBbTb: -0.5 + (seed % 5) * 0.1,
      }
    case 'lebih':
      return {
        zBbU: 2.0 + (seed % 8) * 0.1,
        zTbU: 0.5 + (seed % 10) * 0.1,
        zScoreBbTb: 1.5 + (seed % 8) * 0.1,
      }
    case 'obesitas':
      return {
        zBbU: 3.0 + (seed % 5) * 0.1,
        zTbU: 1.0 + (seed % 5) * 0.1,
        zScoreBbTb: 2.5 + (seed % 5) * 0.1,
      }
    default:
      return { zBbU: 0, zTbU: 0, zScoreBbTb: 0 }
  }
}

/** Approximate BB (kg) + TB (cm) based on usia balita in months */
function getMeasurements(
  ageMonths: number,
  seed: number,
): { beratBadan: number; tinggiBadan: number } {
  if (ageMonths <= 6) {
    return { beratBadan: 3.0 + (seed % 50) * 0.1, tinggiBadan: 50 + (seed % 17) }
  } else if (ageMonths <= 12) {
    return { beratBadan: 7.0 + (seed % 30) * 0.1, tinggiBadan: 67 + (seed % 8) }
  } else if (ageMonths <= 24) {
    return { beratBadan: 9.0 + (seed % 30) * 0.1, tinggiBadan: 75 + (seed % 10) }
  } else {
    return { beratBadan: 12.0 + (seed % 60) * 0.1, tinggiBadan: 85 + (seed % 25) }
  }
}

// ============================================================
// RECORD TYPE (untuk loop pemeriksaan + imunisasi)
// ============================================================

interface BalitaRecord {
  balita: { id: string }
  statusGizi: string
  tanggalLahir: Date
  posIdx: number
  balitaIdx: number
}

// ============================================================
// MAIN EXPORT
// ============================================================

export async function seedMassal(prisma: PrismaClient): Promise<void> {
  // Hitung todayStart dalam WIB
  const nowUtc = new Date()
  const wibMs = 7 * 60 * 60 * 1000
  const nowWib = new Date(nowUtc.getTime() + wibMs)
  const todayStart = new Date(
    Date.UTC(nowWib.getUTCFullYear(), nowWib.getUTCMonth(), nowWib.getUTCDate()),
  )

  // Hash password sekali (efisiensi bulk)
  const demoHash = await bcrypt.hash('Demo1234!', BCRYPT_ROUNDS)
  const massalHash = await bcrypt.hash('Warga1234!', BCRYPT_ROUNDS)
  const puskHash = await bcrypt.hash('Massal1234!', BCRYPT_ROUNDS)
  const pinHash = await bcrypt.hash('123456', BCRYPT_ROUNDS)

  // ---- 1. Upsert 3 Puskesmas ----
  const puskesmasMap = new Map<string, { id: string }>()
  for (const entry of PUSKESMAS_DATA) {
    const pwHash = entry.passwordPlain === 'Demo1234!' ? demoHash : puskHash
    const puskesmas = await prisma.puskesmas.upsert({
      where: { email: entry.email },
      update: { passwordHash: pwHash },
      create: {
        namaPuskesmas: entry.namaPuskesmas,
        email: entry.email,
        passwordHash: pwHash,
        alamat: entry.alamat,
        nomorTelepon: entry.nomorTelepon,
        wilayahKerja: entry.wilayahKerja,
      },
    })
    puskesmasMap.set(entry.email, puskesmas)
    console.log('✓ Puskesmas:', puskesmas.id.slice(0, 8), '—', entry.namaPuskesmas)
  }

  // ---- 2. Find or create 30 Posyandu ----
  const posyanduList: Array<{
    id: string
    kecamatan: string
    kelurahan: string
    rw: string
  }> = []

  for (const entry of POSYANDU_DATA) {
    const puskesmas = puskesmasMap.get(entry.puskesmasEmail)!
    let posyandu = await prisma.posyandu.findFirst({
      where: { puskesmasId: puskesmas.id, namaPosyandu: entry.namaPosyandu },
    })
    if (!posyandu) {
      posyandu = await prisma.posyandu.create({
        data: {
          puskesmasId: puskesmas.id,
          namaPosyandu: entry.namaPosyandu,
          provinsi: 'DI Yogyakarta',
          kabupaten: 'Kota Yogyakarta',
          kecamatan: entry.kecamatan,
          kelurahan: entry.kelurahan,
          rw: entry.rw,
          latitude: entry.latitude,
          longitude: entry.longitude,
          jamOperasional: '08:00 - 12:00',
        },
      })
    }
    posyanduList.push(posyandu)
  }

  // ---- 2b. Create Kader per posyandu ----
  let totalKader = 0
  for (const [posIdx, posyandu] of posyanduList.entries()) {
    const kaders = KADER_CONFIG[posIdx] ?? []
    for (const [kIdx, kConf] of kaders.entries()) {
      const hp = '0821' + String(posIdx).padStart(2, '0') + String(kIdx).padStart(2, '0') + '0000'
      const existing = await prisma.kader.findFirst({ where: { nomorPonsel: hp } })
      if (!existing) {
        await prisma.kader.create({
          data: {
            posyanduId: posyandu.id,
            namaLengkap: kConf.nama,
            nomorPonsel: hp,
            pinHash,
            isKetua: kConf.role === 'ketua_kader',
          },
        })
        totalKader++
      }
    }
  }
  console.log(`✓ Kader dibuat/dilewati (sudah ada): ${totalKader} baru`)

  // ---- 3. Create Warga + Balita per posyandu ----
  let totalBalita = 0
  const balitaRecords: BalitaRecord[] = []

  for (const [posIdx, entry] of POSYANDU_DATA.entries()) {
    const posyandu = posyanduList[posIdx]

    for (let balitaIdx = 0; balitaIdx < entry.targetBalita; balitaIdx++) {
      const nik = genNIK(posIdx, balitaIdx)
      const hp = genHP(posIdx, balitaIdx)
      const statusGizi = pickWeighted(STATUS_GIZI_DIST[entry.statusGroup], posIdx, balitaIdx)
      const tanggalLahir = genTanggalLahirBalita(posIdx * 1000 + balitaIdx)
      const jenisKelamin: JenisKelamin =
        balitaIdx % 2 === 0 ? JenisKelamin.laki_laki : JenisKelamin.perempuan

      // Upsert Warga (idempotent via nikIbu unique)
      const warga = await prisma.warga.upsert({
        where: { nikIbu: nik },
        update: {},
        create: {
          nikIbu: nik,
          namaLengkap: WARGA_IBU_NAMES[balitaIdx % 80],
          nomorPonsel: hp,
          passwordHash: massalHash,
          statusVerifikasi: StatusVerifikasi.terverifikasi,
          provinsi: 'DI Yogyakarta',
          kabupaten: 'Kota Yogyakarta',
          kecamatan: posyandu.kecamatan,
          kelurahan: posyandu.kelurahan,
          rw: posyandu.rw,
          rt: String(1 + (balitaIdx % 5)).padStart(3, '0'),
          posyanduUtamaId: posyandu.id,
        },
      })

      // Find or create Balita (idempotent via nikBalita)
      const balitaNik = nik.slice(0, 15) + '9'
      let balita = await prisma.balita.findFirst({ where: { nikBalita: balitaNik } })
      if (!balita) {
        balita = await prisma.balita.create({
          data: {
            wargaId: warga.id,
            nikBalita: balitaNik,
            namaBalita:
              jenisKelamin === JenisKelamin.laki_laki
                ? BALITA_NAMES_L[balitaIdx % 90]
                : BALITA_NAMES_P[balitaIdx % 90],
            tanggalLahir,
            jenisKelamin,
          },
        })
      }

      // Kumpulkan untuk loop Pemeriksaan + Imunisasi di bawah
      balitaRecords.push({ balita, statusGizi, tanggalLahir, posIdx, balitaIdx })
      totalBalita++

      // ~10% warga punya anak ke-2 (balitaIdx % 10 === 5)
      if (balitaIdx % 10 === 5) {
        const jk2: JenisKelamin = balitaIdx % 4 === 1 ? JenisKelamin.laki_laki : JenisKelamin.perempuan
        const lahir2 = new Date(tanggalLahir.getTime() + (18 + (posIdx % 12)) * 30 * 24 * 60 * 60 * 1000)
        if (lahir2 > new Date()) { /* anak ke-2 belum lahir, skip */ }
        else {
          const nik2 = genNIK(posIdx, balitaIdx + 500)
          let balita2 = await prisma.balita.findFirst({ where: { nikBalita: nik2 } })
          if (!balita2) {
            const sg2 = pickWeighted(STATUS_GIZI_DIST[entry.statusGroup], posIdx + 15, balitaIdx)
            balita2 = await prisma.balita.create({
              data: {
                wargaId: warga.id,
                nikBalita: nik2,
                namaBalita: jk2 === JenisKelamin.laki_laki
                  ? BALITA_NAMES_L[(balitaIdx + 45) % 90]
                  : BALITA_NAMES_P[(balitaIdx + 45) % 90],
                tanggalLahir: lahir2,
                jenisKelamin: jk2,
              },
            })
            balitaRecords.push({ balita: balita2, statusGizi: sg2, tanggalLahir: lahir2, posIdx, balitaIdx: balitaIdx + 500 })
            totalBalita++
          }
        }
      }
    }

    console.log('✓', entry.namaPosyandu, '—', entry.targetBalita, 'balita')
  }

  // ---- 4. Buat riwayat Pemeriksaan (12-15 bulan) per balita ----
  console.log('\n[Pemeriksaan] Membuat riwayat pemeriksaan...')
  for (const rec of balitaRecords) {
    const { balita, statusGizi, tanggalLahir, posIdx, balitaIdx } = rec
    const lookbackMonths = 18 + (posIdx + balitaIdx) % 4 // 18-21 bulan

    for (let m = lookbackMonths; m >= 0; m--) {
      // D-15: skip ~25% bulan untuk realistis (70-80% kehadiran)
      if ((posIdx + balitaIdx + m) % 4 === 0) continue
      // Posyandu Mawar (posIdx=0): jangan buat data hari ini agar demo Meja 2-3 bisa fresh
      if (m === 0 && posIdx === 0) continue

      const examDate = new Date(todayStart.getTime() - m * 30 * 24 * 60 * 60 * 1000)
      const examDateStr = examDate.toISOString().split('T')[0]
      const tanggalPemeriksaan = new Date(examDateStr)

      const ageMonthsAtExam = Math.floor(
        (examDate.getTime() - tanggalLahir.getTime()) / (30 * 24 * 60 * 60 * 1000),
      )
      if (ageMonthsAtExam < 0) continue

      // D-16: tren BB bervariasi (membaik / stabil / memburuk)
      const trendOffset =
        balitaIdx % 3 === 0
          ? (lookbackMonths - m) * 0.05  // membaik
          : balitaIdx % 3 === 2
            ? -(lookbackMonths - m) * 0.05 // memburuk
            : 0 // stabil

      const examSeed = posIdx * 10000 + balitaIdx * 100 + m
      const zs = getZScores(statusGizi, examSeed)
      const ms = getMeasurements(ageMonthsAtExam, examSeed)

      const existing = await prisma.pemeriksaan.findFirst({
        where: { balitaId: balita.id, tanggalPemeriksaan },
      })
      if (!existing) {
        await prisma.pemeriksaan.create({
          data: {
            balitaId: balita.id,
            beratBadan: Math.round((ms.beratBadan + trendOffset * 0.2) * 10) / 10,
            tinggiBadan: Math.round(ms.tinggiBadan * 10) / 10,
            zScoreBbU: Math.round((zs.zBbU + trendOffset) * 100) / 100,
            zScoreTbU: Math.round(zs.zTbU * 100) / 100,
            zScoreBbTb: Math.round(zs.zScoreBbTb * 100) / 100,
            statusGizi: statusGizi as StatusGizi,
            tanggalPemeriksaan,
          },
        })
      }
    }
  }

  // ---- 5. Buat riwayat Imunisasi dasar per balita ----
  console.log('[Imunisasi] Membuat riwayat imunisasi dasar...')
  for (const rec of balitaRecords) {
    const { balita, tanggalLahir, posIdx, balitaIdx } = rec
    const ageMonthsNow = Math.floor(
      (todayStart.getTime() - tanggalLahir.getTime()) / (30 * 24 * 60 * 60 * 1000),
    )

    for (const [vIdx, vax] of IMUNISASI_SCHEDULE.entries()) {
      if (ageMonthsNow < vax.ageMonth) continue
      // D-19: skip ~25% untuk realistis (70-80% imunisasi lengkap)
      if ((posIdx + balitaIdx + vIdx) % 4 === 3) continue

      const existing = await prisma.imunisasi.findFirst({
        where: { balitaId: balita.id, namaVaksin: vax.namaVaksin, dosisKe: vax.dosisKe },
      })
      if (!existing) {
        const injeksiDate = new Date(
          tanggalLahir.getTime() + vax.ageMonth * 30 * 24 * 60 * 60 * 1000,
        )
        await prisma.imunisasi.create({
          data: {
            balitaId: balita.id,
            namaVaksin: vax.namaVaksin,
            dosisKe: vax.dosisKe,
            tanggalInjeksi: new Date(injeksiDate.toISOString().split('T')[0]),
          },
        })
      }
    }
  }

  // ---- Summary ----
  console.log(`\n✅ seedMassal selesai — 30 posyandu, ${totalBalita} balita`)
}

// ============================================================
// STANDALONE GUARD
// ============================================================

if (require.main === module) {
  const prismaClient = new PrismaClient()
  seedMassal(prismaClient)
    .catch((e) => {
      console.error(e)
      process.exit(1)
    })
    .finally(async () => {
      await prismaClient.$disconnect()
    })
}
