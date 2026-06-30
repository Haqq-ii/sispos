import axios from 'axios'

const apiClient = axios.create({
  baseURL: '/api', // Nginx proxies /api/* → sispos-backend:3000
  withCredentials: true, // Required: send JWT httpOnly cookie on every request
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
  timeout: 10_000,
})

// Response interceptor: handle 401 → redirect to login
apiClient.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (
      error !== null &&
      typeof error === 'object' &&
      'response' in error &&
      error.response !== null &&
      typeof error.response === 'object' &&
      'status' in error.response &&
      error.response.status === 401
    ) {
      // Clear auth state and redirect to login
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default apiClient
