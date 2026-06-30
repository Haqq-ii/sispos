import { Router } from 'express'
import {
  registerHandler,
  otpSendHandler,
  otpVerifyHandler,
  updateLokasiHandler,
} from './auth.controller'

export const authRouter = Router()

authRouter.post('/register', registerHandler)
authRouter.post('/otp/send', otpSendHandler)
authRouter.post('/otp/verify', otpVerifyHandler)
authRouter.patch('/lokasi', updateLokasiHandler)
