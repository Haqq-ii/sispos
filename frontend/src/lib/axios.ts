import axios, { type InternalAxiosRequestConfig } from 'axios'
import { useAuthStore } from '@/stores/useAuthStore'

// Extended config to track retry state — prevents infinite refresh loop
interface RetryableRequestConfig extends InternalAxiosRequestConfig {
  _isRetry?: boolean
}

const apiClient = axios.create({
  baseURL: '/api', // Nginx proxies /api/* → sispos-backend:3000
  withCredentials: true, // Required: send JWT httpOnly cookie on every request
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
  timeout: 10_000,
})

// Separate client for refresh calls — no interceptor to avoid infinite loop
const refreshClient = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
  timeout: 10_000,
})

// Response interceptor: on 401 → try refresh → retry original request → else redirect to login
apiClient.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (
      error === null ||
      typeof error !== 'object' ||
      !('response' in error) ||
      error.response === null ||
      typeof error.response !== 'object' ||
      !('status' in error.response) ||
      error.response.status !== 401
    ) {
      return Promise.reject(error)
    }

    const originalRequest = (error as { config?: RetryableRequestConfig }).config

    // Prevent retrying the refresh request itself
    if (!originalRequest || originalRequest._isRetry) {
      useAuthStore.getState().clearAuth()
      window.location.href = '/login'
      return Promise.reject(error)
    }

    // Mark as retry to prevent loop
    originalRequest._isRetry = true

    try {
      // Attempt token refresh via the separate client
      await refreshClient.post('/auth/refresh')

      // Refresh succeeded — retry original request with new cookie
      return apiClient(originalRequest)
    } catch {
      // Refresh failed — clear session and redirect to login
      useAuthStore.getState().clearAuth()
      window.location.href = '/login'
      return Promise.reject(error)
    }
  }
)

export default apiClient
