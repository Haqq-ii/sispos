import { Router } from 'express'
import {
  registerHandler,
  otpSendHandler,
  otpVerifyHandler,
  updateLokasiHandler,
  loginHandler,
  refreshHandler,
  logoutHandler,
} from './auth.controller'

export const authRouter = Router()

authRouter.post('/register', registerHandler)
authRouter.post('/otp/send', otpSendHandler)
authRouter.post('/otp/verify', otpVerifyHandler)
authRouter.patch('/lokasi', updateLokasiHandler)

// ── Login / session ───────────────────────────────────────────────
authRouter.post('/login', loginHandler)
authRouter.post('/refresh', refreshHandler)
authRouter.post('/logout', logoutHandler)
