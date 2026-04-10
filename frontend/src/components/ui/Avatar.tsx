interface AvatarProps {
  username: string
  size?: 'sm' | 'md' | 'lg'
}

export default function Avatar({ username, size = 'md' }: AvatarProps) {
  const sizeClass = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-16 h-16 text-lg',
  }[size]

  const initials = username.slice(0, 2).toUpperCase()

  const colors = [
    'bg-blue-500',
    'bg-green-500',
    'bg-purple-500',
    'bg-pink-500',
    'bg-orange-500',
    'bg-teal-500',
  ]
  const colorIndex = username.charCodeAt(0) % colors.length

  return (
    <div
      className={`${sizeClass} ${colors[colorIndex]} rounded-full flex items-center justify-center text-white font-bold flex-shrink-0`}
    >
      {initials}
    </div>
  )
}
