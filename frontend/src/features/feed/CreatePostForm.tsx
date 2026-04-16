import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { postsApi } from '../../services/posts'
import TopicSelector from '../../components/ui/TopicSelector'
import { useToast } from '../../context/ToastContext'
import { postSchema } from '../../validators/schemas'

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}

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
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="bg-white dark:bg-dark-card rounded-xl border border-gray-200 dark:border-dark-border p-4 space-y-3"
    >
      <textarea
        value={content}
        onChange={(e) => { setContent(e.target.value); setFieldError('') }}
        placeholder="Bạn đang nghĩ gì?"
        className={`w-full resize-none border rounded-lg p-3 text-gray-900 dark:text-dark-text placeholder-gray-400 dark:placeholder-gray-500 bg-white dark:bg-dark-bg outline-none min-h-24 focus:ring-2 focus:ring-blue-500 transition-all ${
          fieldError ? 'border-red-500 focus:ring-red-500' : 'border-gray-200 dark:border-dark-border'
        }`}
        maxLength={2000}
        disabled={createMutation.isPending}
      />
      {fieldError && (
        <p className="text-xs text-red-500 -mt-1">{fieldError}</p>
      )}

      <TopicSelector selected={selectedTopics} onChange={setSelectedTopics} />

      <div className="flex items-center justify-between">
        <span className={`text-xs ${content.length > 1800 ? 'text-orange-500' : 'text-gray-400 dark:text-dark-muted'}`}>
          {content.length}/2000
        </span>
        <motion.button
          onClick={() => createMutation.mutate()}
          disabled={!content.trim() || createMutation.isPending}
          whileTap={{ scale: 0.96 }}
          className="flex items-center gap-2 bg-blue-500 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {createMutation.isPending && <Spinner />}
          {createMutation.isPending ? 'Đang đăng...' : 'Đăng'}
        </motion.button>
      </div>
    </motion.div>
  )
}
