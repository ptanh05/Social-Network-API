import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { registerSchema } from '../../validators/schemas'

export default function RegisterPage() {
  const [form, setForm] = useState({
    username: '',
    email: '',
    password: '',
    date_of_birth: '',
  })
  const [showPassword, setShowPassword] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { register } = useAuth()
  const navigate = useNavigate()

  const handleChange = (field: 'username' | 'email' | 'password' | 'date_of_birth', value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
    setFieldErrors((prev) => ({ ...prev, [field]: '' }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setFieldErrors({})

    // Parse date if provided
    let dateOfBirth = form.date_of_birth
    if (dateOfBirth && dateOfBirth.includes('/')) {
      const [d, m, y] = dateOfBirth.split('/')
      dateOfBirth = `${y}-${m}-${d}`
    }

    const payload = { ...form, date_of_birth: dateOfBirth || undefined }

    const result = registerSchema.safeParse(payload)
    if (!result.success) {
      const errors: Record<string, string> = {}
      for (const issue of result.error.issues) {
        errors[issue.path.join('.')] = issue.message
      }
      setFieldErrors(errors)
      return
    }

    setLoading(true)
    try {
      await register(result.data)
      navigate('/login')
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } }
      setError(e.response?.data?.detail || 'Đăng ký thất bại. Vui lòng thử lại.')
    } finally {
      setLoading(false)
    }
  }

  const inputClass = (field: string) =>
    `w-full px-4 py-2.5 border rounded-lg outline-none bg-white dark:bg-dark-bg text-gray-900 dark:text-dark-text placeholder:text-gray-400 transition-colors ${
      fieldErrors[field]
        ? 'border-red-500 focus:ring-2 focus:ring-red-500'
        : 'border-gray-300 dark:border-dark-border focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
    }`

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-dark-bg px-4">
      <div className="w-full max-w-md bg-white dark:bg-dark-card rounded-2xl shadow-lg p-8">
        <h1 className="text-2xl font-bold text-center text-gray-800 dark:text-dark-text mb-2">Tạo tài khoản mới</h1>
        <p className="text-center text-gray-500 dark:text-dark-muted mb-6">Tham gia cùng cộng đồng mạng xã hội!</p>

        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-lg">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-dark-muted mb-1">Tên đăng nhập</label>
            <input
              type="text"
              value={form.username}
              onChange={(e) => handleChange('username', e.target.value)}
              className={inputClass('username')}
              placeholder="4–20 ký tự: chữ cái, số và dấu gạch dưới"
              pattern="[a-zA-Z0-9_]{4,20}"
              title="4–20 ký tự: chữ cái, số và dấu gạch dưới"
              required
            />
            {fieldErrors.username && (
              <p className="mt-1 text-xs text-red-500">{fieldErrors.username}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-dark-muted mb-1">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => handleChange('email', e.target.value)}
              className={inputClass('email')}
              placeholder="example@email.com"
              required
            />
            {fieldErrors.email && (
              <p className="mt-1 text-xs text-red-500">{fieldErrors.email}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-dark-muted mb-1">Mật khẩu</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={form.password}
                onChange={(e) => handleChange('password', e.target.value)}
                className={inputClass('password')}
                placeholder="Ít nhất 8 ký tự"
                minLength={8}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              >
                {showPassword ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                )}
              </button>
            </div>
            {fieldErrors.password && (
              <p className="mt-1 text-xs text-red-500">{fieldErrors.password}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-dark-muted mb-1">Ngày sinh (tùy chọn)</label>
            <input
              type="date"
              value={form.date_of_birth}
              onChange={(e) => handleChange('date_of_birth', e.target.value)}
              className={inputClass('date_of_birth')}
            />
          </div>
          <button type="submit" disabled={loading}
            className="w-full bg-blue-500 text-white py-2.5 rounded-lg font-medium hover:bg-blue-600 transition-colors disabled:opacity-50">
            {loading ? 'Đang đăng ký...' : 'Đăng ký'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 dark:text-dark-muted mt-4">
          Đã có tài khoản?{' '}
          <Link to="/login" className="text-blue-500 hover:underline font-medium">Đăng nhập</Link>
        </p>
      </div>
    </div>
  )
}
