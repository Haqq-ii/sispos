import { Badge } from '@/components/ui/badge'

// Mirrors backend auth.service.ts detectRole — CLAUDE.md: single gateway
export function detectRole(identifier: string): 'citizen' | 'kader' | 'puskesmas' | null {
  if (/^\d{16}$/.test(identifier)) return 'citizen'
  if (/^(08|\+62)\d{7,12}$/.test(identifier)) return 'kader'
  if (/@/.test(identifier)) return 'puskesmas'
  return null
}

interface RoleBadgeProps {
  identifier: string
}

export function RoleBadge({ identifier }: RoleBadgeProps): JSX.Element | null {
  const role = detectRole(identifier)

  if (!role) return null

  const config = {
    citizen: {
      className: 'text-green-700 border-green-600',
      label: 'Warga (Citizen)',
    },
    kader: {
      className: 'text-blue-700 border-blue-600',
      label: 'Kader / Staff',
    },
    puskesmas: {
      className: 'text-purple-700 border-purple-600',
      label: 'Puskesmas',
    },
  } as const

  const { className, label } = config[role]

  return (
    <div className="opacity-0 animate-in fade-in duration-150 mt-1">
      <Badge variant="outline" className={className}>
        {label}
      </Badge>
    </div>
  )
}
