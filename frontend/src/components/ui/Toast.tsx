import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface ToastProps {
  message: string
  type?: 'success' | 'error' | 'info'
  onClose: () => void
}

export default function Toast({ message, type = 'info', onClose }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3500)
    return () => clearTimeout(timer)
  }, [onClose])

  const bg = type === 'success' ? 'bg-green-500' : type === 'error' ? 'bg-red-500' : 'bg-blue-500'
  const icon = type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ'

  return (
    <motion.div
      initial={{ x: 110, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 110, opacity: 0 }}
      transition={{ x: { type: 'spring', stiffness: 350, damping: 30 }, opacity: { duration: 0.2 } }}
      className={`fixed bottom-4 right-4 ${bg} text-white px-5 py-3 rounded-xl shadow-xl z-[100] flex items-center gap-3 max-w-xs`}
    >
      <span className="text-base font-bold w-5 h-5 flex items-center justify-center bg-white/20 rounded-full shrink-0">
        {icon}
      </span>
      <span className="text-sm font-medium leading-tight">{message}</span>
      <button onClick={onClose} className="ml-1 opacity-70 hover:opacity-100 text-base leading-none shrink-0">✕</button>
    </motion.div>
  )
}
