// Shared TypeScript types mirroring backend API responses
// These are kept in sync with backend Zod schemas in src/validators/schemas.ts

import { z } from 'zod';

// ─── Zod Schemas (inferred into TypeScript types) ───────────────────────────────

export const userSchema = z.object({
  id: z.number(),
  username: z.string(),
  email: z.string().email(),
  avatar_url: z.string().optional(),
  date_of_birth: z.string().nullable(),
  is_admin: z.boolean(),
  created_at: z.string(),
});

export const topicSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().nullable(),
});

export const postSchema = z.object({
  id: z.number(),
  content: z.string(),
  author_id: z.number(),
  created_at: z.string(),
  updated_at: z.string(),
  topics: z.array(topicSchema),
  author: userSchema.nullable(),
  likes_count: z.number(),
  comments_count: z.number(),
});

export const commentSchema = z.object({
  id: z.number(),
  content: z.string(),
  post_id: z.number(),
  author_id: z.number(),
  parent_id: z.number().nullable(),
  created_at: z.string(),
  author: userSchema.nullable(),
});

export const notificationSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  type: z.string(),
  data: z.record(z.string(), z.any()),
  actor_avatar_url: z.string().nullable(),
  is_read: z.boolean(),
  created_at: z.string(),
});

// ─── Inferred Types ────────────────────────────────────────────────────────────

export type User = z.infer<typeof userSchema>;
export type Topic = z.infer<typeof topicSchema>;
export type Post = z.infer<typeof postSchema>;
export type Comment = z.infer<typeof commentSchema>;
export type Notification = z.infer<typeof notificationSchema>;

export interface UserProfile extends User {
  followers_count: number;
  following_count: number;
  posts_count: number;
}

export interface PostWithScore extends Post {
  feed_score: number;
}

export interface LikeStatus {
  liked: boolean;
}

export interface FollowStatus {
  following: boolean;
}

export interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  token_type?: string;
  expires_in?: number;
}

export interface PreferenceWithTopics {
  topics: Topic[];
}

export interface BookmarksResponse {
  posts: Post[];
  next_cursor: string | null;
}

export interface NotificationsResponse {
  notifications: Notification[];
  next_cursor: string | null;
}

export interface CursorPaginatedResponse<T> {
  items: T[];
  next_cursor: string | null;
}

export interface Report {
  id: number;
  target_type: string;
  target_id: number;
  reason: string;
  status: string;
  created_at: string;
  reporter: { id: number; username: string };
  content?: string | null;
}

export interface ReportsResponse {
  reports: Report[];
  next_cursor: string | null;
}
