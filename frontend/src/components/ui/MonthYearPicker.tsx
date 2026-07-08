/**
 * MonthYearPicker — Two-select month+year picker that returns YYYY-MM string.
 * Replaces <input type="month"> which is browser-dependent and hard to navigate for past years.
 */

interface MonthYearPickerProps {
  value: string           // YYYY-MM
  onChange: (val: string) => void
  variant?: 'default' | 'dark'  // default = light bg, dark = for green header
  yearsBack?: number      // how many past years to include (default 3)
}

const BULAN_LABELS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
  'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des',
]

export function MonthYearPicker({
  value,
  onChange,
  variant = 'default',
  yearsBack = 3,
}: MonthYearPickerProps) {
  const nowWib = new Date(Date.now() + 7 * 60 * 60 * 1000)
  const currentYear = nowWib.getUTCFullYear()

  const [yearStr, monthStr] = value.split('-')
  const selectedYear  = Number(yearStr)
  const selectedMonth = Number(monthStr)

  const years: number[] = []
  for (let y = currentYear; y >= currentYear - yearsBack; y--) {
    years.push(y)
  }

  function handleYear(e: React.ChangeEvent<HTMLSelectElement>) {
    onChange(`${e.target.value}-${monthStr}`)
  }
  function handleMonth(e: React.ChangeEvent<HTMLSelectElement>) {
    onChange(`${yearStr}-${e.target.value}`)
  }

  const baseSelect =
    variant === 'dark'
      ? 'bg-[rgba(255,255,255,0.15)] text-white border border-[rgba(255,255,255,0.3)] focus:bg-[rgba(255,255,255,0.25)] focus:outline-none rounded-[10px] px-2 py-1.5 text-xs cursor-pointer'
      : 'bg-white text-gray-700 border border-gray-200 focus:border-green-400 focus:outline-none rounded-xl px-2 py-1.5 text-xs cursor-pointer'

  return (
    <div className="flex items-center gap-1.5">
      <select value={selectedMonth} onChange={handleMonth} className={baseSelect}>
        {BULAN_LABELS.map((label, idx) => (
          <option key={idx + 1} value={idx + 1} className="bg-white text-gray-800">
            {label}
          </option>
        ))}
      </select>
      <select value={selectedYear} onChange={handleYear} className={baseSelect}>
        {years.map((y) => (
          <option key={y} value={y} className="bg-white text-gray-800">
            {y}
          </option>
        ))}
      </select>
    </div>
  )
}
