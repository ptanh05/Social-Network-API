import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { authApi } from '../services/auth'
import type { User } from '../services/types'

interface AuthContextType {
  user: User | null
  accessToken: string | null
  isLoading: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => void
  register: (data: { username: string; email: string; password: string; date_of_birth?: string }) => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Restore session on app load
  useEffect(() => {
    const savedUser = sessionStorage.getItem('user')
    const bootstrap = async () => {
      const token = sessionStorage.getItem('access_token')
      if (token) {
        setAccessToken(token)
      }
      if (savedUser) {
        setUser(JSON.parse(savedUser))
      }

      try {
        const refreshed = await authApi.refresh()
        sessionStorage.setItem('access_token', refreshed.access_token)
        setAccessToken(refreshed.access_token)
        const me = await authApi.getMe()
        setUser(me)
        sessionStorage.setItem('user', JSON.stringify(me))
      } catch {
        sessionStorage.removeItem('access_token')
        sessionStorage.removeItem('user')
        setAccessToken(null)
        setUser(null)
      } finally {
        setIsLoading(false)
      }
    }

    bootstrap()
  }, [])

  const login = async (username: string, password: string) => {
    const res = await authApi.login(username, password)
    sessionStorage.setItem('access_token', res.access_token)
    setAccessToken(res.access_token)

    const me = await authApi.getMe()
    setUser(me)
    sessionStorage.setItem('user', JSON.stringify(me))
  }

  const logout = () => {
    void authApi.logout()
    sessionStorage.removeItem('access_token')
    sessionStorage.removeItem('user')
    setAccessToken(null)
    setUser(null)
    window.location.href = '/login'
  }

  const register = async (data: { username: string; email: string; password: string; date_of_birth?: string }) => {
    await authApi.register(data)
  }

  return (
    <AuthContext.Provider value={{ user, accessToken, isLoading, login, logout, register }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
