import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { usersApi } from '../../services/users'
import { postsApi } from '../../services/posts'
import TopicSelector from '../../components/ui/TopicSelector'

export default function SettingsPage() {
  const queryClient = useQueryClient()

  const { data: preferences } = useQuery({
    queryKey: ['preferences'],
    queryFn: usersApi.getPreferences,
  })

  const [selectedTopics, setSelectedTopics] = useState<number[]>(
    preferences?.topics.map((t) => t.id) || []
  )

  const { data: topics } = useQuery({
    queryKey: ['topics'],
    queryFn: postsApi.getTopics,
  })

  const updateMutation = useMutation({
    mutationFn: () => usersApi.updatePreferences(selectedTopics),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['preferences'] })
      alert('Cập nhật sở thích thành công!')
    },
    onError: () => {
      alert('Cập nhật thất bại. Vui lòng thử lại.')
    },
  })

  // Sync when preferences load
  useState(() => {
    if (preferences?.topics) {
      setSelectedTopics(preferences.topics.map((t) => t.id))
    }
  })

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <h1 className="text-xl font-bold text-gray-800">Cài đặt sở thích</h1>

      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <div>
          <h2 className="font-semibold text-gray-700 mb-1">Chủ đề bạn quan tâm</h2>
          <p className="text-sm text-gray-500 mb-4">
            Chọn các chủ đề bạn yêu thích để bảng tin cá nhân hóa hiển thị nội dung phù hợp với bạn.
          </p>
          <TopicSelector selected={selectedTopics} onChange={setSelectedTopics} />
        </div>

        <div className="pt-4 border-t border-gray-100">
          <button
            onClick={() => updateMutation.mutate()}
            disabled={updateMutation.isPending}
            className="bg-blue-500 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-600 disabled:opacity-50"
          >
            {updateMutation.isPending ? 'Đang lưu...' : 'Lưu thay đổi'}
          </button>
        </div>
      </div>

      {/* Info card */}
      <div className="bg-blue-50 rounded-xl border border-blue-100 p-4 text-sm text-blue-700">
        💡 <strong>Mẹo:</strong> Bảng tin sẽ ưu tiên hiển thị bài viết thuộc chủ đề bạn chọn
        và từ những người bạn đang theo dõi. Hãy cập nhật sở thích để trải nghiệm tốt hơn!
      </div>
    </div>
  )
}
