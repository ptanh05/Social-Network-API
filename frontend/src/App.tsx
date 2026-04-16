import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AnimatePresence, motion, Variants } from 'framer-motion'
import { AuthProvider } from './context/AuthContext'
import { ToastProvider } from './context/ToastContext'
import { ThemeProvider } from './context/ThemeContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import MainLayout from './components/layout/MainLayout'
import LoginPage from './features/auth/LoginPage'
import RegisterPage from './features/auth/RegisterPage'
import FeedPage from './features/feed/FeedPage'
import ExplorePage from './features/explore/ExplorePage'
import PostDetailPage from './features/posts/PostDetailPage'
import ProfilePage from './features/profile/ProfilePage'
import SettingsPage from './features/settings/SettingsPage'
import NotificationsPage from './features/notifications/NotificationsPage'
import BookmarksPage from './features/bookmarks/BookmarksPage'
import SearchPage from './features/search/SearchPage'
import AdminPage from './features/admin/AdminPage'

const pageVariants: Variants = {
  initial: { opacity: 0, y: 8 },
  enter:   { opacity: 1, y: 0, transition: { duration: 0.25, ease: [0.22, 1, 0.36, 1] as [number,number,number,number] } },
  exit:    { opacity: 0, y: -8, transition: { duration: 0.15, ease: [1, 0, 0.58, 1] as [number,number,number,number] } },
}

function Page({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="enter"
      exit="exit"
      className="page-wrapper"
    >
      {children}
    </motion.div>
  )
}

export default function App() {
  const location = useLocation()

  return (
    <AuthProvider>
      <ThemeProvider>
        <ToastProvider>
          <AnimatePresence mode="wait">
            <Routes location={location} key={location.pathname}>
              {/* Public */}
              <Route path="/login" element={<Page><LoginPage /></Page>} />
              <Route path="/register" element={<Page><RegisterPage /></Page>} />

              {/* Protected */}
              <Route
                element={
                  <ProtectedRoute>
                    <MainLayout />
                  </ProtectedRoute>
                }
              >
                <Route path="/" element={<Navigate to="/feed" replace />} />
                <Route path="/feed" element={<Page><FeedPage /></Page>} />
                <Route path="/explore" element={<Page><ExplorePage /></Page>} />
                <Route path="/posts/:postId" element={<Page><PostDetailPage /></Page>} />
                <Route path="/profile/:userId" element={<Page><ProfilePage /></Page>} />
                <Route path="/settings" element={<Page><SettingsPage /></Page>} />
                <Route path="/notifications" element={<Page><NotificationsPage /></Page>} />
                <Route path="/bookmarks" element={<Page><BookmarksPage /></Page>} />
                <Route path="/search" element={<Page><SearchPage /></Page>} />
                <Route path="/admin" element={<Page><AdminPage /></Page>} />
              </Route>

              {/* 404 */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </AnimatePresence>
        </ToastProvider>
      </ThemeProvider>
    </AuthProvider>
  )
}
