import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { postsApi } from '../../api/posts'
import type { PostWithScore } from '../../api/types'
import Avatar from '../../components/ui/Avatar'
import TopicBadge from '../../components/ui/TopicBadge'

interface PostCardProps {
  post: PostWithScore
}

function timeAgo(dateStr: string) {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diff = Math.floor((now - then) / 1000)
  if (diff < 60) return `${diff}s trước`
  if (diff < 3600) return `${Math.floor(diff / 60)}p trước`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h trước`
  return `${Math.floor(diff / 86400)}d trước`
}

export default function PostCard({ post }: PostCardProps) {
  const queryClient = useQueryClient()
  const [liked, setLiked] = useState(false)
  const [likeCount, setLikeCount] = useState(post.likes_count)

  const likeMutation = useMutation({
    mutationFn: () => liked ? postsApi.unlikePost(post.id) : postsApi.likePost(post.id),
    onMutate: () => {
      setLiked(!liked)
      setLikeCount((c) => c + (liked ? -1 : 1))
    },
    onError: () => {
      setLiked(liked)
      setLikeCount(likeCount)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['feed'] })
    },
  })

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-3">
        {post.author && (
          <Link to={`/profile/${post.author.id}`}>
            <Avatar username={post.author.username} />
          </Link>
        )}
        <div className="flex-1 min-w-0">
          {post.author && (
            <Link to={`/profile/${post.author.id}`} className="font-semibold text-gray-900 hover:text-blue-500">
              {post.author.username}
            </Link>
          )}
          <div className="text-xs text-gray-400">{timeAgo(post.created_at)}</div>
        </div>
        {post.feed_score > 0 && (
          <span className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded-full">
            {post.feed_score === 3 ? '⭐ For You' : post.feed_score === 2 ? '🏷️ Phù hợp' : '👥 Follow'}
          </span>
        )}
      </div>

      {/* Content */}
      <Link to={`/posts/${post.id}`} className="block">
        <p className="text-gray-800 whitespace-pre-wrap break-words">{post.content}</p>
      </Link>

      {/* Topics */}
      {post.topics.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {post.topics.map((t) => (
            <TopicBadge key={t.id} topic={t} />
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-4 pt-1 border-t border-gray-100">
        <button
          onClick={() => likeMutation.mutate()}
          disabled={likeMutation.isPending}
          className={`flex items-center gap-1.5 text-sm transition-colors ${
            liked ? 'text-red-500' : 'text-gray-500 hover:text-red-400'
          }`}
        >
          <span>{liked ? '❤️' : '🤍'}</span>
          <span>{likeCount}</span>
        </button>

        <Link
          to={`/posts/${post.id}`}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-blue-500 transition-colors"
        >
          <span>💬</span>
          <span>{post.comments_count}</span>
        </Link>
      </div>
    </div>
  )
}
