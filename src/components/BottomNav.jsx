import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function BottomNav() {
  const { isAdmin, profile, signOut } = useAuth()
  const [showMenu, setShowMenu] = useState(false)

  async function handleSignOut() {
    await signOut()
    setShowMenu(false)
  }

  return (
    <>
      {/* Sign-out overlay menu */}
      {showMenu && (
        <div className="menu-overlay" onClick={() => setShowMenu(false)}>
          <div className="menu-sheet" onClick={e => e.stopPropagation()}>
            <p className="menu-user">{profile?.username}</p>
            <NavLink to="/activity" className="menu-item" onClick={() => setShowMenu(false)}>
              Activity log
            </NavLink>
            <button className="menu-item danger" onClick={handleSignOut}>
              Sign out
            </button>
          </div>
        </div>
      )}

      <nav className="bottom-nav">
        <NavLink to="/" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M8 21v-6a2 2 0 012-2h4a2 2 0 012 2v6" />
            <path d="M12 3l9 8H3l9-8z" />
          </svg>
          <span>Home</span>
        </NavLink>

        <NavLink to="/log-bet" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="16" />
            <line x1="8" y1="12" x2="16" y2="12" />
          </svg>
          <span>Log Bet</span>
        </NavLink>

        <NavLink to="/my-bets" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2" />
            <rect x="8" y="2" width="8" height="4" rx="1" />
          </svg>
          <span>My Bets</span>
        </NavLink>

        <NavLink to="/leagues" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 00-3-3.87" />
            <path d="M16 3.13a4 4 0 010 7.75" />
          </svg>
          <span>Leagues</span>
        </NavLink>

        {isAdmin && (
          <NavLink to="/admin" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
            </svg>
            <span>Admin</span>
          </NavLink>
        )}

        <button className="nav-item" onClick={() => setShowMenu(!showMenu)}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <circle cx="12" cy="5" r="1.5" />
            <circle cx="12" cy="19" r="1.5" />
          </svg>
          <span>More</span>
        </button>
      </nav>
    </>
  )
}
