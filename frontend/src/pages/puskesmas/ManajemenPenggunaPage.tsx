/**
 * ManajemenPenggunaPage — Manajemen Kader (Puskesmas)
 * Figma: 5:14204 (Manajemen Pengguna), 5:14838 (Reset PIN), 5:15180 (Blokir)
 *
 * Fitur:
 *   - Tampilkan daftar semua kader yang berada di bawah puskesmas ini
 *   - Status badge: Terkunci / Ketua / Aktif
 *   - Tombol "Buka Kunci" untuk kader yang terkunci (MASTER_OVERRULE)
 *   - Tampilkan hitungan gagalLogin informasional
 */
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, LockKeyhole, UnlockKeyhole, UserCheck, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/hooks/use-toast'
import apiClient from '@/lib/axios'

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

  // Fetch daftar kader scoped ke puskesmas dari JWT
  const { data: kaderList, isLoading, isError } = useQuery<KaderListItem[]>({
    queryKey: ['users', 'kader'],
    queryFn: () => apiClient.get('/users/kader').then((r) => r.data.data as KaderListItem[]),
    staleTime: 30_000,
  })

  // Mutation: buka kunci kader (MASTER_OVERRULE)
  const unlockMutation = useMutation({
    mutationFn: (kaderId: string) =>
      apiClient.patch(`/users/kader/${kaderId}/unlock`).then((r) => r.data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['users', 'kader'] })
      toast({ description: 'Kader berhasil dibuka kuncinya.' })
    },
    onError: () => {
      toast({ description: 'Gagal membuka kunci. Coba lagi.', variant: 'destructive' })
    },
  })

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <Link
          to="/puskesmas/dashboard"
          className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft className="h-5 w-5 text-gray-600" />
        </Link>
        <div>
          <h1 className="text-base font-semibold text-gray-900">Manajemen Kader</h1>
          <p className="text-xs text-gray-500">Kelola status dan akses kader posyandu</p>
        </div>
      </div>

      <div className="p-4 space-y-3 max-w-2xl mx-auto">
        {/* Loading state */}
        {isLoading && (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-100 p-4">
                <Skeleton className="h-4 w-40 mb-2" />
                <Skeleton className="h-3 w-28 mb-1" />
                <Skeleton className="h-3 w-32" />
              </div>
            ))}
          </div>
        )}

        {/* Error state */}
        {isError && !isLoading && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
            <p className="text-red-600 text-sm font-medium">Gagal memuat daftar kader.</p>
            <p className="text-red-500 text-xs mt-1">Periksa koneksi dan coba lagi.</p>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !isError && kaderList?.length === 0 && (
          <div className="bg-white rounded-xl border border-gray-100 p-8 text-center">
            <UserCheck className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">Belum ada kader terdaftar</p>
            <p className="text-gray-400 text-xs mt-1">
              Kader yang terdaftar di posyandu Anda akan muncul di sini.
            </p>
          </div>
        )}

        {/* Kader list */}
        {!isLoading && !isError && kaderList && kaderList.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs text-gray-500 font-medium">
              {kaderList.length} kader terdaftar
            </p>

            {kaderList.map((kader) => {
              const locked = isLocked(kader)
              const isPendingUnlock =
                unlockMutation.isPending &&
                unlockMutation.variables === kader.id

              return (
                <div
                  key={kader.id}
                  className={`bg-white rounded-xl border p-4 transition-colors ${
                    locked ? 'border-red-200 bg-red-50/30' : 'border-gray-100'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    {/* Info kader */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm text-gray-900 truncate">
                          {kader.namaLengkap}
                        </span>

                        {/* Status badge */}
                        {locked ? (
                          <Badge variant="destructive" className="text-xs px-1.5 py-0.5 shrink-0">
                            <LockKeyhole className="h-3 w-3 mr-1" />
                            Terkunci
                          </Badge>
                        ) : kader.isKetua ? (
                          <Badge className="text-xs px-1.5 py-0.5 bg-[#008236] hover:bg-[#006b2c] shrink-0">
                            Ketua
                          </Badge>
                        ) : (
                          <Badge
                            variant="secondary"
                            className="text-xs px-1.5 py-0.5 bg-green-100 text-green-700 shrink-0"
                          >
                            Aktif
                          </Badge>
                        )}
                      </div>

                      <p className="text-xs text-gray-500 mt-0.5">{kader.nomorPonsel}</p>

                      <p className="text-xs text-gray-400 italic mt-0.5">
                        {kader.posyandu.namaPosyandu}
                      </p>

                      {/* Percobaan login gagal — informasional */}
                      {kader.gagalLogin > 0 && (
                        <p
                          className={`text-xs mt-1.5 font-medium ${
                            locked ? 'text-red-600' : 'text-amber-600'
                          }`}
                        >
                          Percobaan gagal: {kader.gagalLogin}/10
                        </p>
                      )}
                    </div>

                    {/* Tombol buka kunci */}
                    {locked && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="shrink-0 text-xs border-red-300 text-red-700 hover:bg-red-50 hover:border-red-400"
                        onClick={() => unlockMutation.mutate(kader.id)}
                        disabled={isPendingUnlock}
                      >
                        {isPendingUnlock ? (
                          <>
                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                            Membuka...
                          </>
                        ) : (
                          <>
                            <UnlockKeyhole className="h-3 w-3 mr-1" />
                            Buka Kunci
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
