import { Link, Navigate } from 'react-router-dom'
import {
  Activity,
  ArrowRight,
  BarChart3,
  CalendarCheck,
  Check,
  ClipboardList,
  Clock3,
  FileText,
  HeartPulse,
  MessageCircle,
  Shield,
  Smartphone,
  Sparkles,
  Stethoscope,
  TrendingDown,
  TrendingUp,
  Users,
  WifiOff,
} from 'lucide-react'
import { SisposLogo } from '@/components/brand/SisposLogo'
import { useAuthStore } from '@/stores/useAuthStore'

const impactStats = [
  { value: '85%', label: 'Pendaftaran Online' },
  { value: '30 mnt', label: 'Rata-rata Waktu Tunggu' },
  { value: '60%', label: 'Penurunan Antrian Manual' },
  { value: '90%', label: 'Laporan e-PPGBM Berhasil' },
]

const problems = [
  {
    title: 'Antrian 30-120 Menit',
    desc: 'Warga datang bersamaan tanpa sistem antrian digital, menyebabkan kerumunan dan ketidakpastian jadwal.',
    color: 'bg-red-300',
  },
  {
    title: 'Pencatatan Manual & Rawan Error',
    desc: 'Data tumbuh kembang balita dicatat di buku dan kertas, rentan hilang dan tidak bisa dianalisis real-time.',
    color: 'bg-yellow-300',
  },
  {
    title: 'Data Tidak Terintegrasi',
    desc: 'Puskesmas tidak bisa memantau tren risiko stunting secara real-time karena laporan masih dikirim manual.',
    color: 'bg-orange-300',
  },
]

const solutions = [
  {
    icon: CalendarCheck,
    title: 'Antrian Online',
    desc: 'Ambil nomor antrian dari rumah, pilih sesi pelayanan, dan pantau estimasi waktu kedatangan.',
  },
  {
    icon: ClipboardList,
    title: 'Catat di 5 Meja Digital',
    desc: 'Kader mencatat BB, TB, LILA, imunisasi, dan konsultasi dalam alur pelayanan yang rapi.',
  },
  {
    icon: HeartPulse,
    title: 'Pantau WhatsApp',
    desc: 'Orang tua mendapat pengingat, status antrian, dan ringkasan pelayanan tanpa harus bertanya manual.',
  },
  {
    icon: BarChart3,
    title: 'Dashboard Gizi & Tren',
    desc: 'Puskesmas melihat status gizi, risiko stunting, dan cakupan pemeriksaan dari satu dashboard.',
  },
  {
    icon: WifiOff,
    title: 'Offline First PWA',
    desc: 'Data pelayanan tetap bisa dicatat saat koneksi lemah, lalu disinkronkan ketika jaringan kembali.',
  },
  {
    icon: FileText,
    title: 'Keamanan Berbasis PDP',
    desc: 'Akses berbasis peran dan audit trail membantu menjaga data kesehatan tetap terkendali.',
  },
]

const steps = [
  {
    number: '01',
    title: 'Daftar Antrian',
    desc: 'Warga memilih tanggal, sesi, dan balita yang akan diperiksa dari rumah.',
  },
  {
    number: '02',
    title: 'Hadiri Antrian Online',
    desc: 'Datang sesuai estimasi waktu untuk mengurangi penumpukan di lokasi posyandu.',
  },
  {
    number: '03',
    title: 'Data Langsung Masuk',
    desc: 'Hasil pemeriksaan tersimpan untuk orang tua, kader, dan rekap puskesmas.',
  },
]

const audiences = [
  {
    icon: Smartphone,
    title: 'Warga / Orang Tua',
    items: ['Ambil nomor antrian dari rumah', 'Pantau tumbuh kembang balita', 'Konsultasi gizi dengan AI'],
    cta: 'Daftar sebagai Warga',
    to: '/register',
  },
  {
    icon: Users,
    title: 'Kader Posyandu',
    items: ['Kelola alur pelayanan 5 meja', 'Catat pemeriksaan lebih cepat', 'Rekap harian otomatis'],
    cta: 'Masuk sebagai Kader',
    to: '/login',
  },
  {
    icon: Stethoscope,
    title: 'Puskesmas',
    items: ['Pantau risiko stunting wilayah', 'Kelola jadwal dan kader', 'Ekspor laporan e-PPGBM'],
    cta: 'Masuk sebagai Puskesmas',
    to: '/login',
  },
]

