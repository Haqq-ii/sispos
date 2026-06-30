import { useState, useEffect } from 'react'

/**
 * Countdown hook untuk OTP resend timer.
 * Returns { seconds, isExpired, reset } dengan interval berjalan dari initialSeconds ke 0.
 */
export function useOtpCountdown(initialSeconds = 60) {
  const [seconds, setSeconds] = useState(initialSeconds)

  useEffect(() => {
    if (seconds <= 0) return

    const interval = setInterval(() => {
      setSeconds((prev) => prev - 1)
    }, 1000)

    return () => clearInterval(interval)
  }, [seconds])

  const reset = () => setSeconds(initialSeconds)

  return {
    seconds,
    isExpired: seconds <= 0,
    reset,
  }
}
