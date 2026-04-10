import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { usersApi } from '../../api/users'
import Avatar from '../../components/ui/Avatar'
import { useAuth } from '../../context/AuthContext'

export default function ProfilePage() {
  const { userId } = useParams<{ userId: string }>()
  const { user: currentUser } = useAuth()
  const queryClient = useQueryClient()
  const [following, setFollowing] = useState(false)

  const { data: user, isLoading } = useQuery({
    queryKey: ['user', userId],
    queryFn: () => usersApi.getUserProfile(Number(userId)),
  })

  const followMutation = useMutation({
    mutationFn: () => following
      ? usersApi.unfollowUser(Number(userId))
      : usersApi.followUser(Number(userId)),
    onMutate: () => {
      setFollowing(!following)
    },
    onError: () => {
      setFollowing(following)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['user', userId] })
    },
  })

  const isOwnProfile = currentUser?.id === Number(userId)

  if (isLoading) {
    return <div className="text-center py-8 text-gray-400">Đang tải...</div>
  }

  if (!user) {
    return <div className="text-center py-8 text-red-400">Người dùng không tồn tại.</div>
  }

  return (
    <div className="max-w-xl mx-auto space-y-4">
      {/* Profile card */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-4">
          <Avatar username={user.username} size="lg" />
          <div className="flex-1">
            <h1 className="text-xl font-bold text-gray-900">{user.username}</h1>
            <p className="text-gray-500 text-sm">{user.email}</p>
            {user.date_of_birth && (
              <p className="text-gray-400 text-xs mt-1">Sinh nhật: {user.date_of_birth}</p>
            )}
          </div>

          {!isOwnProfile && (
            <button
              onClick={() => followMutation.mutate()}
              disabled={followMutation.isPending}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
                following
                  ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  : 'bg-blue-500 text-white hover:bg-blue-600'
              }`}
            >
              {following ? 'Đã theo dõi' : 'Theo dõi'}
            </button>
          )}
        </div>

        <div className="flex gap-6 mt-4 pt-4 border-t border-gray-100">
          <div className="text-center">
            <div className="text-lg font-bold text-gray-900">{user.posts_count ?? '-'}</div>
            <div className="text-xs text-gray-400">Bài viết</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-gray-900">{user.followers_count ?? '-'}</div>
            <div className="text-xs text-gray-400">Người theo dõi</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-gray-900">{user.following_count ?? '-'}</div>
            <div className="text-xs text-gray-400">Đang theo dõi</div>
          </div>
        </div>
      </div>

      {/* Placeholder for user posts */}
      <div className="text-center py-12 text-gray-400">
        <p className="text-4xl mb-3">👤</p>
        <p>Trang cá nhân của {user.username}</p>
        <p className="text-sm mt-1">Tính năng đang phát triển...</p>
      </div>
    </div>
  )
}
