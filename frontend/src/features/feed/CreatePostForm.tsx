import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { postsApi } from '../../services/posts'
import TopicSelector from '../../components/ui/TopicSelector'
import { useToast } from '../../context/ToastContext'
import { postSchema } from '../../validators/schemas'

export default function CreatePostForm() {
  const [content, setContent] = useState('')
  const [selectedTopics, setSelectedTopics] = useState<number[]>([])
  const [fieldError, setFieldError] = useState('')
  const queryClient = useQueryClient()
  const { showToast } = useToast()

  const createMutation = useMutation({
    mutationFn: () => {
      const result = postSchema.safeParse({ content, topic_ids: selectedTopics })
      if (!result.success) {
        const msg = result.error.issues[0]?.message || 'Nội dung không hợp lệ'
        throw new Error(msg)
      }
      return postsApi.createPost(result.data.content, result.data.topic_ids || [])
    },
    onSuccess: () => {
      setContent('')
      setSelectedTopics([])
      setFieldError('')
      queryClient.invalidateQueries({ queryKey: ['feed'] })
      showToast('Bài viết đã được đăng!', 'success')
    },
    onError: (err: unknown) => {
      const msg = (err as Error).message
      if (msg.includes('bắt buộc') || msg.includes('tối đa')) {
        setFieldError(msg)
      } else {
        showToast('Đăng bài thất bại. Vui lòng thử lại.', 'error')
      }
    },
  })

  return (
    <div className="bg-white dark:bg-dark-card rounded-xl border border-gray-200 dark:border-dark-border p-4 space-y-3">
      <textarea
        value={content}
        onChange={(e) => { setContent(e.target.value); setFieldError('') }}
        placeholder="Bạn đang nghĩ gì?"
        className={`w-full resize-none border rounded-lg p-3 text-gray-900 dark:text-dark-text placeholder-gray-400 dark:placeholder-gray-500 bg-white dark:bg-dark-bg outline-none min-h-24 focus:ring-2 focus:ring-blue-500 ${
          fieldError ? 'border-red-500 focus:ring-red-500' : 'border-gray-200 dark:border-dark-border'
        }`}
        maxLength={2000}
      />
      {fieldError && (
        <p className="text-xs text-red-500 -mt-1">{fieldError}</p>
      )}

      <TopicSelector selected={selectedTopics} onChange={setSelectedTopics} />

      <div className="flex items-center justify-between">
        <span className={`text-xs ${content.length > 1800 ? 'text-orange-500' : 'text-gray-400 dark:text-dark-muted'}`}>
          {content.length}/2000
        </span>
        <button
          onClick={() => createMutation.mutate()}
          disabled={!content.trim() || createMutation.isPending}
          className="bg-blue-500 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {createMutation.isPending ? 'Đang đăng...' : 'Đăng'}
        </button>
      </div>
    </div>
  )
}
