import { Link, Navigate } from 'react-router-dom'
import { Activity, Users, CalendarCheck, MessageCircle, Shield, TrendingUp } from 'lucide-react'
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
    <div className="min-h-screen bg-[#f9fafb] flex flex-col items-center">
      <div className="w-full max-w-sm mx-auto flex flex-col">

        {/* Hero section */}
        <div className="bg-[#008236] px-4 pt-12 pb-8 flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-[rgba(255,255,255,0.2)] rounded-[20px] flex items-center justify-center mb-4">
            <Activity size={32} className="text-white" />
          </div>
          <h1 className="text-white font-bold text-2xl mb-2">SISPOS</h1>
          <p className="text-[#7bf1a8] text-sm mb-3">Sistem Informasi Posyandu</p>
          <p className="text-[rgba(255,255,255,0.8)] text-xs leading-relaxed">
            Daftar antrian online, pantau tumbuh kembang balita,
            dan konsultasi gizi dengan AI — dalam satu aplikasi.
          </p>
        </div>

        {/* CTA buttons */}
        <div className="px-4 pt-6 pb-2 flex flex-col gap-3">
          <Link
            to="/login"
            className="bg-[#008236] text-white rounded-[14px] py-3.5 w-full font-semibold text-center text-sm block"
          >
            Masuk
          </Link>
          <Link
            to="/register"
            className="bg-white border-2 border-[#008236] text-[#008236] rounded-[14px] py-3.5 w-full font-semibold text-center text-sm block"
          >
            Daftar Sekarang
          </Link>
        </div>

        {/* Features section */}
        <div className="px-4 pt-6 pb-2">
          <p className="text-[#1e2939] font-semibold text-sm mb-4">Fitur Utama</p>
          <div className="flex flex-col gap-3">
            {[
              {
                icon: CalendarCheck,
                title: 'Antrian Online',
                desc: 'Daftar antrian Posyandu dari rumah dengan estimasi waktu real-time.',
                color: '#1447e6',
              },
              {
                icon: TrendingUp,
                title: 'Tumbuh Kembang',
                desc: 'Pantau BB, TB, dan Z-Score balita dengan grafik WHO secara berkala.',
                color: '#008236',
              },
              {
                icon: MessageCircle,
                title: 'AI Assistant',
                desc: 'Tanya jawab seputar gizi dan imunisasi balita dengan AI 24/7.',
                color: '#00a63e',
              },
              {
                icon: Users,
                title: 'Multi-Profil Balita',
                desc: 'Kelola beberapa profil balita dalam satu akun keluarga.',
                color: '#f59e0b',
              },
              {
                icon: Shield,
                title: 'Deteksi Stunting Dini',
                desc: 'Sistem peringatan otomatis untuk risiko stunting berbasis Z-Score.',
                color: '#ff6900',
              },
              {
                icon: Activity,
                title: 'Pelayanan 5 Meja',
                desc: 'Digitalisasi alur pelayanan Posyandu dari pendaftaran hingga konsultasi.',
                color: '#008236',
              },
            ].map((feature) => (
              <div
                key={feature.title}
                className="bg-white border border-[#f3f4f6] rounded-2xl px-4 py-3 shadow-sm flex items-center gap-3"
              >
                <div
                  className="w-10 h-10 rounded-[14px] flex items-center justify-center shrink-0"
                  style={{ backgroundColor: feature.color + '20' }}
                >
                  <feature.icon size={20} style={{ color: feature.color }} />
                </div>
                <div>
                  <h3 className="text-[#1e2939] font-semibold text-sm">{feature.title}</h3>
                  <p className="text-[#99a1af] text-xs leading-relaxed">{feature.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Roles section — Orang Tua, Kader, Puskesmas */}
        <div className="px-4 pt-6 pb-2">
          <p className="text-[#1e2939] font-semibold text-sm mb-4">Untuk Siapa?</p>
          <div className="flex flex-col gap-3">
            {[
              {
                role: 'Warga / Orang Tua',
                desc: 'Daftar antrian, pantau tumbuh kembang, dan konsultasi gizi balita.',
                to: '/register',
                color: '#008236',
              },
              {
                role: 'Kader Posyandu',
                desc: 'Kelola pelayanan harian, catat pemeriksaan, dan monitor status gizi.',
                to: '/login',
                color: '#1447e6',
              },
              {
                role: 'Puskesmas',
                desc: 'Pantau data kesehatan, kelola jadwal, dan ekspor laporan e-PPGBM.',
                to: '/login',
                color: '#ff6900',
              },
            ].map((item) => (
              <div
                key={item.role}
                className="bg-white border border-[#f3f4f6] rounded-2xl px-4 py-4 shadow-sm"
              >
                <div className="flex items-center gap-3 mb-2">
                  <div
                    className="w-10 h-10 rounded-[14px] flex items-center justify-center shrink-0"
                    style={{ backgroundColor: item.color + '20' }}
                  >
                    <Users size={20} style={{ color: item.color }} />
                  </div>
                  <h3 className="text-[#1e2939] font-semibold text-sm">{item.role}</h3>
                </div>
                <p className="text-[#99a1af] text-xs leading-relaxed mb-3">{item.desc}</p>
                <Link
                  to={item.to}
                  className="text-xs font-semibold"
                  style={{ color: item.color }}
                >
                  Masuk →
                </Link>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-8 text-center">
          <p className="text-[#99a1af] text-xs">
            © 2026 SISPOS — Sistem Informasi Posyandu.
            <br />
            Dikembangkan untuk Indonesia Sehat.
          </p>
        </div>
      </div>
    </div>
  )
}
