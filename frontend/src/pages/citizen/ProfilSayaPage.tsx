/**
 * ProfilSayaPage - Halaman profil citizen (Figma Make WargaProfilePage).
 *
 * Route: /citizen/profil
 */
import { useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  User,
  MapPin,
  Phone,
  Shield,
  Bell,
  Lock,
  ChevronRight,
  LogOut,
  X,
  Eye,
  EyeOff,
  Download,
  FileText,
  Loader2,
} from 'lucide-react'

import { useAuthStore } from '@/stores/useAuthStore'
import { useToast } from '@/hooks/use-toast'
import apiClient from '@/lib/axios'

interface ProfilData {
  namaLengkap: string
  nikIbu: string
  nomorPonsel: string
  provinsi: string | null
  kabupaten: string | null
  kecamatan: string | null
  kelurahan: string | null
  rw: string | null
  rt: string | null
  posyanduUtama: { namaPosyandu: string } | null
}

interface PrivacyData {
  profil: {
    namaLengkap: string
    nikIbu: string
    statusVerifikasi: string
    dibuatPada: string
  }
  kontak: {
    nomorPonsel: string
    notifikasiWhatsApp: boolean
  }
  wilayah: {
    provinsi: string | null
    kabupaten: string | null
    kecamatan: string | null
    kelurahan: string | null
    rw: string | null
    rt: string | null
  }
  posyandu: { id: string; namaPosyandu: string } | null
  balita: Array<{
    id: string
    namaBalita: string
    nikBalita: string | null
    tanggalLahir: string
    jenisKelamin: string
    jumlahPemeriksaan: number
    jumlahImunisasi: number
  }>
  pemeriksaanTerakhir: Array<{
    balitaId: string
    namaBalita: string
    pemeriksaanId: string
    tanggalPemeriksaan: string
    beratBadan: number | null
    tinggiBadan: number | null
    zScoreBbU: number | null
    zScoreTbU: number | null
    zScoreBbTb: number | null
    statusGizi: string | null
    adaCatatanKonsultasi: boolean
    adaRekomendasiAi: boolean
  }>
  totalRiwayatPemeriksaan: number
  totalCatatanKonsultasi: number
}

type ActiveModal = 'notification' | 'password' | 'privacy' | null

function ModalShell({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-3 py-4">
      <div className="w-full max-w-lg max-h-[90vh] overflow-hidden rounded-t-3xl sm:rounded-3xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <h2 className="text-gray-900 font-bold text-base">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-xl p-2 text-gray-500 hover:bg-gray-50" aria-label="Tutup">
            <X size={18} />
          </button>
        </div>
        <div className="max-h-[calc(90vh-56px)] overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  )
}

function FieldLabel({ children }: { children: ReactNode }) {
  return <label className="text-xs font-semibold text-gray-600">{children}</label>
}

function DataRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <span className="text-gray-400 text-xs">{label}</span>
      <span className="text-gray-700 text-xs font-medium text-right break-words">{value}</span>
    </div>
  )
}

