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

export interface UseVoiceRecorderReturn {
  isRecording: boolean
  audioBlob: Blob | null
  startRecording: () => Promise<void>
  stopRecording: () => void
}

export function useVoiceRecorder(): UseVoiceRecorderReturn {
  const [isRecording, setIsRecording] = useState(false)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)

  const startRecording = async (): Promise<void> => {
    // Reset blob dari rekaman sebelumnya
    setAudioBlob(null)

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    streamRef.current = stream

    // Cek dukungan mimeType — Safari membutuhkan audio/mp4 (03-RESEARCH.md §Pitfall 6)
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
      if (e.data.size > 0) {
        chunksRef.current.push(e.data)
      }
    }

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
      setAudioBlob(blob)
      // Stop semua tracks agar mic indicator di browser hilang
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }

    recorder.start()
    mediaRecorderRef.current = recorder
    setIsRecording(true)
  }

  const stopRecording = (): void => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
    setIsRecording(false)
  }

  return { isRecording, audioBlob, startRecording, stopRecording }
}
