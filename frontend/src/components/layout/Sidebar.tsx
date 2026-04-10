import { NavLink } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

const navItems = [
  { to: '/feed', label: 'Bảng tin', icon: '📰' },
  { to: '/explore', label: 'Khám phá', icon: '🔍' },
  { to: '/settings', label: 'Cài đặt', icon: '⚙️' },
]

export default function Sidebar() {
  const { user } = useAuth()

  return (
    <aside className="w-48 flex-shrink-0 hidden md:block">
      <div className="sticky top-20 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-blue-50 text-blue-600'
                  : 'text-gray-600 hover:bg-gray-100'
              }`
            }
          >
            <span>{item.icon}</span>
            {item.label}
          </NavLink>
        ))}

        {user && (
          <NavLink
            to={`/profile/${user.id}`}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-blue-50 text-blue-600'
                  : 'text-gray-600 hover:bg-gray-100'
              }`
            }
          >
            <span>👤</span>
            Trang cá nhân
          </NavLink>
        )}
      </div>
    </aside>
  )
}
