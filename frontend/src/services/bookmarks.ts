import { api } from '../lib/api'
import type { Post } from './types'

export interface BookmarksResponse {
  posts: Post[]
  next_cursor: string | null
}

export const bookmarksApi = {
  getBookmarks: async (cursor?: string, limit = 20): Promise<BookmarksResponse> => {
    const params: Record<string, string> = { limit: String(limit) }
    if (cursor !== undefined) params.cursor = String(cursor)
    const res = await api.get<BookmarksResponse>('/bookmarks', { params })
    return res.data
  },

  bookmark: async (postId: number): Promise<{ bookmarked: boolean }> => {
    const res = await api.post<{ bookmarked: boolean }>(`/bookmarks/posts/${postId}`)
    return res.data
  },

  unbookmark: async (postId: number): Promise<{ bookmarked: boolean }> => {
    const res = await api.delete<{ bookmarked: boolean }>(`/bookmarks/posts/${postId}`)
    return res.data
  },
}
