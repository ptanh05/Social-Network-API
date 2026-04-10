import { useQuery } from '@tanstack/react-query'
import { postsApi } from '../../services/posts'
import PostCard from './PostCard'
import CreatePostForm from './CreatePostForm'

export default function FeedPage() {
  const { data: posts, isLoading, isError } = useQuery({
    queryKey: ['feed'],
    queryFn: () => postsApi.getFeed(),
    refetchOnWindowFocus: true,
  })

  return (
    <div className="space-y-4 max-w-xl mx-auto">
      <CreatePostForm />

      {isLoading && (
        <div className="text-center py-8 text-gray-400">Đang tải bảng tin...</div>
      )}

      {isError && (
        <div className="text-center py-8 text-red-400">Không thể tải bảng tin. Hãy thử lại.</div>
      )}

      {posts?.length === 0 && !isLoading && (
        <div className="text-center py-12 text-gray-400">
          <p className="text-4xl mb-3">📭</p>
          <p>Chưa có bài viết nào.</p>
          <p className="text-sm mt-1">Hãy tạo bài viết đầu tiên!</p>
        </div>
      )}

      {posts?.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}
    </div>
  )
}
