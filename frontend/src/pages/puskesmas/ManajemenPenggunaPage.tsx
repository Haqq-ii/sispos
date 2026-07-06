import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Shield, Unlock, AlertTriangle, CheckCircle,
  Search, Phone, Building2, X, Loader2, Key,
} from 'lucide-react'
import apiClient from '@/lib/axios'
import { useToast } from '@/hooks/use-toast'

// ── Types ─────────────────────────────────────────────────────────────────────

interface KaderListItem {
  id: string
  namaLengkap: string
  nomorPonsel: string
  isAktif: boolean
  isKetua: boolean
  gagalLogin: number
  terkunciSampai: string | null
  posyandu: { id: string; namaPosyandu: string }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isLocked(kader: KaderListItem): boolean {
  if (!kader.terkunciSampai) return false
  return new Date(kader.terkunciSampai) > new Date()
}

// ── ManajemenPenggunaPage ─────────────────────────────────────────────────────

export default function ManajemenPenggunaPage() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const [search, setSearch] = useState('')
  const [overruleTarget, setOverruleTarget] = useState<string | null>(null)
  const [resetTarget, setResetTarget] = useState<string | null>(null)
  const [newPin, setNewPin] = useState('')

  const { data: kaderList, isLoading, isError } = useQuery<KaderListItem[]>({
    queryKey: ['users', 'kader'],
    queryFn: () => apiClient.get('/users/kader').then((r) => r.data.data as KaderListItem[]),
    staleTime: 30_000,
  })

  const resetPinMutation = useMutation({
    mutationFn: ({ kaderId, pin }: { kaderId: string; pin: string }) =>
      apiClient.patch(`/users/kader/${kaderId}/reset-pin`, { newPin: pin }).then((r) => r.data),
    onSuccess: (_, { kaderId }) => {
      void queryClient.invalidateQueries({ queryKey: ['users', 'kader'] })
      const kader = kaderList?.find((k) => k.id === kaderId)
      toast({ description: `PIN ${kader?.namaLengkap ?? 'kader'} berhasil direset.` })
      setResetTarget(null)
      setNewPin('')
    },
    onError: () => {
      toast({ description: 'Gagal reset PIN. Coba lagi.', variant: 'destructive' })
    },
  })

  const unlockMutation = useMutation({
    mutationFn: (kaderId: string) =>
      apiClient.patch(`/users/kader/${kaderId}/unlock`).then((r) => r.data),
    onSuccess: (_, kaderId) => {
      void queryClient.invalidateQueries({ queryKey: ['users', 'kader'] })
      const kader = kaderList?.find((k) => k.id === kaderId)
      toast({
        description: `Akun ${kader?.namaLengkap ?? 'kader'} berhasil dibuka via Master Overrule.`,
      })
      setOverruleTarget(null)
    },
    onError: () => {
      toast({ description: 'Gagal membuka kunci. Coba lagi.', variant: 'destructive' })
      setOverruleTarget(null)
    },
  })

  const filtered = useMemo(() => {
    if (!kaderList) return []
    const q = search.toLowerCase()
    if (!q) return kaderList
    return kaderList.filter(
      (k) =>
        k.namaLengkap.toLowerCase().includes(q) ||
        k.posyandu.namaPosyandu.toLowerCase().includes(q) ||
        k.nomorPonsel.includes(q),
    )
  }, [kaderList, search])

  const lockedCount = kaderList?.filter(isLocked).length ?? 0

  const overruleKader = overruleTarget
    ? kaderList?.find((k) => k.id === overruleTarget)
    : null

