import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import BottomNav from './components/BottomNav'
import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'
import LeaderboardPage from './pages/LeaderboardPage'
import LogBetPage from './pages/LogBetPage'
import MyBetsPage from './pages/MyBetsPage'
import AdminPage from './pages/AdminPage'
import ActivityLogPage from './pages/ActivityLogPage'
import MyLeaguesPage from './pages/leagues/MyLeaguesPage'
import CreateLeaguePage from './pages/leagues/CreateLeaguePage'
import BrowseLeaguesPage from './pages/leagues/BrowseLeaguesPage'
import LeagueDetailPage from './pages/leagues/LeagueDetailPage'
import JoinLeaguePage from './pages/leagues/JoinLeaguePage'

function ProtectedRoute({ children }) {
  const { session, loading, profile } = useAuth()
  if (loading) return <div className="loading-screen">Loading...</div>
  if (!session) return <Navigate to="/login" />
  // Block deactivated users
  if (profile && !profile.is_active) {
    return (
      <div className="page" style={{ textAlign: 'center', padding: '60px 20px' }}>
        <h2>Account deactivated</h2>
        <p style={{ color: 'var(--text-muted)', marginTop: 8 }}>
          Your account has been deactivated by an admin. Contact them to reactivate.
        </p>
      </div>
    )
  }
  return children
}

function AdminRoute({ children }) {
  const { session, isAdmin, loading } = useAuth()
  if (loading) return <div className="loading-screen">Loading...</div>
  if (!session) return <Navigate to="/login" />
  if (!isAdmin) return <Navigate to="/" />
  return children
}

function AuthRoute({ children }) {
  const { session, loading } = useAuth()
  if (loading) return <div className="loading-screen">Loading...</div>
  if (session) return <Navigate to="/" />
  return children
}

function AppLayout() {
  const { session } = useAuth()

  return (
    <div className="app">
      <div className="app-content">
        <Routes>
          <Route path="/login" element={<AuthRoute><LoginPage /></AuthRoute>} />
          <Route path="/signup" element={<AuthRoute><SignupPage /></AuthRoute>} />
          <Route path="/" element={<ProtectedRoute><LeaderboardPage /></ProtectedRoute>} />
          <Route path="/log-bet" element={<ProtectedRoute><LogBetPage /></ProtectedRoute>} />
          <Route path="/my-bets" element={<ProtectedRoute><MyBetsPage /></ProtectedRoute>} />
          <Route path="/activity" element={<ProtectedRoute><ActivityLogPage /></ProtectedRoute>} />
          <Route path="/leagues" element={<ProtectedRoute><MyLeaguesPage /></ProtectedRoute>} />
          <Route path="/leagues/create" element={<ProtectedRoute><CreateLeaguePage /></ProtectedRoute>} />
          <Route path="/leagues/browse" element={<ProtectedRoute><BrowseLeaguesPage /></ProtectedRoute>} />
          <Route path="/leagues/:slug" element={<ProtectedRoute><LeagueDetailPage /></ProtectedRoute>} />
          <Route path="/league/join/:code" element={<JoinLeaguePage />} />
          <Route path="/admin" element={<AdminRoute><AdminPage /></AdminRoute>} />
        </Routes>
      </div>
      {session && <BottomNav />}
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppLayout />
      </AuthProvider>
    </BrowserRouter>
  )
}
