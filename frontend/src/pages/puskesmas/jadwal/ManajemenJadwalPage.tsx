import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Loader2,
  LockKeyhole,
  Plus,
  Trash2,
} from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/hooks/use-toast'
import { useJadwalList, type JadwalListItem } from '@/hooks/useJadwalList'
import apiClient from '@/lib/axios'

interface PosyanduOption {
  id: string
  namaPosyandu: string
  kelurahan?: string
  wilayah?: string
  rw?: string
  jumlahBalita?: number
  _count?: { balita?: number; warga?: number }
}

interface SessionFormRow {
  id: string
  jamMulai: string
  jamSelesai: string
  kuota: number
}

const DAY_LABELS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']
const MONTH_FORMATTER = new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' })
const DATE_FORMATTER = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
const DEFAULT_SESSIONS: SessionFormRow[] = [
  { id: 'session-1', jamMulai: '08:00', jamSelesai: '09:00', kuota: 12 },
  { id: 'session-2', jamMulai: '09:00', jamSelesai: '10:00', kuota: 12 },
  { id: 'session-3', jamMulai: '10:00', jamSelesai: '11:00', kuota: 12 },
]

function toDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getJadwalDateKey(jadwal: JadwalListItem): string {
  return jadwal.tanggalPelaksanaan.slice(0, 10)
}

function formatDisplayDate(dateKey: string): string {
  return DATE_FORMATTER.format(new Date(`${dateKey}T00:00:00`))
}

function timeToMinutes(value: string): number {
  const [hour, minute] = value.split(':').map(Number)
  return hour * 60 + minute
}

function minutesToTime(value: number): string {
  const normalized = Math.max(0, Math.min(23 * 60 + 59, value))
  const hour = Math.floor(normalized / 60)
  const minute = normalized % 60
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

function buildCalendarDays(month: Date) {
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1)
  const lastDay = new Date(month.getFullYear(), month.getMonth() + 1, 0)
  const mondayFirstOffset = (firstDay.getDay() + 6) % 7
  const totalCells = Math.ceil((mondayFirstOffset + lastDay.getDate()) / 7) * 7

  return Array.from({ length: totalCells }, (_, index) => {
    const date = new Date(firstDay)
    date.setDate(firstDay.getDate() - mondayFirstOffset + index)
    return {
      date,
      dateKey: toDateKey(date),
      inMonth: date.getMonth() === month.getMonth(),
    }
  })
}

function getSlotTimeLabel(slot: NonNullable<JadwalListItem['slotSesi']>[number]): string {
  const match = slot.labelSesi?.match(/\(([^)]+)\)/)
  if (match?.[1]) return match[1].replace(/-/g, ' - ')
  return slot.labelSesi ?? `Sesi ${slot.nomorSesi ?? ''}`.trim()
}

function getLatestJadwalByPosyandu(jadwals: JadwalListItem[]) {
  const map = new Map<string, JadwalListItem>()
  for (const jadwal of jadwals) {
    const current = map.get(jadwal.posyanduId)
    if (!current || new Date(jadwal.tanggalPelaksanaan) > new Date(current.tanggalPelaksanaan)) {
      map.set(jadwal.posyanduId, jadwal)
    }
  }
  return map
}

function getMonthStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function validateSessions(sessions: SessionFormRow[]): string | null {
  if (sessions.length < 1) return 'Minimal 1 sesi wajib diisi.'
  if (sessions.length > 8) return 'Maksimal 8 sesi per jadwal.'

  const ranges = sessions.map((session, index) => {
    if (!session.jamMulai || !session.jamSelesai) return { start: 0, end: 0, index, invalid: true }
    if (!Number.isInteger(session.kuota) || session.kuota < 1) return { start: 0, end: 0, index, invalid: true }
    const start = timeToMinutes(session.jamMulai)
    const end = timeToMinutes(session.jamSelesai)
    return { start, end, index, invalid: start >= end }
  })

  const invalid = ranges.find((range) => range.invalid)
  if (invalid) return `Sesi ${invalid.index + 1} belum valid. Pastikan jam selesai lebih besar dan kuota minimal 1.`

  const sorted = [...ranges].sort((a, b) => a.start - b.start)
  for (let i = 1; i < sorted.length; i += 1) {
    if (sorted[i].start < sorted[i - 1].end) return 'Sesi tidak boleh overlap.'
  }

  return null
}