export default function ProfilSayaPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user, clearAuth } = useAuthStore()
  const { toast } = useToast()
  const [editingLocation, setEditingLocation] = useState(false)
  const [activeModal, setActiveModal] = useState<ActiveModal>(null)
  const [showPrivacySummary, setShowPrivacySummary] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })

  const { data: profil } = useQuery<ProfilData>({
    queryKey: ['profil', 'saya'],
    queryFn: () => apiClient.get('/users/profil').then((r) => r.data.data as ProfilData),
    staleTime: 60_000,
  })

  const { data: privacyData, isFetching: privacyLoading, refetch: refetchPrivacy } = useQuery<PrivacyData>({
    queryKey: ['profil', 'privacy-data'],
    queryFn: () => apiClient.get('/users/privacy-data').then((r) => r.data.data as PrivacyData),
    enabled: activeModal === 'privacy',
    staleTime: 60_000,
  })

  const changePasswordMutation = useMutation({
    mutationFn: async () => {
      await apiClient.patch('/auth/change-password', passwordForm)
    },
    onSuccess: () => {
      toast({ description: 'Kata sandi/PIN berhasil diubah.' })
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
      setShowPassword(false)
      setActiveModal(null)
    },
    onError: (err) => {
      const axiosErr = err as { response?: { data?: { message?: string } } }
      toast({ description: axiosErr.response?.data?.message ?? 'Gagal mengubah kata sandi/PIN.', variant: 'destructive' })
    },
  })

  const rawNik = profil?.nikIbu ?? ''
  const maskedNik = rawNik.length >= 12 ? `${rawNik.slice(0, 8)}...${rawNik.slice(-4)}` : rawNik || '-'
  const waActive = Boolean(profil?.nomorPonsel)

  async function handleLogout() {
    try {
      await apiClient.post('/auth/logout')
    } catch {
      // clear session regardless
    }
    clearAuth()
    navigate('/login', { replace: true })
  }

  function openModal(modal: ActiveModal) {
    setActiveModal(modal)
    if (modal !== 'privacy') setShowPrivacySummary(false)
  }

  function handlePasswordSubmit() {
    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      toast({ description: 'Semua field wajib diisi.', variant: 'destructive' })
      return
    }
    if (passwordForm.newPassword.length < 6) {
      toast({ description: 'Kata sandi/PIN baru minimal 6 karakter.', variant: 'destructive' })
      return
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast({ description: 'Konfirmasi kata sandi/PIN baru tidak sama.', variant: 'destructive' })
      return
    }
    changePasswordMutation.mutate()
  }

  async function handleDownloadData() {
    const result = privacyData ?? (await refetchPrivacy()).data
    if (!result) {
      toast({ description: 'Data privasi belum tersedia.', variant: 'destructive' })
      return
    }
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `sispos-data-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
    toast({ description: 'Data berhasil disiapkan untuk diunduh.' })
  }

  function closeModal() {
    setActiveModal(null)
    setShowPrivacySummary(false)
    void queryClient.invalidateQueries({ queryKey: ['profil', 'saya'] })
  }

  return (
    <div className="min-h-full bg-gray-50 pb-24 md:pb-8">
      <div className="bg-green-700 px-4 pt-10 pb-8">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate(-1)} className="bg-green-600/50 rounded-xl p-2 flex-shrink-0" aria-label="Kembali">
            <ArrowLeft size={20} className="text-white" />
          </button>
          <h1 className="text-white font-bold text-xl">Profil Saya</h1>
        </div>

        <div className="flex flex-col items-center">
          <div className="w-16 h-16 bg-white/20 rounded-2xl border-2 border-white/40 flex items-center justify-center mb-3">
            <User size={28} className="text-white" />
          </div>
          <p className="text-white font-bold text-lg text-center">{user?.namaLengkap ?? profil?.namaLengkap ?? 'Warga'}</p>
          <p className="text-green-200 text-xs mt-0.5">{maskedNik}</p>
          <div className="flex items-center gap-1.5 mt-2 bg-green-600/50 px-3 py-1 rounded-full">
            <span className="w-1.5 h-1.5 bg-green-300 rounded-full" />
            <span className="text-green-100 text-xs font-medium">Akun Terverifikasi</span>
          </div>
        </div>
      </div>

      <div className="px-4 space-y-3 mt-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <MapPin size={16} className="text-green-700" />
              <span className="text-gray-800 font-semibold text-sm">Lokasi Domisili</span>
            </div>
            <button onClick={() => setEditingLocation(!editingLocation)} className="text-green-700 text-xs font-medium">
              {editingLocation ? 'Batal' : 'Ubah'}
            </button>
          </div>

          {!editingLocation ? (
            <div className="px-4 py-3 space-y-2">
              {[
                { label: 'Provinsi', value: profil?.provinsi ?? '-' },
                { label: 'Kabupaten', value: profil?.kabupaten ?? '-' },
                { label: 'Kecamatan', value: profil?.kecamatan ?? '-' },
                { label: 'Kelurahan', value: profil?.kelurahan ?? '-' },
                { label: 'RW/RT', value: [profil?.rw, profil?.rt].filter(Boolean).join('/') || '-' },
                { label: 'Posyandu', value: profil?.posyanduUtama?.namaPosyandu ?? '-' },
              ].map((row) => (
                <DataRow key={row.label} label={row.label} value={row.value} />
              ))}
            </div>
          ) : (
            <div className="px-4 py-4 text-center">
              <p className="text-gray-500 text-sm mb-3">Fitur ini memerlukan verifikasi ulang data identitas Anda.</p>
              <button onClick={() => setEditingLocation(false)} className="w-full bg-green-700 text-white text-sm font-semibold py-2.5 rounded-xl mb-2">
                Mulai Ubah Lokasi
              </button>
              <button onClick={() => setEditingLocation(false)} className="w-full text-gray-500 text-sm py-2">Batal</button>
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
            <Phone size={16} className="text-green-700" />
            <span className="text-gray-800 font-semibold text-sm">Kontak</span>
          </div>
          <div className="px-4 py-3 space-y-2">
            <DataRow label="No. HP" value={profil?.nomorPonsel ?? '-'} />
            <DataRow label="Notifikasi WhatsApp" value={<span className={waActive ? 'text-green-700' : 'text-gray-500'}>{waActive ? 'Aktif' : 'Tidak Aktif'}</span>} />
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
            <Shield size={16} className="text-green-700" />
            <span className="text-gray-800 font-semibold text-sm">Pengaturan Akun</span>
          </div>
          <div className="divide-y divide-gray-50">
            {[
              { icon: Bell, label: 'Kelola Notifikasi', sub: 'Atur preferensi notifikasi', modal: 'notification' as const },
              { icon: Lock, label: 'Ubah Kata Sandi', sub: 'Ganti password akun', modal: 'password' as const },
              { icon: Shield, label: 'Privasi & Data', sub: 'Kelola data pribadi Anda', modal: 'privacy' as const },
            ].map((item) => {
              const Icon = item.icon
              return (
                <button key={item.label} onClick={() => openModal(item.modal)} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left">
                  <div className="w-8 h-8 bg-green-50 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Icon size={15} className="text-green-700" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-800 text-sm font-medium">{item.label}</p>
                    <p className="text-gray-400 text-xs">{item.sub}</p>
                  </div>
                  <ChevronRight size={16} className="text-gray-300 flex-shrink-0" />
                </button>
              )
            })}
          </div>
        </div>

        <button type="button" onClick={() => void handleLogout()} className="w-full py-3 bg-red-50 border border-red-200 text-red-600 rounded-2xl flex items-center justify-center gap-2 font-semibold text-sm">
          <LogOut size={16} />
          Keluar dari Akun
        </button>

        <p className="text-center text-xs text-gray-400 py-2">SISPOS v1.0 - Data dilindungi enkripsi AES-256</p>
      </div>

      {activeModal === 'notification' && (
        <ModalShell title="Kelola Notifikasi" onClose={closeModal}>
          <div className="space-y-4">
            <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 space-y-2">
              <DataRow label="Nomor WhatsApp" value={profil?.nomorPonsel ?? '-'} />
              <DataRow label="Status Notifikasi WhatsApp" value={<span className={waActive ? 'text-green-700' : 'text-gray-500'}>{waActive ? 'Aktif' : 'Tidak Aktif'}</span>} />
            </div>
            <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4">
              <p className="text-amber-800 text-sm font-semibold">Preferensi detail belum tersedia.</p>
              <p className="text-amber-700 text-xs leading-relaxed mt-1">
                Saat ini database hanya menyimpan nomor WhatsApp, belum menyimpan pilihan aktif/nonaktif per jenis notifikasi. Karena itu SISPOS hanya menampilkan status layanan WhatsApp berdasarkan nomor terdaftar dan tidak menampilkan toggle palsu.
              </p>
            </div>
            <button type="button" onClick={closeModal} className="w-full rounded-xl bg-green-700 py-2.5 text-sm font-semibold text-white">Tutup</button>
          </div>
        </ModalShell>
      )}

      {activeModal === 'password' && (
        <ModalShell title="Ubah Kata Sandi / PIN" onClose={closeModal}>
          <div className="space-y-4">
            {[
              { key: 'currentPassword' as const, label: 'Kata sandi/PIN lama' },
              { key: 'newPassword' as const, label: 'Kata sandi/PIN baru' },
              { key: 'confirmPassword' as const, label: 'Konfirmasi kata sandi/PIN baru' },
            ].map((field) => (
              <div key={field.key} className="space-y-1.5">
                <FieldLabel>{field.label}</FieldLabel>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={passwordForm[field.key]}
                    onChange={(e) => setPasswordForm((prev) => ({ ...prev, [field.key]: e.target.value }))}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-green-700"
                  />
                  <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-gray-400">
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            ))}
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={closeModal} className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-600">Batal</button>
              <button type="button" onClick={handlePasswordSubmit} disabled={changePasswordMutation.isPending} className="flex-1 rounded-xl bg-green-700 py-2.5 text-sm font-semibold text-white disabled:opacity-50 flex items-center justify-center gap-2">
                {changePasswordMutation.isPending && <Loader2 size={15} className="animate-spin" />}
                Simpan
              </button>
            </div>
          </div>
        </ModalShell>
      )}

      {activeModal === 'privacy' && (
        <ModalShell title="Privasi & Data" onClose={closeModal}>
          <div className="space-y-4">
            <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 space-y-2 text-sm text-gray-700 leading-relaxed">
              <p className="font-semibold text-gray-900">Ringkasan data yang disimpan</p>
              <ul className="list-disc pl-5 text-xs space-y-1">
                <li>Identitas akun dan kontak.</li>
                <li>Data wilayah dan Posyandu utama.</li>
                <li>Data balita yang terdaftar.</li>
                <li>Riwayat pemeriksaan, imunisasi, dan catatan konsultasi bila tersedia.</li>
              </ul>
              <p className="text-xs text-gray-500">Data digunakan untuk layanan Posyandu, dilindungi sesuai peran, dan notifikasi WhatsApp dikirim ke nomor terdaftar jika layanan aktif.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button type="button" onClick={() => setShowPrivacySummary((v) => !v)} className="rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-700 flex items-center justify-center gap-2">
                <FileText size={16} />
                {showPrivacySummary ? 'Sembunyikan Ringkasan' : 'Lihat Ringkasan Data Saya'}
              </button>
              <button type="button" onClick={() => void handleDownloadData()} className="rounded-xl bg-green-700 py-2.5 text-sm font-semibold text-white flex items-center justify-center gap-2">
                <Download size={16} />
                Unduh Data Saya
              </button>
            </div>

            {privacyLoading && <div className="flex items-center justify-center py-6 text-gray-400 text-sm"><Loader2 size={18} className="animate-spin mr-2" />Memuat data...</div>}

            {showPrivacySummary && privacyData && (
              <div className="rounded-2xl border border-green-100 bg-green-50/60 p-4 space-y-3">
                <div>
                  <p className="text-green-800 text-xs font-bold uppercase tracking-wide mb-1">Profil</p>
                  <DataRow label="Nama" value={privacyData.profil.namaLengkap} />
                  <DataRow label="NIK" value={privacyData.profil.nikIbu} />
                  <DataRow label="Status" value={privacyData.profil.statusVerifikasi} />
                </div>
                <div>
                  <p className="text-green-800 text-xs font-bold uppercase tracking-wide mb-1">Data Layanan</p>
                  <DataRow label="Balita" value={`${privacyData.balita.length} anak`} />
                  <DataRow label="Riwayat Pemeriksaan" value={privacyData.totalRiwayatPemeriksaan} />
                  <DataRow label="Catatan Konsultasi" value={privacyData.totalCatatanKonsultasi} />
                  <DataRow label="Posyandu" value={privacyData.posyandu?.namaPosyandu ?? '-'} />
                </div>
                {privacyData.balita.length > 0 && (
                  <div>
                    <p className="text-green-800 text-xs font-bold uppercase tracking-wide mb-1">Balita Terdaftar</p>
                    <div className="space-y-2">
                      {privacyData.balita.map((anak) => (
                        <div key={anak.id} className="rounded-xl bg-white/70 border border-green-100 p-3">
                          <p className="text-sm font-semibold text-gray-800">{anak.namaBalita}</p>
                          <p className="text-xs text-gray-500">{anak.jenisKelamin} - {anak.jumlahPemeriksaan} pemeriksaan - {anak.jumlahImunisasi} imunisasi</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </ModalShell>
      )}
    </div>
  )
}