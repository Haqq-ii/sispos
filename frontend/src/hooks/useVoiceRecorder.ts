/**
 * useVoiceRecorder — React hook untuk merekam audio via MediaRecorder API.
 *
 * Output: WebM/Opus blob (atau MP4/AAC di Safari sebagai fallback)
 * Blob dikirim ke POST /api/voice/transcribe sebagai multipart FormData.
 *
 * Safari compatibility (03-RESEARCH.md §Pitfall 6):
 *   - Safari tidak support audio/webm;codecs=opus
 *   - Fallback ke audio/mp4 (AAC) jika WebM tidak tersedia
 *   - Jika kedua format tidak tersedia, gunakan MediaRecorder tanpa mimeType
 */
import { useState, useRef } from 'react'

const MAX_RECORDING_SECONDS = 45 // Google STT sync limit: 60s; 45s to be safe

export interface UseVoiceRecorderReturn {
  isRecording: boolean
  audioBlob: Blob | null
  secondsLeft: number | null
  startRecording: () => Promise<void>
  stopRecording: () => void
}

export function useVoiceRecorder(): UseVoiceRecorderReturn {
  const [isRecording, setIsRecording] = useState(false)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const autoStopRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearTimers = () => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (autoStopRef.current) clearTimeout(autoStopRef.current)
    timerRef.current = null
    autoStopRef.current = null
  }

  const startRecording = async (): Promise<void> => {
    setAudioBlob(null)

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    streamRef.current = stream

    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : MediaRecorder.isTypeSupported('audio/mp4')
        ? 'audio/mp4'
        : ''

    const recorder = mimeType
      ? new MediaRecorder(stream, { mimeType })
      : new MediaRecorder(stream)

    chunksRef.current = []

    recorder.ondataavailable = (e: BlobEvent) => {
      if (e.data.size > 0) chunksRef.current.push(e.data)
    }

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
      setAudioBlob(blob)
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
      clearTimers()
      setSecondsLeft(null)
    }

    recorder.start()
    mediaRecorderRef.current = recorder
    setIsRecording(true)

    // Countdown timer
    setSecondsLeft(MAX_RECORDING_SECONDS)
    let remaining = MAX_RECORDING_SECONDS
    timerRef.current = setInterval(() => {
      remaining -= 1
      setSecondsLeft(remaining)
    }, 1000)

    // Auto-stop at limit
    autoStopRef.current = setTimeout(() => {
      if (mediaRecorderRef.current?.state !== 'inactive') {
        mediaRecorderRef.current?.stop()
      }
      setIsRecording(false)
    }, MAX_RECORDING_SECONDS * 1000)
  }

  const stopRecording = (): void => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
    setIsRecording(false)
  }

  return { isRecording, audioBlob, secondsLeft, startRecording, stopRecording }
}
