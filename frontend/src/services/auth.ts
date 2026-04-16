import { api } from '../lib/api'
import type { User } from './types'

export interface AuthTokens {
  access_token: string
  token_type: string
  expires_in: number
}

export const authApi = {
  login: async (username: string, password: string): Promise<AuthTokens> => {
    const res = await api.post<AuthTokens>('/auth/login', {
      username,
      password,
    })
    return res.data
  },

  register: async (data: {
    username: string
    email: string
    password: string
    date_of_birth?: string
  }): Promise<User> => {
    const res = await api.post<User>('/auth/register', data)
    return res.data
  },

  getMe: async (): Promise<User> => {
    const res = await api.get<User>('/users/me')
    return res.data
  },

  refresh: async (): Promise<AuthTokens> => {
    const res = await api.post<AuthTokens>('/auth/refresh', {})
    return res.data
  },

  logout: async (): Promise<void> => {
    await api.post('/auth/logout', {})
  },
}