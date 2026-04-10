// Shared TypeScript types mirroring backend Pydantic schemas

export interface User {
  id: number
  username: string
  email: string
  date_of_birth: string | null
  is_admin: boolean
  created_at: string
}

export interface UserProfile extends User {
  followers_count?: number
  following_count?: number
  posts_count?: number
}

export interface Topic {
  id: number
  name: string
  description: string | null
}

export interface Post {
  id: number
  content: string
  author_id: number
  created_at: string
  updated_at: string
  topics: Topic[]
  author: User | null
  likes_count: number
  comments_count: number
}

export interface PostWithScore extends Post {
  feed_score: number
}

export interface Comment {
  id: number
  content: string
  post_id: number
  author_id: number
  parent_id: number | null
  created_at: string
  author: User | null
}

export interface LikeStatus {
  liked: boolean
}

export interface FollowStatus {
  following: boolean
}

export interface TokenResponse {
  access_token: string
  token_type: string
}

export interface PreferenceWithTopics {
  topics: Topic[]
}
