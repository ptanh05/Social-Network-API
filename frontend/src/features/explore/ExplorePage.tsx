import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { postsApi } from '../../services/posts'
import PostCard from '../feed/PostCard'
import type { Post } from '../../services/types'

export default function ExplorePage() {
  const [selectedTopicId, setSelectedTopicId] = useState<number | null>(null)

  const { data: topics } = useQuery({
    queryKey: ['topics'],
    queryFn: postsApi.getTopics,
  })

  const { data: posts, isLoading } = useQuery({
    queryKey: ['explore', selectedTopicId],
    queryFn: () => postsApi.explore(selectedTopicId!),
    enabled: selectedTopicId !== null,
  })

  return (
    <div className="space-y-4 max-w-xl mx-auto">
      <h1 className="text-xl font-bold text-gray-800">Khám phá</h1>

      {/* Topic filter */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setSelectedTopicId(null)}
          className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
            selectedTopicId === null
              ? 'bg-blue-500 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Tất cả
        </button>
        {topics?.map((t) => (
          <button
            key={t.id}
            onClick={() => setSelectedTopicId(t.id)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              selectedTopicId === t.id
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            #{t.name}
          </button>
        ))}
      </div>

      {/* Posts */}
      {selectedTopicId === null && (
        <div className="text-center py-12 text-gray-400">
          <p className="text-4xl mb-3">🔍</p>
          <p>Chọn một chủ đề để khám phá bài viết</p>
        </div>
      )}

      {isLoading && selectedTopicId !== null && (
        <div className="text-center py-8 text-gray-400">Đang tải...</div>
      )}

      {posts?.length === 0 && selectedTopicId !== null && (
        <div className="text-center py-12 text-gray-400">
          <p>Không có bài viết nào trong chủ đề này</p>
        </div>
      )}

      {posts?.map((post: Post) => (
        <PostCard key={post.id} post={{ ...post, feed_score: 0 }} />
      ))}
    </div>
  )
}
