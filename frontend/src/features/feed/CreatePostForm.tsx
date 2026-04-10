import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { postsApi } from '../../services/posts'
import TopicSelector from '../../components/ui/TopicSelector'

export default function CreatePostForm() {
  const [content, setContent] = useState('')
  const [selectedTopics, setSelectedTopics] = useState<number[]>([])
  const queryClient = useQueryClient()

  const createMutation = useMutation({
    mutationFn: () => postsApi.createPost(content, selectedTopics),
    onSuccess: () => {
      setContent('')
      setSelectedTopics([])
      queryClient.invalidateQueries({ queryKey: ['feed'] })
    },
  })

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Bạn đang nghĩ gì?"
        className="w-full resize-none border border-gray-200 rounded-lg p-3 text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none min-h-24"
        maxLength={2000}
      />

      <div className="mt-3 space-y-2">
        <TopicSelector selected={selectedTopics} onChange={setSelectedTopics} />
      </div>

      <div className="mt-3 flex items-center justify-between">
        <span className="text-xs text-gray-400">{content.length}/2000</span>
        <button
          onClick={() => createMutation.mutate()}
          disabled={!content.trim() || createMutation.isPending}
          className="bg-blue-500 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {createMutation.isPending ? 'Đang đăng...' : 'Đăng'}
        </button>
      </div>

      {createMutation.isError && (
        <div className="mt-2 text-sm text-red-500">Đăng bài thất bại. Vui lòng thử lại.</div>
      )}
    </div>
  )
}
