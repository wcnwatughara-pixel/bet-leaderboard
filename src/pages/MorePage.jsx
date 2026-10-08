import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

export default function MorePage() {
  const { profile, signOut } = useAuth()
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [signingOut, setSigningOut] = useState(false)

  useEffect(() => {
    if (profile) fetchNotifications()
  }, [profile])

  async function fetchNotifications() {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(50)

    if (data) {
      setNotifications(data)
      setUnreadCount(data.filter(n => !n.read).length)
    }
    setLoading(false)
  }

  async function markAsRead(notifId) {
    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', notifId)
      .eq('user_id', profile.id)

    setNotifications(prev =>
      prev.map(n => n.id === notifId ? { ...n, read: true } : n)
    )
    setUnreadCount(prev => Math.max(0, prev - 1))
  }

  async function markAllRead() {
    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', profile.id)
      .eq('read', false)

    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    setUnreadCount(0)
  }

  async function handleSignOut() {
    setSigningOut(true)
    await signOut()
  }

  function formatTime(dateStr) {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now - date
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const notifIcon = (type) => {
    switch (type) {
      case 'bet_flagged': return '🚩'
      case 'flag_resolved': return '✅'
      case 'rank_overtake': return '📈'
      case 'pending_reminder': return '⏰'
      default: return '🔔'
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>More</h1>
      </div>

      {/* Notifications section */}
      <div className="section">
        <div className="section-header-row">
          <h2 className="section-title">
            Notifications
            {unreadCount > 0 && <span className="badge">{unreadCount}</span>}
          </h2>
          {unreadCount > 0 && (
            <button className="btn-small btn-ghost" onClick={markAllRead}>
              Mark all read
            </button>
          )}
        </div>

        {loading ? (
          <div className="loading">Loading...</div>
        ) : notifications.length === 0 ? (
          <div className="empty-state small">
            <p>No notifications yet.</p>
          </div>
        ) : (
          <div className="notification-list">
            {notifications.map(notif => (
              <div
                key={notif.id}
                className={`notification-item ${notif.read ? 'read' : 'unread'}`}
                onClick={() => !notif.read && markAsRead(notif.id)}
              >
                <span className="notif-icon">{notifIcon(notif.type)}</span>
                <div className="notif-content">
                  <p className="notif-message">{notif.message}</p>
                  <span className="notif-time">{formatTime(notif.created_at)}</span>
                </div>
                {!notif.read && <span className="notif-dot" />}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Profile section */}
      <div className="section">
        <h2 className="section-title">Profile</h2>
        <div className="profile-card">
          <div className="profile-row">
            <span className="label">Username</span>
            <span>{profile?.username}</span>
          </div>
          <div className="profile-row">
            <span className="label">Member since</span>
            <span>{profile?.created_at ? new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : '-'}</span>
          </div>
        </div>
      </div>

      {/* Sign out */}
      <div className="section">
        <button className="btn btn-danger full-width" onClick={handleSignOut} disabled={signingOut}>
          {signingOut ? 'Signing out...' : 'Log out'}
        </button>
      </div>
    </div>
  )
}