const securityNotes = ['Sesuai UU PDP 2022', 'Bisa Offline', 'Tanpa Instal Aplikasi']

export default function LandingPage() {
  const { isAuthenticated, user } = useAuthStore()

  // Redirect authenticated users to their dashboard
  if (isAuthenticated && user) {
    switch (user.role) {
      case 'citizen': return <Navigate to="/citizen/dashboard" replace />
      case 'kader':
      case 'ketua_kader': return <Navigate to="/kader/dashboard" replace />
      case 'puskesmas': return <Navigate to="/puskesmas/dashboard" replace />
    }
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-white text-[#101828]">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-[#f3f4f6] bg-white/90 shadow-sm backdrop-blur">
        <div className="mx-auto flex h-[57px] w-full max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-2" aria-label="SISPOS landing page">
            <SisposLogo size={34} variant="black" className="rounded-xl" />
            <span className="text-lg font-extrabold tracking-normal text-[#016630]">SISPOS</span>
            <span className="hidden text-xs text-[#99a1af] sm:inline">Kota Cimahi</span>
          </Link>

          <nav className="hidden items-center gap-8 text-sm font-medium text-[#6a7282] lg:flex">
            <a href="#fitur" className="transition hover:text-[#008236]">Fitur</a>
            <a href="#cara-kerja" className="transition hover:text-[#008236]">Cara Kerja</a>
            <a href="#pengguna" className="transition hover:text-[#008236]">Pengguna</a>
            <a href="#tentang" className="transition hover:text-[#008236]">Tentang</a>
          </nav>

          <div className="flex items-center gap-2">
            <Link
              to="/login"
              className="rounded-[14px] px-3 py-2 text-sm font-semibold text-[#008236] transition hover:bg-[#f0fdf4] sm:px-4"
            >
              Masuk
            </Link>
            <Link
              to="/register"
              className="rounded-[14px] bg-[#008236] px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#016630] sm:px-4"
            >
              Daftar Gratis
            </Link>
          </div>
        </div>
      </header>

      <main className="pt-[57px]">
        <section className="relative bg-white">
          <div className="mx-auto grid min-h-[620px] w-full max-w-6xl items-center gap-10 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-[1fr_1fr] lg:px-8 lg:py-20">
            <div className="max-w-xl">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#b9f8cf] bg-[#f0fdf4] px-3 py-1.5 text-xs font-semibold text-[#008236]">
                <span className="h-2 w-2 rounded-full bg-[#00a63e]" />
                Progressive Web App · Offline-First
              </div>

              <h1 className="max-w-[540px] text-4xl font-extrabold leading-[1.14] text-[#101828] sm:text-5xl lg:text-5xl lg:leading-[1.2]">
                Posyandu <span className="text-[#008236]">Digital</span> untuk Generasi Sehat Indonesia
              </h1>

              <p className="mt-5 max-w-md text-base leading-[1.65] text-[#6a7282]">
                Tidak perlu antre berjam-jam. SISPOS menghadirkan antrian online posyandu,
                pemantauan tumbuh kembang balita, dan laporan kesehatan terintegrasi.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  to="/register"
                  className="inline-flex h-[54px] items-center justify-center gap-2 rounded-[14px] bg-[#008236] px-7 text-base font-semibold text-white shadow-sm transition hover:bg-[#016630]"
                >
                  Daftar Gratis
                  <ArrowRight size={16} />
                </Link>
                <Link
                  to="/login"
                  className="inline-flex h-[54px] items-center justify-center rounded-[14px] border border-[#e5e7eb] bg-white px-7 text-base font-medium text-[#4a5565] transition hover:border-[#b9f8cf] hover:text-[#008236]"
                >
                  Masuk ke Akun
                </Link>
              </div>

              <div className="mt-8 flex flex-col gap-2 text-sm text-[#99a1af] sm:flex-row sm:flex-wrap sm:gap-x-6">
                {securityNotes.map((note) => (
                  <div key={note} className="flex items-center gap-1.5">
                    <Check size={16} className="text-[#00a63e]" />
                    <span>{note}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-[516px] lg:mx-0">
              <div className="aspect-[4/3] overflow-hidden rounded-2xl bg-[#e7f8ed] shadow-lg">
                <div className="relative flex h-full w-full items-end justify-center bg-[linear-gradient(135deg,#f0fdf4_0%,#d9f99d_44%,#b9f8cf_100%)]">
                  <div className="absolute inset-x-8 top-8 h-24 rounded-full bg-white/35 blur-2xl" />
                  <div className="absolute left-10 top-10 h-20 w-20 rounded-full bg-[#008236]/10" />
                  <div className="absolute right-8 top-16 h-28 w-28 rounded-full bg-[#00a63e]/10" />
                  <div className="relative mb-10 flex h-[72%] w-[76%] items-end justify-center rounded-t-[120px] bg-white/55">
                    <div className="absolute bottom-0 h-[72%] w-[58%] rounded-t-[90px] bg-[#14532d]" />
                    <div className="absolute bottom-[18%] left-[18%] h-[36%] w-[32%] rounded-full bg-[#f6c58f]" />
                    <div className="absolute bottom-[34%] left-[26%] h-[18%] w-[18%] rounded-full bg-[#2b1b12]" />
                    <div className="absolute bottom-[12%] right-[20%] h-[30%] w-[30%] rounded-full bg-[#f1b77e]" />
                    <div className="absolute bottom-[23%] right-[29%] h-[16%] w-[16%] rounded-full bg-[#2b1b12]" />
                    <div className="absolute bottom-[5%] h-[24%] w-[78%] rounded-t-[44px] bg-white" />
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent" />
                </div>
              </div>

              <div className="absolute -bottom-5 left-3 rounded-[14px] border border-[#f3f4f6] bg-white p-3 shadow-md sm:-left-6">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-[#008236] text-xs font-extrabold text-white">
                    24
                  </div>
                  <div>
                    <p className="text-xs font-bold leading-4 text-[#1e2939]">Nomor Antrian</p>
                    <p className="text-xs leading-4 text-[#00a63e]">Sesi 09:00-10:00</p>
                  </div>
                </div>
              </div>

              <div className="absolute -top-3 right-0 rounded-[14px] border border-[#f3f4f6] bg-white p-3 shadow-md sm:-right-4">
                <div className="flex items-center gap-2">
                  <TrendingUp size={16} className="text-[#00a63e]" />
                  <div>
                    <p className="text-xs font-bold leading-4 text-[#364153]">Z-Score Normal</p>
                    <p className="text-sm font-extrabold leading-5 text-[#00a63e]">-0.5 SD</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="hidden pb-7 text-center text-xs text-[#d1d5dc] lg:block">
            <p>Gulir ke bawah</p>
            <ArrowRight size={16} className="mx-auto mt-1 rotate-90" />
          </div>
        </section>

        <section className="bg-[#008236] py-12 sm:py-14">
          <div className="mx-auto w-full max-w-5xl px-4 text-center sm:px-6 lg:px-8">
            <p className="text-xs font-semibold text-[#7bf1a8]">TARGET DAMPAK SISPOS DALAM 3 BULAN</p>
            <div className="mt-9 grid grid-cols-2 gap-7 lg:grid-cols-4">
              {impactStats.map((stat) => (
                <div key={stat.label}>
                  <p className="text-3xl font-extrabold leading-10 text-white sm:text-4xl">{stat.value}</p>
                  <p className="mt-1.5 text-xs leading-4 text-[#7bf1a8]">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="fitur" className="bg-[#f9fafb] py-16 sm:py-20">
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <span className="inline-flex rounded-full border border-[#ffe2e2] bg-[#fef2f2] px-3 py-1.5 text-xs font-semibold text-[#fb2c36]">
                MASALAH SAAT INI
              </span>
              <h2 className="mt-4 text-3xl font-extrabold leading-tight text-[#101828] sm:text-4xl">
                Sebelum SISPOS, Posyandu Penuh Hambatan
              </h2>
              <p className="mt-3 text-sm leading-5 text-[#99a1af]">
                Antrian panjang, pencatatan manual, dan data tidak terintegrasi membuat pelayanan tidak efisien.
              </p>
            </div>

            <div className="mt-12 grid gap-4 md:grid-cols-3">
              {problems.map((problem) => (
                <article key={problem.title} className="overflow-hidden rounded-2xl border border-[#f3f4f6] bg-[#f9fafb]">
                  <div className={`h-1 ${problem.color}`} />
                  <div className="p-6">
                    <h3 className="text-lg font-bold leading-7 text-[#1e2939]">{problem.title}</h3>
                    <p className="mt-2 text-sm leading-[1.65] text-[#6a7282]">{problem.desc}</p>
                  </div>
                </article>
              ))}
            </div>

            <p className="mt-12 text-center text-xs font-semibold text-[#008236]">SOLUSI SISPOS</p>

            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {solutions.map((solution) => (
                <article key={solution.title} className="rounded-[14px] border border-[#f3f4f6] bg-white p-5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-[#f0fdf4]">
                    <solution.icon size={16} className="text-[#008236]" />
                  </div>
                  <h3 className="mt-4 text-sm font-bold text-[#1e2939]">{solution.title}</h3>
                  <p className="mt-2 text-xs leading-[1.6] text-[#6a7282]">{solution.desc}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="cara-kerja" className="bg-white py-16 sm:py-20">
          <div className="mx-auto w-full max-w-5xl px-4 text-center sm:px-6 lg:px-8">
            <p className="text-xs font-semibold text-[#008236]">CARA KERJA</p>
            <h2 className="mt-3 text-3xl font-extrabold leading-tight text-[#101828]">Cukup 3 Langkah Mudah</h2>
            <p className="mt-3 text-sm text-[#99a1af]">Dari pendaftaran sampai data siap dipantau oleh puskesmas.</p>

            <div className="mt-10 grid gap-8 md:grid-cols-3">
              {steps.map((step) => (
                <article key={step.number} className="relative">
                  <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-[10px] bg-[#008236] text-xs font-extrabold text-white">
                    {step.number}
                  </div>
                  <h3 className="mt-4 text-sm font-bold text-[#1e2939]">{step.title}</h3>
                  <p className="mt-2 text-xs leading-[1.65] text-[#6a7282]">{step.desc}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="pengguna" className="bg-[#f9fafb] py-16 sm:py-20">
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-xs font-semibold text-[#99a1af]">SATU SISTEM, TIGA PERAN</p>
              <h2 className="mt-3 text-3xl font-extrabold leading-tight text-[#101828]">Dirancang untuk Semua Pihak</h2>
            </div>

            <div className="mt-10 grid gap-4 lg:grid-cols-3">
              {audiences.map((audience) => (
                <article key={audience.title} className="rounded-2xl border border-[#f3f4f6] bg-white p-6">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-[#f0fdf4]">
                      <audience.icon size={20} className="text-[#008236]" />
                    </div>
                    <h3 className="text-base font-bold text-[#1e2939]">{audience.title}</h3>
                  </div>
                  <ul className="mt-5 space-y-3">
                    {audience.items.map((item) => (
                      <li key={item} className="flex gap-2 text-sm text-[#6a7282]">
                        <Check size={16} className="mt-0.5 shrink-0 text-[#00a63e]" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                  <Link
                    to={audience.to}
                    className="mt-6 inline-flex w-full items-center justify-center rounded-[14px] bg-[#008236] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#016630]"
                  >
                    {audience.cta}
                  </Link>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="tentang" className="bg-white py-16 sm:py-20">
          <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8">
            <div className="overflow-hidden rounded-2xl bg-[#e7f8ed]">
              <div className="flex aspect-[4/3] items-center justify-center bg-[linear-gradient(135deg,#14532d_0%,#008236_55%,#86efac_100%)] p-8">
                <div className="w-full max-w-sm rounded-2xl bg-white/95 p-5 shadow-lg">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-[14px] bg-[#f0fdf4]">
                      <Activity size={24} className="text-[#008236]" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-[#1e2939]">Status Pemeriksaan</p>
                      <p className="text-xs text-[#99a1af]">Balita sehat dan terpantau</p>
                    </div>
                  </div>
                  <div className="mt-5 grid grid-cols-3 gap-3 text-center">
                    <div className="rounded-[14px] bg-[#f9fafb] p-3">
                      <p className="text-lg font-extrabold text-[#008236]">12.4</p>
                      <p className="text-[11px] text-[#99a1af]">BB kg</p>
                    </div>
                    <div className="rounded-[14px] bg-[#f9fafb] p-3">
                      <p className="text-lg font-extrabold text-[#008236]">88</p>
                      <p className="text-[11px] text-[#99a1af]">TB cm</p>
                    </div>
                    <div className="rounded-[14px] bg-[#f9fafb] p-3">
                      <p className="text-lg font-extrabold text-[#008236]">-0.5</p>
                      <p className="text-[11px] text-[#99a1af]">Z-score</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col justify-center">
              <p className="text-xs font-semibold text-[#008236]">DAMPAK UNTUK INDONESIA</p>
              <h2 className="mt-3 text-3xl font-extrabold leading-tight text-[#101828] sm:text-4xl">
                Teknologi untuk Generasi Bebas Stunting
              </h2>
              <p className="mt-4 text-sm leading-[1.75] text-[#6a7282]">
                SISPOS membantu posyandu bergerak dari pencatatan kertas menuju pelayanan digital
                yang cepat, terukur, dan bisa dipantau lintas peran.
              </p>
              <div className="mt-7 grid gap-4 sm:grid-cols-2">
                {[
                  { icon: MessageCircle, title: 'Chatbot Diagnostik Gizi' },
                  { icon: Shield, title: 'Proteksi Data Keluarga' },
                  { icon: TrendingDown, title: 'Deteksi Risiko Lebih Awal' },
                  { icon: Sparkles, title: 'Rekap Pelayanan Otomatis' },
                ].map((item) => (
                  <div key={item.title} className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-[12px] bg-[#f0fdf4]">
                      <item.icon size={18} className="text-[#008236]" />
                    </div>
                    <p className="text-sm font-semibold text-[#1e2939]">{item.title}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="bg-[#f9fafb] py-16">
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="rounded-[14px] bg-[#008236] p-6 text-white sm:p-8 lg:flex lg:items-center lg:justify-between">
              <div>
                <p className="text-sm font-extrabold">Rancang 100% Digital Hari Ini</p>
                <p className="mt-1 max-w-2xl text-xs leading-5 text-[#b9f8cf]">
                  Terapkan alur posyandu yang lebih singkat, data yang lebih rapi, dan laporan yang siap dipantau.
                </p>
              </div>
              <Link
                to="/register"
                className="mt-5 inline-flex items-center justify-center rounded-[14px] bg-white px-5 py-3 text-sm font-semibold text-[#008236] transition hover:bg-[#f0fdf4] lg:mt-0"
              >
                Coba Gratis
              </Link>
            </div>
          </div>
        </section>

        <section className="bg-white py-16">
          <div className="mx-auto w-full max-w-3xl px-4 text-center sm:px-6">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-[#f0fdf4]">
              <Clock3 size={20} className="text-[#008236]" />
            </div>
            <h2 className="mt-4 text-2xl font-extrabold text-[#101828] sm:text-3xl">
              Mulai Jadikan Posyandu Lebih Mudah & Cerdas
            </h2>
            <p className="mt-3 text-sm leading-6 text-[#99a1af]">
              Sistem yang siap digunakan warga, kader, dan puskesmas untuk pelayanan posyandu modern.
            </p>
            <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
              <Link
                to="/register"
                className="inline-flex items-center justify-center rounded-[14px] bg-[#008236] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#016630]"
              >
                Daftar Gratis
              </Link>
              <Link
                to="/login"
                className="inline-flex items-center justify-center rounded-[14px] border border-[#e5e7eb] bg-white px-6 py-3 text-sm font-semibold text-[#4a5565] transition hover:border-[#b9f8cf] hover:text-[#008236]"
              >
                Sudah punya akun? Masuk
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-[#111827] py-10 text-white">
        <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr_1fr] lg:px-8">
          <div>
            <div className="flex items-center gap-2">
              <SisposLogo size={34} variant="whiteBlack" className="rounded-xl" />
              <p className="text-sm font-extrabold">SISPOS</p>
            </div>
            <p className="mt-3 max-w-xs text-xs leading-5 text-[#99a1af]">
              Sistem informasi posyandu untuk antrian online, pencatatan kesehatan,
              pemantauan tumbuh kembang, dan laporan terintegrasi.
            </p>
          </div>
          {[
            ['Aplikasi', 'Fitur', 'Cara Kerja', 'Pengguna'],
            ['Layanan', 'Antrian Online', 'Pelayanan 5 Meja', 'Laporan e-PPGBM'],
            ['Informasi', 'Keamanan Data', 'Offline First', 'PWA'],
          ].map(([title, ...items]) => (
            <div key={title}>
              <p className="text-xs font-bold text-white">{title}</p>
              <div className="mt-3 space-y-2">
                {items.map((item) => (
                  <p key={item} className="text-xs text-[#99a1af]">{item}</p>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="mx-auto mt-8 w-full max-w-6xl border-t border-white/10 px-4 pt-6 text-xs text-[#6a7282] sm:px-6 lg:px-8">
          © 2026 SISPOS. Sistem Informasi Posyandu.
        </div>
      </footer>
    </div>
  )
}