export default function ManajemenJadwalPage() {
  const [selectedPosyanduId, setSelectedPosyanduId] = useState<string | null>(null)
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null)
  const [activeMonth, setActiveMonth] = useState(() => getMonthStart(new Date()))
  const [sessions, setSessions] = useState<SessionFormRow[]>(DEFAULT_SESSIONS)

  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { data: jadwals = [], isLoading: isJadwalLoading } = useJadwalList()

  const { data: posyanduList = [], isLoading: isPosyanduLoading } = useQuery<PosyanduOption[]>({
    queryKey: ['posyandu', 'list'],
    queryFn: () => apiClient.get('/posyandu').then((r) => r.data.data as PosyanduOption[]),
    staleTime: 30_000,
  })

  const latestByPosyandu = useMemo(() => getLatestJadwalByPosyandu(jadwals), [jadwals])
  const selectedPosyandu = posyanduList.find((p) => p.id === selectedPosyanduId) ?? posyanduList[0]
  const effectivePosyanduId = selectedPosyanduId ?? selectedPosyandu?.id ?? null
  const selectedPosyanduJadwals = jadwals.filter((jadwal) => jadwal.posyanduId === effectivePosyanduId)
  const selectedDateJadwal = selectedDateKey
    ? selectedPosyanduJadwals.find((jadwal) => getJadwalDateKey(jadwal) === selectedDateKey)
    : null
  const latestSelectedJadwal = effectivePosyanduId ? latestByPosyandu.get(effectivePosyanduId) : undefined
  const displayJadwal = selectedDateKey ? selectedDateJadwal : latestSelectedJadwal
  const calendarDays = useMemo(() => buildCalendarDays(activeMonth), [activeMonth])
  const isLoading = isJadwalLoading || isPosyanduLoading
  const sessionError = validateSessions(sessions)

  const jadwalByDate = useMemo(() => {
    const map = new Map<string, JadwalListItem[]>()
    for (const jadwal of jadwals) {
      const dateKey = getJadwalDateKey(jadwal)
      const list = map.get(dateKey) ?? []
      list.push(jadwal)
      map.set(dateKey, list)
    }
    return map
  }, [jadwals])

  const selectedMonthLabel = MONTH_FORMATTER.format(activeMonth)
  const canCreateSelectedSchedule = Boolean(effectivePosyanduId && selectedDateKey && !selectedDateJadwal && !sessionError)

  const createMutation = useMutation({
    mutationFn: () => {
      if (!effectivePosyanduId || !selectedDateKey) throw new Error('Pilih posyandu dan tanggal terlebih dahulu.')
      const validationMessage = validateSessions(sessions)
      if (validationMessage) throw new Error(validationMessage)
      return apiClient.post('/jadwal', {
        posyanduId: effectivePosyanduId,
        tanggalPelaksanaan: selectedDateKey,
        sessions: sessions.map((session) => ({
          jamMulai: session.jamMulai,
          jamSelesai: session.jamSelesai,
          kuota: session.kuota,
        })),
      })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['jadwal', 'list'] })
      toast({ description: 'Jadwal berhasil disimpan.' })
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'Jadwal gagal disimpan. Pastikan tanggal belum dipakai untuk posyandu ini.'
      toast({ description: message })
    },
  })

  const handleSelectPosyandu = (posyanduId: string) => {
    setSelectedPosyanduId(posyanduId)
    const latest = latestByPosyandu.get(posyanduId)
    if (latest) {
      const dateKey = getJadwalDateKey(latest)
      setSelectedDateKey(dateKey)
      setActiveMonth(getMonthStart(new Date(`${dateKey}T00:00:00`)))
    } else {
      setSelectedDateKey(null)
      setSessions(DEFAULT_SESSIONS)
    }
  }

  const handleSelectDate = (date: Date) => {
    if (date.getMonth() !== activeMonth.getMonth()) {
      setActiveMonth(getMonthStart(date))
    }
    setSelectedDateKey(toDateKey(date))
    setSessions(DEFAULT_SESSIONS)
  }

  const moveMonth = (offset: number) => {
    setActiveMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1))
  }

  const updateSession = (id: string, field: keyof Omit<SessionFormRow, 'id'>, value: string | number) => {
    setSessions((current) =>
      current.map((session) =>
        session.id === id
          ? { ...session, [field]: field === 'kuota' ? Math.max(1, Number(value) || 1) : value }
          : session,
      ),
    )
  }

  const addSession = () => {
    setSessions((current) => {
      const lastSession = current[current.length - 1]
      const start = lastSession ? timeToMinutes(lastSession.jamSelesai) : 8 * 60
      const end = Math.min(start + 60, 23 * 60 + 59)
      return [
        ...current,
        {
          id: `session-${Date.now()}`,
          jamMulai: minutesToTime(start),
          jamSelesai: minutesToTime(end),
          kuota: lastSession?.kuota ?? 12,
        },
      ]
    })
  }

  const removeSession = (id: string) => {
    setSessions((current) => (current.length <= 1 ? current : current.filter((session) => session.id !== id)))
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-100 bg-white px-4 py-5 shadow-sm sm:px-8">
        <div>
          <h1 className="text-2xl font-bold leading-9 text-gray-900">Manajemen Jadwal Posyandu</h1>
          <p className="text-sm text-gray-400">Tetapkan tanggal pelaksanaan untuk setiap Posyandu binaan</p>
        </div>
      </header>

      <main className="px-4 py-5 sm:px-8">
        {isLoading ? (
          <div className="mx-auto grid max-w-6xl gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
            <Skeleton className="h-[420px] rounded-2xl" />
            <Skeleton className="h-[560px] rounded-2xl" />
          </div>
        ) : posyanduList.length === 0 ? (
          <div className="rounded-2xl border border-gray-100 bg-white p-10 text-center shadow-sm">
            <Building2 className="mx-auto mb-4 h-12 w-12 text-gray-300" />
            <h2 className="text-lg font-bold text-gray-500">Belum ada Posyandu binaan</h2>
            <p className="mt-1 text-sm text-gray-400">Data Posyandu belum tersedia untuk akun Puskesmas ini.</p>
          </div>
        ) : (
          <div className="mx-auto grid max-w-6xl gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
            <section className="min-w-0">
              <p className="mb-3 text-sm font-semibold text-gray-600">Pilih Posyandu</p>
              <div className="space-y-2 lg:max-h-[600px] lg:overflow-y-auto lg:pr-1">
                {posyanduList.map((posyandu) => {
                  const isSelected = posyandu.id === effectivePosyanduId
                  const latestJadwal = latestByPosyandu.get(posyandu.id)
                  const isPicked = selectedDateKey && posyandu.id === effectivePosyanduId && !selectedDateJadwal
                  const balitaCount = posyandu.jumlahBalita ?? posyandu._count?.balita ?? posyandu._count?.warga
                  const area = posyandu.wilayah ?? posyandu.kelurahan ?? posyandu.rw

                  return (
                    <button
                      key={posyandu.id}
                      type="button"
                      onClick={() => handleSelectPosyandu(posyandu.id)}
                      className={`w-full rounded-2xl border p-3.5 text-left shadow-sm transition ${
                        isSelected
                          ? 'border-[#00c950] bg-[#f0fdf4] ring-1 ring-[#00c950]'
                          : 'border-gray-200 bg-white hover:border-green-200 hover:bg-green-50/40'
                      }`}
                    >
                      <div className="flex gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[14px] bg-green-100 text-[#008236]">
                          <Building2 className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold text-gray-900">{posyandu.namaPosyandu}</p>
                          {(area || balitaCount != null) && (
                            <p className="mt-0.5 truncate text-xs font-medium text-gray-400">
                              {area}{area && balitaCount != null ? ' - ' : ''}{balitaCount != null ? `${balitaCount} balita` : ''}
                            </p>
                          )}
                          <div className="mt-2 flex items-center gap-1 text-xs font-semibold">
                            {isPicked ? (
                              <>
                                <CheckCircle2 className="h-3.5 w-3.5 text-[#008236]" />
                                <span className="text-[#008236]">Dipilih: {formatDisplayDate(selectedDateKey)}</span>
                              </>
                            ) : latestJadwal ? (
                              <>
                                <LockKeyhole className="h-3.5 w-3.5 text-[#008236]" />
                                <span className="text-[#008236]">Terjadwal: {formatDisplayDate(getJadwalDateKey(latestJadwal))}</span>
                              </>
                            ) : (
                              <>
                                <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                                <span className="text-amber-600">Belum dijadwalkan</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </section>

            <section className="min-w-0 rounded-2xl border border-gray-100 bg-white shadow-sm">
              <div className="rounded-t-2xl bg-gradient-to-r from-[#f0fdf4] to-white p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-white text-[#008236] shadow-sm">
                      <CalendarDays className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-base font-bold text-gray-900">Kalender {selectedMonthLabel}</p>
                      <p className="text-sm text-gray-500">{selectedPosyandu?.namaPosyandu ?? 'Pilih Posyandu'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button type="button" variant="outline" size="icon" className="h-9 w-9 rounded-xl" onClick={() => moveMonth(-1)}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button type="button" variant="outline" size="icon" className="h-9 w-9 rounded-xl" onClick={() => moveMonth(1)}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              <div className="p-4">
                <div className="mb-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-gray-500">
                  <span className="flex items-center gap-2"><span className="h-3 w-3 rounded bg-[#00c950]" />Tanggal dipilih</span>
                  <span className="flex items-center gap-2"><span className="h-3 w-3 rounded bg-amber-200" />Dipakai posyandu lain</span>
                  <span className="flex items-center gap-2"><span className="h-3 w-3 rounded bg-blue-100" />Jadwal posyandu ini</span>
                </div>

                <div className="grid grid-cols-7 gap-1 text-center sm:gap-1.5">
                  {DAY_LABELS.map((day) => (
                    <div key={day} className="py-1.5 text-xs font-semibold text-gray-400">{day}</div>
                  ))}
                  {calendarDays.map(({ date, dateKey, inMonth }) => {
                    const dayJadwals = jadwalByDate.get(dateKey) ?? []
                    const usedBySelected = dayJadwals.some((jadwal) => jadwal.posyanduId === effectivePosyanduId)
                    const usedByOther = dayJadwals.some((jadwal) => jadwal.posyanduId !== effectivePosyanduId)
                    const isSelectedDate = selectedDateKey === dateKey

                    return (
                      <button
                        key={dateKey}
                        type="button"
                        onClick={() => handleSelectDate(date)}
                        className={`relative flex aspect-square min-h-9 items-center justify-center rounded-xl text-sm transition sm:min-h-11 ${
                          isSelectedDate
                            ? 'bg-[#00a63e] font-bold text-white shadow-md shadow-green-200'
                            : usedBySelected
                              ? 'bg-blue-50 font-semibold text-[#008236] ring-1 ring-blue-100'
                              : usedByOther
                                ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-100'
                                : inMonth
                                  ? 'text-gray-700 hover:bg-green-50'
                                  : 'text-gray-300'
                        }`}
                      >
                        {date.getDate()}
                        {(usedBySelected || usedByOther) && !isSelectedDate && (
                          <span className={`absolute bottom-1 h-1.5 w-1.5 rounded-full ${usedBySelected ? 'bg-[#008236]' : 'bg-amber-500'}`} />
                        )}
                      </button>
                    )
                  })}
                </div>

                <div className="mt-4 rounded-2xl border border-gray-100 bg-gray-50 p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-sm font-bold text-gray-700">Konfigurasi Sesi Jam</p>
                      <p className="mt-1 text-xs text-gray-400">
                        {displayJadwal
                          ? `Jadwal ${formatDisplayDate(getJadwalDateKey(displayJadwal))}`
                          : selectedDateKey
                            ? `Rencana jadwal ${formatDisplayDate(selectedDateKey)}`
                            : 'Pilih tanggal untuk membuat jadwal'}
                      </p>
                    </div>
                    {!displayJadwal && selectedDateKey && (
                      <Button type="button" variant="outline" size="sm" className="rounded-xl" onClick={addSession} disabled={sessions.length >= 8}>
                        <Plus className="mr-1.5 h-4 w-4" />
                        Tambah Sesi
                      </Button>
                    )}
                  </div>

                  <div className="mt-4 space-y-3">
                    {displayJadwal?.slotSesi?.length ? (
                      displayJadwal.slotSesi.map((slot) => (
                        <div key={slot.id} className="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2.5">
                          <div className="flex min-w-0 items-center gap-2 text-sm text-gray-600">
                            <Clock3 className="h-4 w-4 shrink-0 text-gray-400" />
                            <span className="truncate">{getSlotTimeLabel(slot)}</span>
                          </div>
                          <div className="shrink-0 rounded-xl border border-gray-200 bg-white px-3 py-1 text-sm text-gray-700">
                            {slot.terisi}/{slot.kuota}
                          </div>
                        </div>
                      ))
                    ) : selectedDateKey ? (
                      sessions.map((session, index) => (
                        <div key={session.id} className="grid gap-2 rounded-xl bg-white p-3 sm:grid-cols-[1fr_1fr_90px_36px] sm:items-end">
                          <label className="text-xs font-medium text-gray-500">
                            Mulai
                            <input
                              type="time"
                              value={session.jamMulai}
                              onChange={(event) => updateSession(session.id, 'jamMulai', event.target.value)}
                              className="mt-1 h-10 w-full rounded-xl border border-gray-200 px-3 text-sm text-gray-700 outline-none focus:border-[#00a63e]"
                            />
                          </label>
                          <label className="text-xs font-medium text-gray-500">
                            Selesai
                            <input
                              type="time"
                              value={session.jamSelesai}
                              onChange={(event) => updateSession(session.id, 'jamSelesai', event.target.value)}
                              className="mt-1 h-10 w-full rounded-xl border border-gray-200 px-3 text-sm text-gray-700 outline-none focus:border-[#00a63e]"
                            />
                          </label>
                          <label className="text-xs font-medium text-gray-500">
                            Kuota
                            <input
                              type="number"
                              min={1}
                              max={200}
                              value={session.kuota}
                              onChange={(event) => updateSession(session.id, 'kuota', Number(event.target.value))}
                              className="mt-1 h-10 w-full rounded-xl border border-gray-200 px-3 text-sm text-gray-700 outline-none focus:border-[#00a63e]"
                            />
                          </label>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-10 w-10 rounded-xl text-red-500 hover:bg-red-50 hover:text-red-600"
                            onClick={() => removeSession(session.id)}
                            disabled={sessions.length <= 1}
                            aria-label={`Hapus sesi ${index + 1}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-xl bg-white p-4 text-sm text-gray-400">Belum ada tanggal yang dipilih.</div>
                    )}
                  </div>

                  {!displayJadwal && selectedDateKey && sessionError && (
                    <p className="mt-3 text-xs font-medium text-red-500">{sessionError}</p>
                  )}

                  <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
                    {displayJadwal ? (
                      <p className="text-xs text-gray-400">Jadwal sudah ada. Update jadwal belum didukung endpoint saat ini.</p>
                    ) : selectedDateKey ? (
                      <Button
                        type="button"
                        disabled={!canCreateSelectedSchedule || createMutation.isPending}
                        onClick={() => createMutation.mutate()}
                        className="rounded-xl bg-[#008236] text-white hover:bg-[#00a63e]"
                      >
                        {createMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Simpan Jadwal
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  )
}
