import { Link, Navigate } from 'react-router-dom'
import { Activity, Users, CalendarCheck, MessageCircle, Shield, TrendingUp, ArrowRight } from 'lucide-react'
import { useAuthStore } from '@/stores/useAuthStore'

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
    <div className="min-h-screen bg-white">
      {/* Hero section */}
      <div className="bg-[#008236] text-white">
        <div className="max-w-6xl mx-auto px-6 py-16">
          {/* Header nav */}
          <div className="flex items-center justify-between mb-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[rgba(255,255,255,0.2)] rounded-[14px] flex items-center justify-center">
                <Activity size={20} className="text-white" />
              </div>
              <span className="text-white font-extrabold text-xl">SISPOS</span>
            </div>
            <div className="flex items-center gap-3">
              <Link to="/login" className="text-[#b9f8cf] hover:text-white text-sm font-medium transition-colors">
                Masuk
              </Link>
              <Link to="/register" className="bg-white text-[#008236] px-4 py-2 rounded-[14px] text-sm font-semibold hover:bg-[#f0fdf4] transition-colors">
                Daftar Sekarang
              </Link>
            </div>
          </div>

          {/* Hero content */}
          <div className="max-w-2xl">
            <h1 className="text-4xl md:text-5xl font-extrabold leading-tight mb-4">
              Posyandu Digital<br />
              <span className="text-[#7bf1a8]">untuk Indonesia Sehat</span>
            </h1>
            <p className="text-[#b9f8cf] text-lg mb-8 leading-relaxed">
              SISPOS membantu warga mendaftar antrian online, memantau tumbuh kembang balita,
              dan berkonsultasi gizi dengan AI — semuanya dalam satu aplikasi.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Link to="/register" className="bg-white text-[#008236] font-bold px-6 py-3 rounded-2xl text-center hover:bg-[#f0fdf4] transition-colors flex items-center justify-center gap-2">
                Mulai Sekarang
                <ArrowRight size={18} />
              </Link>
              <Link to="/login" className="border border-[rgba(255,255,255,0.3)] text-white font-medium px-6 py-3 rounded-2xl text-center hover:bg-[rgba(255,255,255,0.1)] transition-colors">
                Sudah Punya Akun
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Stats section */}
      <div className="max-w-6xl mx-auto px-6 py-12">
        <p className="text-[#6a7282] text-xs font-semibold tracking-wider text-center mb-8">TARGET DAMPAK SISPOS DALAM 3 BULAN</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {[
            { value: '85%', label: 'Pendaftaran Online' },
            { value: '60%', label: 'Pengurangan Antrian' },
            { value: '40%', label: 'Deteksi Stunting Dini' },
            { value: '3x', label: 'Kecepatan Pelayanan' },
          ].map((stat) => (
            <div key={stat.label}>
              <p className="text-4xl font-extrabold text-[#008236]">{stat.value}</p>
              <p className="text-[#6a7282] text-sm mt-2">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Features section */}
      <div className="bg-[#f9fafb] py-16">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-2xl font-bold text-[#1e2939] text-center mb-3">Fitur Utama SISPOS</h2>
          <p className="text-[#99a1af] text-center mb-10">Solusi lengkap untuk digitalisasi Posyandu Indonesia</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { icon: CalendarCheck, title: 'Antrian Online', desc: 'Daftar antrian Posyandu dari rumah dengan estimasi waktu real-time.', color: '#1447e6' },
              { icon: TrendingUp, title: 'Tumbuh Kembang', desc: 'Pantau BB, TB, dan Z-Score balita dengan grafik WHO secara berkala.', color: '#008236' },
              { icon: MessageCircle, title: 'AI Konsultasi Gizi', desc: 'Tanya jawab seputar gizi dan imunisasi balita dengan AI 24/7.', color: '#00a63e' },
              { icon: Users, title: 'Multi-Profil Balita', desc: 'Kelola beberapa profil balita dalam satu akun keluarga.', color: '#f59e0b' },
              { icon: Shield, title: 'Deteksi Stunting Dini', desc: 'Sistem peringatan otomatis untuk risiko stunting berbasis Z-Score.', color: '#ff6900' },
              { icon: Activity, title: 'Pelayanan 5 Meja', desc: 'Digitalisasi alur pelayanan Posyandu dari pendaftaran hingga konsultasi.', color: '#008236' },
            ].map((feature) => (
              <div key={feature.title} className="bg-white border border-[#f3f4f6] rounded-2xl p-5 hover:shadow-md transition-shadow">
                <div className="w-10 h-10 rounded-[14px] flex items-center justify-center mb-3" style={{ backgroundColor: feature.color + '20' }}>
                  <feature.icon size={20} style={{ color: feature.color }} />
                </div>
                <h3 className="text-[#1e2939] font-semibold text-base mb-1">{feature.title}</h3>
                <p className="text-[#99a1af] text-sm leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Roles section */}
      <div className="max-w-6xl mx-auto px-6 py-16">
        <h2 className="text-2xl font-bold text-[#1e2939] text-center mb-3">Untuk Siapa?</h2>
        <p className="text-[#99a1af] text-center mb-10">Tiga peran terintegrasi dalam satu sistem</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { role: 'Warga / Orang Tua', desc: 'Daftar antrian, pantau tumbuh kembang, dan konsultasi gizi balita.', cta: 'Daftar sebagai Warga', to: '/register', color: '#008236' },
            { role: 'Kader Posyandu', desc: 'Kelola pelayanan harian, catat pemeriksaan, dan monitor status gizi.', cta: 'Login Kader', to: '/login', color: '#1447e6' },
            { role: 'Puskesmas', desc: 'Pantau data kesehatan, kelola jadwal, dan ekspor laporan e-PPGBM.', cta: 'Login Puskesmas', to: '/login', color: '#ff6900' },
          ].map((item) => (
            <div key={item.role} className="border border-[#f3f4f6] rounded-2xl p-6 text-center hover:shadow-md transition-shadow">
              <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ backgroundColor: item.color + '20' }}>
                <Users size={28} style={{ color: item.color }} />
              </div>
              <h3 className="text-[#1e2939] font-bold text-lg mb-2">{item.role}</h3>
              <p className="text-[#99a1af] text-sm mb-4 leading-relaxed">{item.desc}</p>
              <Link to={item.to} className="inline-flex items-center gap-2 text-sm font-semibold" style={{ color: item.color }}>
                {item.cta} <ArrowRight size={14} />
              </Link>
            </div>
          ))}
        </div>
      </div>

      {/* CTA section */}
      <div className="bg-[#008236] py-16">
        <div className="max-w-2xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-extrabold text-white mb-3">Mulai Gunakan SISPOS</h2>
          <p className="text-[#b9f8cf] mb-8">Daftar sekarang dan nikmati kemudahan layanan Posyandu digital.</p>
          <Link to="/register" className="bg-white text-[#008236] font-bold px-8 py-3 rounded-2xl inline-flex items-center gap-2 hover:bg-[#f0fdf4] transition-colors">
            Daftar Gratis <ArrowRight size={18} />
          </Link>
        </div>
      </div>

      {/* Footer */}
      <div className="bg-[#1e2939] text-[#99a1af] py-8">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <p className="text-sm">© 2026 SISPOS — Sistem Informasi Posyandu. Dikembangkan untuk Indonesia Sehat.</p>
        </div>
      </div>
    </div>
  )
}
