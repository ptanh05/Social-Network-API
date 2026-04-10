import { api } from '../lib/api'
import type { User, TokenResponse } from './types'

export const authApi = {
  login: async (username: string, password: string): Promise<TokenResponse> => {
    const formData = new FormData()
    formData.append('username', username)
    formData.append('password', password)
    const res = await api.post<TokenResponse>('/auth/login', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
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
}
