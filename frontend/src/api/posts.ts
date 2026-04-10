import { api } from '../lib/api'
import type { Post, PostWithScore, Topic, Comment, LikeStatus } from './types'

export const postsApi = {
  getFeed: async (skip = 0, limit = 20): Promise<PostWithScore[]> => {
    const res = await api.get<PostWithScore[]>('/posts/feed', { params: { skip, limit } })
    return res.data
  },

  getPost: async (postId: number): Promise<Post> => {
    const res = await api.get<Post>(`/posts/${postId}`)
    return res.data
  },

  createPost: async (content: string, topicIds: number[] = []): Promise<Post> => {
    const res = await api.post<Post>('/posts/', { content, topic_ids: topicIds })
    return res.data
  },

  updatePost: async (postId: number, content: string, topicIds?: number[]): Promise<Post> => {
    const res = await api.put<Post>(`/posts/${postId}`, { content, topic_ids: topicIds })
    return res.data
  },

  deletePost: async (postId: number): Promise<void> => {
    await api.delete(`/posts/${postId}`)
  },

  explore: async (topicId: number, skip = 0, limit = 20): Promise<Post[]> => {
    const res = await api.get<Post[]>('/posts/explore', { params: { topic_id: topicId, skip, limit } })
    return res.data
  },

  getTopics: async (): Promise<Topic[]> => {
    const res = await api.get<Topic[]>('/topics/')
    return res.data
  },

  getComments: async (postId: number): Promise<Comment[]> => {
    const res = await api.get<Comment[]>(`/posts/${postId}/comments/`)
    return res.data
  },

  createComment: async (postId: number, content: string, parentId?: number): Promise<Comment> => {
    const res = await api.post<Comment>(`/posts/${postId}/comments/`, { content, parent_id: parentId })
    return res.data
  },

  likePost: async (postId: number): Promise<LikeStatus> => {
    const res = await api.post<LikeStatus>(`/likes/posts/${postId}/like/`)
    return res.data
  },

  unlikePost: async (postId: number): Promise<LikeStatus> => {
    const res = await api.delete<LikeStatus>(`/likes/posts/${postId}/like/`)
    return res.data
  },
}
