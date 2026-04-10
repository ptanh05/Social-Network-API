import { api } from './lib/api'
import type { User, UserProfile, FollowStatus, PreferenceWithTopics } from './types'

export const usersApi = {
  getUser: async (userId: number): Promise<User> => {
    const res = await api.get<User>(`/users/${userId}`)
    return res.data
  },

  getUserProfile: async (userId: number): Promise<UserProfile> => {
    const res = await api.get<UserProfile>(`/users/${userId}/profile`)
    return res.data
  },

  updateMe: async (data: { username?: string; date_of_birth?: string }): Promise<User> => {
    const res = await api.put<User>('/users/me', data)
    return res.data
  },

  followUser: async (userId: number): Promise<FollowStatus> => {
    const res = await api.post<FollowStatus>(`/follows/users/${userId}/follow/`)
    return res.data
  },

  unfollowUser: async (userId: number): Promise<FollowStatus> => {
    const res = await api.delete<FollowStatus>(`/follows/users/${userId}/follow/`)
    return res.data
  },

  getPreferences: async (): Promise<PreferenceWithTopics> => {
    const res = await api.get<PreferenceWithTopics>('/preferences/users/me/preferences')
    return res.data
  },

  updatePreferences: async (topicIds: number[]): Promise<PreferenceWithTopics> => {
    const res = await api.put<PreferenceWithTopics>('/preferences/users/me/preferences', { topic_ids: topicIds })
    return res.data
  },
}
