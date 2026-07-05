/**
 * AuditLogPage — Riwayat Aktivitas Sistem Posyandu (Puskesmas)
 * Figma: 5:17126
 *
 * Menampilkan paginated table audit log:
 *   - Waktu (createdAt formatted DD/MM/YYYY HH:MM)
 *   - Pengguna (userId truncated + userRole badge)
 *   - Aksi (aksi string)
 *   - Tabel (tabelTerkait)
 *   - Record ID (recordId truncated 8 chars)
 *
 * Scoped server-side ke puskesmasId (JWT) — termasuk aksi kader di bawah puskesmas ini.
 */
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, ClipboardList } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import apiClient from '@/lib/axios'

// ── Types ─────────────────────────────────────────────────────────────────────

interface AuditLogEntry {
  id: string
  userId: string
  userRole: string
  aksi: string
  tabelTerkait: string | null
  recordId: string | null
  ipAddress: string | null
  userAgent: string | null
  createdAt: string
}

interface AuditLogMeta {
  total: number
  page: number
  limit: number
  totalPages: number
}

interface AuditLogResponse {
  success: boolean
  data: AuditLogEntry[]
  meta: AuditLogMeta
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatWaktu(isoString: string): string {
  const d = new Date(isoString)
  // Format: DD/MM/YYYY HH:MM WIB (display only, no tz conversion)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  const hh = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`
}

function truncate(str: string | null, len: number): string {
  if (!str) return '-'
  return str.length > len ? `${str.substring(0, len)}…` : str
}

function getRoleBadgeStyle(role: string): string {
  switch (role) {
    case 'puskesmas':
      return 'bg-blue-100 text-blue-700 border-blue-200'
    case 'kader':
    case 'ketua_kader':
      return 'bg-green-100 text-green-700 border-green-200'
    case 'citizen':
      return 'bg-purple-100 text-purple-700 border-purple-200'
    default:
      return 'bg-gray-100 text-gray-700 border-gray-200'
  }
}

// ── AuditLogPage ──────────────────────────────────────────────────────────────

export default function AuditLogPage() {
  const [page, setPage] = useState(1)

  const { data, isLoading, isError } = useQuery<AuditLogResponse>({
    queryKey: ['audit-log', page],
    queryFn: () =>
      apiClient
        .get('/audit-log', { params: { page, limit: 20 } })
        .then((r) => r.data as AuditLogResponse),
    staleTime: 30_000,
  })

  const entries = data?.data ?? []
  const meta = data?.meta

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header — Figma 5:17126 */}
      <div className="bg-[#008236] px-5 py-6">
        <p className="text-[#7bf1a8] text-xs font-medium mb-0.5">Puskesmas</p>
        <h1 className="text-white font-bold text-xl leading-tight">Riwayat Aktivitas</h1>
        <p className="text-[#b9f8cf] text-xs mt-1">Log aktivitas kader dan sistem posyandu</p>
      </div>

      <div className="p-4 max-w-5xl mx-auto">
        {/* Loading state */}
        {isLoading && (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="bg-white rounded-lg border border-gray-100 p-3">
                <div className="flex gap-3">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-28" />
                </div>
              </div>
            ))}
            <p className="text-center text-sm text-gray-500 mt-4">Memuat audit log...</p>
          </div>
        )}

        {/* Error state */}
        {isError && !isLoading && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
            <p className="text-red-600 text-sm font-medium">Gagal memuat audit log.</p>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !isError && entries.length === 0 && (
          <div className="bg-white rounded-xl border border-gray-100 p-10 text-center">
            <ClipboardList className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">Belum ada aktivitas tercatat.</p>
            <p className="text-gray-400 text-xs mt-1">
              Aktivitas kader dan puskesmas akan muncul di sini.
            </p>
          </div>
        )}

        {/* Table */}
        {!isLoading && !isError && entries.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 whitespace-nowrap">
                      Waktu
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 whitespace-nowrap">
                      Pengguna
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 whitespace-nowrap">
                      Aksi
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 whitespace-nowrap">
                      Tabel
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 whitespace-nowrap">
                      Record ID
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry, idx) => (
                    <tr
                      key={entry.id}
                      className={`border-b border-gray-50 hover:bg-gray-50/50 transition-colors ${
                        idx === entries.length - 1 ? 'border-b-0' : ''
                      }`}
                    >
                      {/* Waktu */}
                      <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap font-mono">
                        {formatWaktu(entry.createdAt)}
                      </td>

                      {/* Pengguna */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-gray-700 font-mono">
                            {truncate(entry.userId, 8)}
                          </span>
                          <span
                            className={`text-xs px-1.5 py-0.5 rounded border font-medium ${getRoleBadgeStyle(entry.userRole)}`}
                          >
                            {entry.userRole}
                          </span>
                        </div>
                      </td>

                      {/* Aksi */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-xs font-medium text-gray-800 bg-gray-100 px-2 py-0.5 rounded font-mono">
                          {entry.aksi}
                        </span>
                      </td>

                      {/* Tabel */}
                      <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">
                        {entry.tabelTerkait ?? '-'}
                      </td>

                      {/* Record ID */}
                      <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap font-mono">
                        {truncate(entry.recordId, 8)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {meta && meta.totalPages > 1 && (
              <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between bg-gray-50">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                >
                  <ChevronLeft className="h-3.5 w-3.5 mr-1" />
                  Sebelumnya
                </Button>

                <span className="text-xs text-gray-600">
                  Halaman{' '}
                  <span className="font-semibold text-gray-900">{meta.page}</span>{' '}
                  dari{' '}
                  <span className="font-semibold text-gray-900">{meta.totalPages}</span>
                  {' '}
                  <span className="text-gray-400">({meta.total} entri)</span>
                </span>

                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
                  disabled={page >= meta.totalPages}
                >
                  Selanjutnya
                  <ChevronRight className="h-3.5 w-3.5 ml-1" />
                </Button>
              </div>
            )}

            {/* Total info jika satu halaman */}
            {meta && meta.totalPages <= 1 && (
              <div className="px-4 py-2 border-t border-gray-50 text-center">
                <span className="text-xs text-gray-400">{meta.total} entri total</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
