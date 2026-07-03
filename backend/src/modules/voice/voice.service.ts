/**
 * voice.service.ts — Google Cloud Speech-to-Text integration (Meja 4)
 *
 * CLAUDE.md §STT: Google Cloud Speech-to-Text (id-ID)
 * Architecture: Non-streaming (one-shot) — kader rekam lalu stop, kirim ke backend
 *
 * Security:
 *   - GOOGLE_APPLICATION_CREDENTIALS env var path hanya ada di server
 *   - Audio blob dikirim ke Google, bukan API key ke browser
 *   - File size limit enforced oleh Multer di routes layer (max 10 MB)
 */
import pino from 'pino'
import { env } from '../../config/env'

const logger = pino({ level: env.NODE_ENV === 'production' ? 'info' : 'debug' })

/**
 * transcribeAudio — Kirim audio buffer ke Google Cloud STT dan kembalikan transcript.
 *
 * @param audioBuffer  Buffer dari Multer memoryStorage (WebM/Opus dari MediaRecorder)
 * @returns            Transcript string; empty string jika tidak ada speech terdeteksi
 *
 * Graceful degradation: jika GOOGLE_APPLICATION_CREDENTIALS tidak di-set,
 * kembalikan pesan stub agar development bisa berlanjut tanpa credentials.
 */
export async function transcribeAudio(audioBuffer: Buffer): Promise<string> {
  const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS

  if (!credPath) {
    logger.warn('GOOGLE_APPLICATION_CREDENTIALS not set — STT disabled')
    return '[STT tidak tersedia — GOOGLE_APPLICATION_CREDENTIALS belum dikonfigurasi]'
  }

  try {
    // Lazy import untuk menghindari error jika package tidak terinstall
    const { SpeechClient } = await import('@google-cloud/speech')
    const speechClient = new SpeechClient()

    const [response] = await speechClient.recognize({
      audio: {
        content: audioBuffer.toString('base64'),
      },
      config: {
        encoding: 'WEBM_OPUS' as const, // WebM/Opus dari MediaRecorder
        sampleRateHertz: 48000, // Default MediaRecorder WebM/Opus
        languageCode: 'id-ID', // CLAUDE.md §STT: id-ID
        model: 'latest_long', // Best accuracy untuk conversational Indonesian
        enableAutomaticPunctuation: true,
      },
    })

    const transcript =
      response.results
        ?.map((r) => r.alternatives?.[0]?.transcript ?? '')
        .join(' ')
        .trim() ?? ''

    logger.debug({ transcriptLength: transcript.length }, 'STT transcription complete')

    return transcript
  } catch (err) {
    logger.warn({ credPath, err }, 'STT gagal — periksa kredensial Google atau koneksi')
    return '[STT tidak tersedia — kredensial Google tidak dapat digunakan]'
  }
}