  return (
    <div className="min-h-full bg-gray-50">
      {/* ── Sticky Header ──────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-100 px-6 py-4 sticky top-0 z-10 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-gray-800 font-bold text-lg">Manajemen Pengguna</h1>
            <p className="text-gray-400 text-sm">Kelola akun kader, Master Overrule, dan reset PIN</p>
          </div>
          {lockedCount > 0 && (
            <div className="flex items-center gap-2 px-4 py-2 bg-red-50 border border-red-200 rounded-xl animate-pulse">
              <AlertTriangle className="w-4 h-4 text-red-600" />
              <span className="text-red-700 text-sm font-semibold">{lockedCount} akun terkunci</span>
            </div>
          )}
        </div>
      </div>

      <div className="px-6 py-5 space-y-4 pb-8">
        {/* ── Master Overrule Banner ──────────────────────────────────────── */}
        {lockedCount > 0 && (
          <div className="p-5 bg-red-50 border border-red-200 rounded-2xl">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <Shield className="w-6 h-6 text-red-600" />
              </div>
              <div className="flex-1">
                <p className="text-red-800 font-bold">Master Overrule Diperlukan</p>
                <p className="text-red-600 text-sm mt-1">
                  {lockedCount} akun kader terkunci akibat percobaan PIN melebihi batas. Gunakan
                  tombol "Buka Akun" di bawah untuk membuka blokir dari jarak jauh.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── Search ─────────────────────────────────────────────────────── */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama kader atau posyandu..."
            className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:border-green-400 shadow-sm"
          />
        </div>

        {/* ── Loading ─────────────────────────────────────────────────────── */}
        {isLoading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-white rounded-2xl border border-gray-100 p-4 h-16 animate-pulse"
              />
            ))}
          </div>
        )}

        {/* ── Error ───────────────────────────────────────────────────────── */}
        {isError && !isLoading && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-center">
            <p className="text-red-600 text-sm font-medium">Gagal memuat daftar kader.</p>
          </div>
        )}

        {/* ── Empty ───────────────────────────────────────────────────────── */}
        {!isLoading && !isError && filtered.length === 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
            <p className="text-gray-600 text-sm font-semibold">
              {search ? 'Tidak ada kader yang cocok' : 'Belum ada kader terdaftar'}
            </p>
          </div>
        )}

        {/* ── Kader table ─────────────────────────────────────────────────── */}
        {!isLoading && !isError && filtered.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {/* Table header */}
            <div className="hidden md:grid grid-cols-12 px-5 py-3 border-b border-gray-100 text-xs text-gray-400 uppercase tracking-wider font-semibold">
              <div className="col-span-3">Nama Kader</div>
              <div className="col-span-4">Posyandu</div>
              <div className="col-span-2">Peran</div>
              <div className="col-span-1">Status</div>
              <div className="col-span-2 text-right">Aksi</div>
            </div>

            <div className="divide-y divide-gray-50">
              {filtered.map((kader) => {
                const locked = isLocked(kader)
                const isPendingUnlock =
                  unlockMutation.isPending && unlockMutation.variables === kader.id

                return (
                  <div
                    key={kader.id}
                    className={`px-5 py-4 ${locked ? 'bg-red-50/60' : ''}`}
                  >
                    {/* Desktop row */}
                    <div className="hidden md:grid grid-cols-12 items-center gap-2">
                      {/* Nama */}
                      <div className="col-span-3 flex items-center gap-3">
                        <div className="w-9 h-9 bg-gray-100 rounded-xl flex items-center justify-center flex-shrink-0">
                          <span className="text-gray-600 text-sm font-bold">
                            {kader.namaLengkap.charAt(0)}
                          </span>
                        </div>
                        <div>
                          <p className="text-gray-800 text-sm font-semibold">{kader.namaLengkap}</p>
                          <div className="flex items-center gap-1 text-gray-400 text-xs">
                            <Phone className="w-3 h-3" />
                            <span>{kader.nomorPonsel}</span>
                          </div>
                        </div>
                      </div>

                      {/* Posyandu */}
                      <div className="col-span-4">
                        <div className="flex items-center gap-1.5 text-gray-600 text-sm">
                          <Building2 className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                          <span className="truncate">{kader.posyandu.namaPosyandu}</span>
                        </div>
                      </div>

                      {/* Peran */}
                      <div className="col-span-2">
                        {kader.isKetua ? (
                          <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full font-semibold">
                            Ketua Kader
                          </span>
                        ) : (
                          <span className="text-gray-400 text-sm">Anggota</span>
                        )}
                      </div>

                      {/* Status */}
                      <div className="col-span-1">
                        {locked ? (
                          <span className="px-2 py-1 text-xs rounded-full bg-red-100 text-red-700 font-semibold animate-pulse">
                            Terkunci
                          </span>
                        ) : (
                          <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-700 font-semibold">
                            Aktif
                          </span>
                        )}
                      </div>

                      {/* Aksi */}
                      <div className="col-span-2 flex gap-1.5 justify-end flex-wrap">
                        {locked && (
                          <button
                            onClick={() => setOverruleTarget(kader.id)}
                            disabled={isPendingUnlock}
                            className="flex items-center gap-1 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs rounded-lg font-semibold disabled:opacity-50"
                          >
                            {isPendingUnlock ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Unlock className="w-3.5 h-3.5" />
                            )}
                            Buka Akun
                          </button>
                        )}
                        <button
                          onClick={() => { setResetTarget(kader.id); setNewPin('') }}
                          className="flex items-center gap-1 px-3 py-1.5 border border-gray-200 text-gray-600 hover:bg-gray-50 text-xs rounded-lg font-semibold"
                        >
                          <Key className="w-3.5 h-3.5" />
                          Reset PIN
                        </button>
                        {kader.gagalLogin > 0 && !locked && (
                          <span className="text-xs text-amber-600 font-medium self-center">
                            {kader.gagalLogin}/10 gagal
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Mobile card */}
                    <div className="md:hidden flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center flex-shrink-0">
                          <span className="text-gray-600 text-sm font-bold">
                            {kader.namaLengkap.charAt(0)}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-gray-800 text-sm font-semibold">{kader.namaLengkap}</p>
                            {locked ? (
                              <span className="px-1.5 py-0.5 bg-red-100 text-red-700 text-xs rounded-full font-semibold">
                                Terkunci
                              </span>
                            ) : kader.isKetua ? (
                              <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full font-semibold">
                                Ketua
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.5 bg-green-100 text-green-700 text-xs rounded-full font-semibold">
                                Aktif
                              </span>
                            )}
                          </div>
                          <p className="text-gray-400 text-xs mt-0.5">{kader.nomorPonsel}</p>
                          <p className="text-gray-400 text-xs italic">{kader.posyandu.namaPosyandu}</p>
                          {kader.gagalLogin > 0 && (
                            <p className={`text-xs mt-1 font-medium ${locked ? 'text-red-600' : 'text-amber-600'}`}>
                              Percobaan gagal: {kader.gagalLogin}/10
                            </p>
                          )}
                        </div>
                      </div>
                      {locked && (
                        <button
                          onClick={() => setOverruleTarget(kader.id)}
                          disabled={isPendingUnlock}
                          className="flex items-center gap-1 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs rounded-lg font-semibold shrink-0 disabled:opacity-50"
                        >
                          {isPendingUnlock ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Unlock className="w-3.5 h-3.5" />
                          )}
                          Buka
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Reset PIN Modal ──────────────────────────────────────────────── */}
      {resetTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                  <Key className="w-5 h-5 text-green-700" />
                </div>
                <p className="text-gray-800 font-bold">Reset PIN Kader</p>
              </div>
              <button
                onClick={() => { setResetTarget(null); setNewPin('') }}
                className="p-1.5 hover:bg-gray-100 rounded-lg transition"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <p className="text-sm text-gray-500 mb-1">
              PIN baru untuk{' '}
              <span className="font-semibold text-gray-700">
                {kaderList?.find((k) => k.id === resetTarget)?.namaLengkap}
              </span>:
            </p>
            <p className="text-xs text-gray-400 mb-3">Kader wajib mengubah PIN setelah login.</p>
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={newPin}
              onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
              placeholder="••••••"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-center text-2xl tracking-widest mb-4 outline-none focus:border-green-400"
            />
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => { setResetTarget(null); setNewPin('') }}
                className="py-3 border border-gray-200 text-gray-600 rounded-xl font-semibold"
              >
                Batal
              </button>
              <button
                onClick={() => resetPinMutation.mutate({ kaderId: resetTarget, pin: newPin })}
                disabled={newPin.length !== 6 || resetPinMutation.isPending}
                className="py-3 bg-green-700 hover:bg-green-800 disabled:bg-green-300 text-white rounded-xl flex items-center justify-center gap-2 font-semibold"
              >
                {resetPinMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Key className="w-4 h-4" /> Reset PIN
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Master Overrule Confirm Modal ────────────────────────────────── */}
      {overruleTarget && overruleKader && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
                  <Shield className="w-5 h-5 text-red-600" />
                </div>
                <p className="text-gray-800 font-bold">Master Overrule</p>
              </div>
              <button
                onClick={() => setOverruleTarget(null)}
                className="p-1.5 hover:bg-gray-100 rounded-lg transition"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="p-4 bg-red-50 rounded-xl border border-red-200 mb-4">
              <p className="text-red-700 text-sm">
                Anda akan membuka blokir akun{' '}
                <span className="font-bold">{overruleKader.namaLengkap}</span> dari jarak jauh.
                Akun dikunci karena percobaan PIN melebihi batas.
              </p>
            </div>

            <div className="flex items-start gap-2 mb-5">
              <CheckCircle className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
              <p className="text-gray-500 text-sm">
                Tindakan ini akan dicatat di Audit Log dan notifikasi dikirim ke kader.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setOverruleTarget(null)}
                className="py-3 border border-gray-200 text-gray-600 rounded-xl font-semibold"
              >
                Batal
              </button>
              <button
                onClick={() => unlockMutation.mutate(overruleTarget)}
                disabled={unlockMutation.isPending}
                className="py-3 bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white rounded-xl flex items-center justify-center gap-2 font-semibold"
              >
                {unlockMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Unlock className="w-4 h-4" /> Master Overrule
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
