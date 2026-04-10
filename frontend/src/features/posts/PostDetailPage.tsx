import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { postsApi } from '../../services/posts'
import Avatar from '../../components/ui/Avatar'
import TopicBadge from '../../components/ui/TopicBadge'
import CommentItem from './CommentItem'
import type { Comment } from '../../services/types'

function timeAgo(dateStr: string) {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diff = Math.floor((now - then) / 1000)
  if (diff < 60) return `${diff}s trước`
  if (diff < 3600) return `${Math.floor(diff / 60)}p trước`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h trước`
  return `${Math.floor(diff / 86400)}d trước`
}

export default function PostDetailPage() {
  const { postId } = useParams<{ postId: string }>()
  const queryClient = useQueryClient()
  const [commentContent, setCommentContent] = useState('')
  const [liked, setLiked] = useState(false)
  const [likeCount, setLikeCount] = useState(0)

  const { data: post, isLoading } = useQuery({
    queryKey: ['post', postId],
    queryFn: () => postsApi.getPost(Number(postId)),
  })

  const { data: comments } = useQuery({
    queryKey: ['comments', postId],
    queryFn: () => postsApi.getComments(Number(postId)),
  })

  const commentMutation = useMutation({
    mutationFn: (data: { content: string; parentId?: number }) =>
      postsApi.createComment(Number(postId), data.content, data.parentId),
    onSuccess: () => {
      setCommentContent('')
      queryClient.invalidateQueries({ queryKey: ['comments', postId] })
    },
  })

  const likeMutation = useMutation({
    mutationFn: () => liked ? postsApi.unlikePost(Number(postId)) : postsApi.likePost(Number(postId)),
    onMutate: () => {
      setLiked(!liked)
      setLikeCount((c) => c + (liked ? -1 : 1))
    },
    onError: () => {
      setLiked(liked)
    },
  })

  if (isLoading) {
    return <div className="text-center py-8 text-gray-400">Đang tải...</div>
  }

  if (!post) {
    return <div className="text-center py-8 text-red-400">Bài viết không tồn tại.</div>
  }

  const handleReply = (parentId: number, content: string) => {
    commentMutation.mutate({ content, parentId })
  }

  // Build comment tree (top-level + replies)
  const topLevel = comments?.filter((c: Comment) => !c.parent_id) || []
  const getReplies = (parentId: number) => comments?.filter((c: Comment) => c.parent_id === parentId) || []

  return (
    <div className="max-w-xl mx-auto space-y-4">
      {/* Back */}
      <Link to="/feed" className="text-sm text-blue-500 hover:underline">← Quay lại bảng tin</Link>

      {/* Post */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center gap-3 mb-3">
          {post.author && <Avatar username={post.author.username} />}
          <div>
            <Link to={`/profile/${post.author.id}`} className="font-semibold text-gray-900 hover:text-blue-500">
              {post.author.username}
            </Link>
            <div className="text-xs text-gray-400">{timeAgo(post.created_at)}</div>
          </div>
        </div>

        <p className="text-gray-800 whitespace-pre-wrap mb-3">{post.content}</p>

        {post.topics.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {post.topics.map((t) => (
              <TopicBadge key={t.id} topic={t} />
            ))}
          </div>
        )}

        <div className="flex items-center gap-4 pt-3 border-t border-gray-100">
          <button
            onClick={() => likeMutation.mutate()}
            className={`flex items-center gap-1.5 text-sm ${liked ? 'text-red-500' : 'text-gray-500 hover:text-red-400'}`}
          >
            <span>{liked ? '❤️' : '🤍'}</span>
            <span>{likeCount}</span>
          </button>
          <span className="text-sm text-gray-400">{post.comments_count} bình luận</span>
        </div>
      </div>

      {/* Comment form */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <textarea
          value={commentContent}
          onChange={(e) => setCommentContent(e.target.value)}
          placeholder="Viết bình luận..."
          className="w-full border border-gray-200 rounded-lg p-3 text-sm resize-none focus:ring-2 focus:ring-blue-500 outline-none"
          rows={3}
        />
        <div className="mt-2 flex justify-end">
          <button
            onClick={() => commentMutation.mutate({ content: commentContent })}
            disabled={!commentContent.trim() || commentMutation.isPending}
            className="bg-blue-500 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-600 disabled:opacity-50"
          >
            {commentMutation.isPending ? 'Đang gửi...' : 'Bình luận'}
          </button>
        </div>
      </div>

      {/* Comments */}
      <div className="space-y-4">
        {topLevel.map((comment: Comment) => (
          <div key={comment.id} className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
            <CommentItem comment={comment} onReply={handleReply} />
            {getReplies(comment.id).map((reply: Comment) => (
              <div key={reply.id} className="ml-10">
                <CommentItem comment={reply} onReply={handleReply} />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
