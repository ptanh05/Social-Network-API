import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { usersApi } from '../../services/users'
import TopicSelector from '../../components/ui/TopicSelector'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { useTheme } from '../../context/ThemeContext'
import { changePasswordSchema } from '../../validators/schemas'

export default function SettingsPage() {
  const { user, logout } = useAuth()
  const { showToast } = useToast()
  const { theme, toggleTheme } = useTheme()
  const queryClient = useQueryClient()

  const [username, setUsername] = useState(user?.username || '')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [dateOfBirth, setDateOfBirth] = useState(user?.date_of_birth || '')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [selectedTopics, setSelectedTopics] = useState<number[]>([])
  const [pwErrors, setPwErrors] = useState<Record<string, string>>({})

  const { data: preferences } = useQuery({
    queryKey: ['preferences'],
    queryFn: usersApi.getPreferences,
  })

  useEffect(() => {
    if (preferences?.topics) {
      setSelectedTopics(preferences.topics.map((t: any) => t.id))
    }
  }, [preferences])

  const updateProfileMutation = useMutation({
    mutationFn: () => usersApi.updateMe({ username, date_of_birth: dateOfBirth, avatar_url: avatarUrl }),
    onSuccess: () => showToast('Cập nhật thông tin thành công!', 'success'),
    onError: () => showToast('Cập nhật thất bại. Vui lòng thử lại.', 'error'),
  })

  const changePasswordMutation = useMutation({
    mutationFn: () => {
      const result = changePasswordSchema.safeParse({
        current_password: currentPassword,
        new_password: newPassword,
        confirm_password: confirmPassword,
      })
      if (!result.success) {
        const errors: Record<string, string> = {}
        for (const issue of result.error.issues) {
          errors[issue.path.join('.')] = issue.message
        }
        setPwErrors(errors)
        throw new Error('Validation failed')
      }
      return usersApi.changePassword(currentPassword, newPassword)
    },
    onSuccess: () => {
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); setPwErrors({})
      showToast('Đổi mật khẩu thành công!', 'success')
    },
    onError: (err: unknown) => {
      const msg = (err as Error).message
      if (msg !== 'Validation failed') showToast(msg || 'Đổi mật khẩu thất bại', 'error')
    },
  })

  const updatePreferencesMutation = useMutation({
    mutationFn: () => usersApi.updatePreferences(selectedTopics),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['preferences'] })
      showToast('Cập nhật sở thích thành công!', 'success')
    },
    onError: () => showToast('Cập nhật sở thích thất bại.', 'error'),
  })

  const deleteAccountMutation = useMutation({
    mutationFn: () => usersApi.deleteAccount(),
    onSuccess: () => logout(),
    onError: () => showToast('Xóa tài khoản thất bại.', 'error'),
  })

  const cardClass = 'bg-white dark:bg-dark-card rounded-xl border border-gray-200 dark:border-dark-border p-6 space-y-4'
  const labelClass = 'block text-sm font-medium text-gray-600 dark:text-dark-muted mb-1'
  const inputClass = 'w-full border border-gray-200 dark:border-dark-border rounded-lg px-3 py-2 text-sm outline-none bg-white dark:bg-dark-bg text-gray-900 dark:text-dark-text placeholder:text-gray-400'
  const errInputClass = 'w-full border border-red-500 rounded-lg px-3 py-2 text-sm outline-none bg-white dark:bg-dark-bg text-gray-900 dark:text-dark-text'
  const errText = 'text-xs text-red-500 mt-1'

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <h1 className="text-xl font-bold text-gray-900 dark:text-dark-text">Cài đặt</h1>

      {/* Thông tin cá nhân */}
      <div className={cardClass}>
        <h2 className="font-semibold text-gray-700 dark:text-dark-text">Thông tin cá nhân</h2>
        <div>
          <label className={labelClass}>Tên đăng nhập</label>
          <input type="text" value={username} onChange={e => setUsername(e.target.value)}
            className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Email</label>
          <input type="email" value={user?.email || ''} disabled
            className={`${inputClass} bg-gray-50 dark:bg-dark-border cursor-not-allowed opacity-60`} />
        </div>
        <div>
          <label className={labelClass}>Ngày sinh</label>
          <input type="date" value={dateOfBirth} onChange={e => setDateOfBirth(e.target.value)}
            className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>URL Ảnh đại diện</label>
          <input type="url" value={avatarUrl} onChange={e => setAvatarUrl(e.target.value)}
            className={inputClass} placeholder="https://example.com/avatar.jpg" />
        </div>
        <div className="pt-2">
          <button onClick={() => updateProfileMutation.mutate()} disabled={updateProfileMutation.isPending}
            className="bg-blue-500 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-600 disabled:opacity-50">
            {updateProfileMutation.isPending ? 'Đang lưu...' : 'Lưu thay đổi'}
          </button>
        </div>
      </div>

      {/* Đổi mật khẩu */}
      <div className={cardClass}>
        <h2 className="font-semibold text-gray-700 dark:text-dark-text">Đổi mật khẩu</h2>
        <div>
          <label className={labelClass}>Mật khẩu hiện tại</label>
          <input type="password" value={currentPassword} onChange={e => { setCurrentPassword(e.target.value); setPwErrors((p) => ({ ...p, current_password: '' })) }}
            className={pwErrors.current_password ? errInputClass : inputClass}
            placeholder="••••••••" />
          {pwErrors.current_password && <p className={errText}>{pwErrors.current_password}</p>}
        </div>
        <div>
          <label className={labelClass}>Mật khẩu mới</label>
          <input type="password" value={newPassword} onChange={e => { setNewPassword(e.target.value); setPwErrors((p) => ({ ...p, new_password: '' })) }}
            className={pwErrors.new_password ? errInputClass : inputClass}
            placeholder="Tối thiểu 8 ký tự" />
          {pwErrors.new_password && <p className={errText}>{pwErrors.new_password}</p>}
        </div>
        <div>
          <label className={labelClass}>Xác nhận mật khẩu mới</label>
          <input type="password" value={confirmPassword} onChange={e => { setConfirmPassword(e.target.value); setPwErrors((p) => ({ ...p, confirm_password: '' })) }}
            className={pwErrors.confirm_password ? errInputClass : inputClass}
            placeholder="Nhập lại mật khẩu mới" />
          {pwErrors.confirm_password && <p className={errText}>{pwErrors.confirm_password}</p>}
        </div>
        <div className="pt-2">
          <button onClick={() => changePasswordMutation.mutate()}
            disabled={changePasswordMutation.isPending || !currentPassword || !newPassword || !confirmPassword}
            className="bg-blue-500 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-600 disabled:opacity-50">
            {changePasswordMutation.isPending ? 'Đang đổi...' : 'Đổi mật khẩu'}
          </button>
        </div>
      </div>

      {/* Sở thích */}
      <div className={cardClass}>
        <h2 className="font-semibold text-gray-700 dark:text-dark-text mb-1">Chủ đề bạn quan tâm</h2>
        <p className="text-sm text-gray-500 dark:text-dark-muted mb-4">
          Chọn các chủ đề bạn yêu thích để bảng tin cá nhân hóa hiển thị nội dung phù hợp với bạn.
        </p>
        <TopicSelector selected={selectedTopics} onChange={setSelectedTopics} />
        <div className="pt-4 border-t border-gray-100 dark:border-dark-border">
          <button onClick={() => updatePreferencesMutation.mutate()} disabled={updatePreferencesMutation.isPending}
            className="bg-blue-500 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-600 disabled:opacity-50">
            {updatePreferencesMutation.isPending ? 'Đang lưu...' : 'Lưu thay đổi'}
          </button>
        </div>
      </div>

      {/* Giao diện */}
      <div className={cardClass}>
        <h2 className="font-semibold text-gray-700 dark:text-dark-text">Giao diện</h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-800 dark:text-dark-text">{theme === 'dark' ? 'Chế độ tối 🌙' : 'Chế độ sáng ☀️'}</p>
            <p className="text-xs text-gray-500 dark:text-dark-muted mt-0.5">{theme === 'dark' ? 'Đang bật chế độ tối' : 'Đang bật chế độ sáng'}</p>
          </div>
          <button onClick={toggleTheme}
            className="px-4 py-2 rounded-lg text-sm font-medium border border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-dark-bg text-gray-700 dark:text-dark-text hover:bg-gray-100 dark:hover:bg-dark-border transition-colors">
            {theme === 'dark' ? '☀️ Chế độ sáng' : '🌙 Chế độ tối'}
          </button>
        </div>
      </div>

      {/* Xóa tài khoản */}
      <div className="bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800 p-6 space-y-4">
        <div>
          <h2 className="font-semibold text-red-600 dark:text-red-400">Xóa tài khoản</h2>
          <p className="text-sm text-red-500 dark:text-red-400 mt-1">
            Khi xóa, toàn bộ bài viết, bình luận và dữ liệu của bạn sẽ bị mất vĩnh viễn.
          </p>
        </div>
        <button onClick={() => window.confirm('Bạn có chắc muốn xóa tài khoản? Hành động này không thể hoàn tác.') && deleteAccountMutation.mutate()}
          disabled={deleteAccountMutation.isPending}
          className="bg-red-500 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-red-600 disabled:opacity-50">
          {deleteAccountMutation.isPending ? 'Đang xóa...' : 'Xóa tài khoản'}
        </button>
      </div>
    </div>
  )
}
