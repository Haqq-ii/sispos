interface SisposLogoProps {
  size?: number
  variant?: 'whiteGreen' | 'black' | 'whiteBlack'
  className?: string
  imageClassName?: string
}

const LOGO_SRC = {
  whiteGreen: '/icons/sispos-white-green-logo.png',
  black: '/icons/logo-black.png',
  whiteBlack: '/icons/logo-white-black.png',
} as const

export function SisposLogo({
  size = 40,
  variant = 'whiteGreen',
  className = '',
  imageClassName = '',
}: SisposLogoProps) {
  return (
    <span
      className={`inline-flex shrink-0 overflow-hidden rounded-[14px] ${className}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <img
        src={LOGO_SRC[variant]}
        alt=""
        className={`h-full w-full object-cover ${imageClassName}`}
        draggable={false}
      />
    </span>
  )
}
