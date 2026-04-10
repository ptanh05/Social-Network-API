import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import Avatar from '../ui/Avatar'

export default function Navbar() {
  const { user, logout } = useAuth()

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-gray-200">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link to="/feed" className="text-xl font-bold text-blue-500">
          🌐 SocialNet
        </Link>

        <nav className="flex items-center gap-4">
          <Link to="/feed" className="text-gray-600 hover:text-blue-500 text-sm font-medium">
            Bảng tin
          </Link>
          <Link to="/explore" className="text-gray-600 hover:text-blue-500 text-sm font-medium">
            Khám phá
          </Link>
          <Link to="/settings" className="text-gray-600 hover:text-blue-500 text-sm font-medium">
            Cài đặt
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          {user && (
            <>
              <Link to={`/profile/${user.id}`}>
                <Avatar username={user.username} size="sm" />
              </Link>
              <span className="text-sm text-gray-700 hidden sm:block">{user.username}</span>
            </>
          )}
          <button
            onClick={logout}
            className="text-sm text-gray-500 hover:text-red-500"
          >
            Đăng xuất
          </button>
        </div>
      </div>
    </header>
  )
}
