/**
 * ZScoreChart — Grafik tren Z-Score balita (Meja 3: Pencatatan Klinis)
 *
 * Menampilkan 3 line series (BB/U, TB/U, BB/TB) dengan reference lines
 * di +2, 0, -2 (kuning/amber), -3 (merah) sesuai standar WHO 2006.
 *
 * Source: 03-RESEARCH.md §Pattern 9 (recharts LineChart)
 */
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  ReferenceLine,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

export interface ZScoreDataPoint {
  tanggal: string // DD/MM/YY
  bbU: number | null
  tbU: number | null
  bbTb: number | null
}

interface ZScoreChartProps {
  data: ZScoreDataPoint[]
}

function formatZScoreTick(value: unknown): string {
  return typeof value === 'number' ? String(value) : ''
}

function formatZScoreTooltip(value: unknown): string {
  return typeof value === 'number' ? value.toFixed(2) : '-'
}

export function ZScoreChart({ data }: ZScoreChartProps) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 8, right: 16, left: -16, bottom: 0 }}>
        <XAxis dataKey="tanggal" tick={{ fontSize: 11 }} />
        <YAxis
          type="number"
          domain={[-5, 5]}
          ticks={[-5, -4, -3, -2, 0, 2, 3, 4, 5]}
          tick={{ fontSize: 11 }}
          tickFormatter={formatZScoreTick}
          allowDecimals={false}
        />
        <Tooltip formatter={formatZScoreTooltip} />
        <Legend />
        {/* Reference lines untuk zona status gizi */}
        <ReferenceLine
          y={2}
          stroke="#f59e0b"
          strokeDasharray="4 2"
          label={{ value: '+2 SD', position: 'right', fontSize: 10 }}
        />
        <ReferenceLine y={0} stroke="#6b7280" strokeDasharray="4 2" />
        <ReferenceLine
          y={-2}
          stroke="#f59e0b"
          strokeDasharray="4 2"
          label={{ value: '-2 SD', position: 'right', fontSize: 10 }}
        />
        <ReferenceLine
          y={-3}
          stroke="#ef4444"
          strokeDasharray="4 2"
          label={{ value: '-3 SD', position: 'right', fontSize: 10 }}
        />
        <Line
          type="monotone"
          dataKey="bbU"
          name="BB/U"
          stroke="#10b981"
          dot={false}
          connectNulls
        />
        <Line
          type="monotone"
          dataKey="tbU"
          name="TB/U"
          stroke="#3b82f6"
          dot={false}
          connectNulls
        />
        <Line
          type="monotone"
          dataKey="bbTb"
          name="BB/TB"
          stroke="#f97316"
          dot={false}
          connectNulls
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
