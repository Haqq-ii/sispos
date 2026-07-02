/**
 * voice.routes.ts — POST /api/voice/transcribe
 *
 * Security (T-03-06-01, T-03-06-04):
 *   - authMiddleware: JWT required — reject 401 without cookie
 *   - requireRole: kader/ketua_kader only — 403 for citizen/puskesmas
 *   - Multer limits fileSize 10 MB — rejects large uploads with 413 before controller
 *   - GOOGLE_APPLICATION_CREDENTIALS never exposed to client
 */
import { Router } from 'express'
import multer from 'multer'
import type { Response } from 'express'
import { authMiddleware } from '../../shared/middleware/auth.middleware'
import { requireRole } from '../../shared/middleware/require-role.middleware'
import type { AuthRequest } from '../../shared/middleware/auth.middleware'
import { transcribeAudio } from './voice.service'

export const voiceRouter = Router()

// Multer: memory storage (buffer goes straight to Google STT, no disk write)
// Threat T-03-06-01: fileSize 10 MB rejects DoS via large audio files
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
})

/**
 * POST /api/voice/transcribe
 * multipart/form-data: audio (WebM/Opus blob)
 * Returns: { success: true, data: { transcript: string } }
 */
async function transcribeHandler(req: AuthRequest, res: Response): Promise<void> {
  if (!req.file) {
    res.status(400).json({
      success: false,
      error: 'AUDIO_TIDAK_ADA',
      message: 'File audio tidak ditemukan. Sertakan field "audio" berupa file WebM/Opus.',
    })
    return
  }

  try {
    const transcript = await transcribeAudio(req.file.buffer)
    res.status(200).json({
      success: true,
      data: { transcript },
      message: 'Transkripsi berhasil.',
    })
  } catch (err) {
    const e = err as { message?: string }
    res.status(500).json({
      success: false,
      error: 'STT_ERROR',
      message: 'Gagal melakukan transkripsi audio. Coba lagi atau ketik catatan secara manual.',
    })
  }
}

// Route: POST /transcribe
// Order: authMiddleware → requireRole → multer upload → handler
voiceRouter.post(
  '/transcribe',
  authMiddleware,
  requireRole('kader', 'ketua_kader'),
  upload.single('audio'),
  transcribeHandler
)
