import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

export default function AdminPage() {
  const { profile } = useAuth()
  const [activeTab, setActiveTab] = useState('codes') // 'codes', 'flags', 'log', 'users'

  return (
    <div className="page">
      <div className="page-header">
        <h1>Admin</h1>
      </div>

      <div className="tab-bar">
        <button className={`tab ${activeTab === 'codes' ? 'active' : ''}`} onClick={() => setActiveTab('codes')}>
          Codes
        </button>
        <button className={`tab ${activeTab === 'flags' ? 'active' : ''}`} onClick={() => setActiveTab('flags')}>
          Flags
        </button>
        <button className={`tab ${activeTab === 'users' ? 'active' : ''}`} onClick={() => setActiveTab('users')}>
          Users
        </button>
        <button className={`tab ${activeTab === 'log' ? 'active' : ''}`} onClick={() => setActiveTab('log')}>
          Log
        </button>
      </div>

      {activeTab === 'codes' && <InviteCodes adminId={profile.id} />}
      {activeTab === 'flags' && <FlaggedBets adminId={profile.id} />}
      {activeTab === 'users' && <UserManagement adminId={profile.id} />}
      {activeTab === 'log' && <AdminLog />}
    </div>
  )
}

// ============================================
// INVITE CODES TAB
// ============================================
function InviteCodes({ adminId }) {
  const [codes, setCodes] = useState([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)

  useEffect(() => { fetchCodes() }, [])

  async function fetchCodes() {
    const { data } = await supabase
      .from('invite_codes')
      .select('*, profiles:used_by(username)')
      .order('created_at', { ascending: false })
    setCodes(data || [])
    setLoading(false)
  }

  // Generate a random 8-character code like "BDLB-A7K3"
  function generateCodeString() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no I/O/0/1 to avoid confusion
    let code = 'BDLB-'
    for (let i = 0; i < 4; i++) {
      code += chars[Math.floor(Math.random() * chars.length)]
    }
    return code
  }

  async function handleGenerate() {
    setGenerating(true)
    const code = generateCodeString()
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7) // Expires in 7 days

    const { error } = await supabase.from('invite_codes').insert({
      code,
      created_by: adminId,
      expires_at: expiresAt.toISOString(),
    })

    if (!error) await fetchCodes()
    setGenerating(false)
  }

  function codeStatus(code) {
    if (code.used_by) return 'used'
    if (new Date(code.expires_at) < new Date()) return 'expired'
    return 'active'
  }

  if (loading) return <div className="loading">Loading...</div>

  return (
    <div className="admin-section">
      <button className="btn btn-primary" onClick={handleGenerate} disabled={generating}>
        {generating ? 'Generating...' : 'Generate invite code'}
      </button>

      <div className="code-list">
        {codes.map(code => {
          const status = codeStatus(code)
          return (
            <div key={code.id} className={`code-item ${status}`}>
              <div className="code-main">
                <span className="code-string">{code.code}</span>
                <span className={`code-status-badge ${status}`}>{status}</span>
              </div>
              <div className="code-meta">
                {status === 'used' && code.profiles?.username && (
                  <span>Used by {code.profiles.username}</span>
                )}
                {status === 'active' && (
                  <span>Expires {new Date(code.expires_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })}</span>
                )}
                {status === 'expired' && <span>Expired</span>}
              </div>
            </div>
          )
        })}
        {codes.length === 0 && <p className="empty-note">No invite codes generated yet.</p>}
      </div>
    </div>
  )
}

// ============================================
// FLAGGED BETS TAB
// ============================================
function FlaggedBets({ adminId }) {
  const [flags, setFlags] = useState([])
  const [loading, setLoading] = useState(true)
  const [viewingScreenshot, setViewingScreenshot] = useState(null)

  useEffect(() => { fetchFlags() }, [])

  async function fetchFlags() {
    const { data } = await supabase
      .from('flags')
      .select(`
        *,
        bet:bets(*,user:profiles(username)),
        flagger:profiles!flags_flagged_by_fkey(username)
      `)
      .order('created_at', { ascending: false })
    setFlags(data || [])
    setLoading(false)
  }

  async function handleResolve(flag, action) {
    // action: 'dismiss', 'uphold_override', 'uphold_delete'
    if (action === 'dismiss') {
      await supabase
        .from('flags')
        .update({ status: 'dismissed', reviewed_by: adminId })
        .eq('id', flag.id)

      await supabase.from('admin_actions').insert({
        admin_id: adminId,
        action_type: 'override_outcome',
        target_bet_id: flag.bet_id,
        details: `Dismissed flag from ${flag.flagger?.username}. Reason: ${flag.reason || 'No reason given'}`,
      })
    } else if (action === 'uphold_override') {
      const newOutcome = flag.bet.outcome === 'win' ? 'loss' : 'win'
      await supabase
        .from('bets')
        .update({ outcome: newOutcome })
        .eq('id', flag.bet_id)

      await supabase
        .from('flags')
        .update({ status: 'upheld', reviewed_by: adminId })
        .eq('id', flag.id)

      await supabase.from('admin_actions').insert({
        admin_id: adminId,
        action_type: 'override_outcome',
        target_bet_id: flag.bet_id,
        target_user_id: flag.bet.user_id,
        details: `Changed outcome from ${flag.bet.outcome} to ${newOutcome} for ${flag.bet.user?.username}'s bet ${flag.bet.booking_code}. Flag reason: ${flag.reason || 'None'}`,
      })
    } else if (action === 'uphold_delete') {
      await supabase
        .from('flags')
        .update({ status: 'upheld', reviewed_by: adminId })
        .eq('id', flag.id)

      // Delete screenshot from storage
      if (flag.bet.screenshot_url) {
        const path = flag.bet.screenshot_url.split('/screenshots/')[1]?.split('?')[0]
        if (path) {
          await supabase.storage.from('screenshots').remove([decodeURIComponent(path)])
        }
      }

      await supabase.from('admin_actions').insert({
        admin_id: adminId,
        action_type: 'delete_bet',
        target_user_id: flag.bet.user_id,
        details: `Deleted ${flag.bet.user?.username}'s bet: ${flag.bet.booking_code}, ₦${flag.bet.stake} @ ${flag.bet.odds} (${flag.bet.outcome}). Flag reason: ${flag.reason || 'None'}`,
      })

      await supabase.from('bets').delete().eq('id', flag.bet_id)
    }

    await fetchFlags()
  }

  if (loading) return <div className="loading">Loading...</div>

  const pending = flags.filter(f => f.status === 'flagged')
  const resolved = flags.filter(f => f.status !== 'flagged')

  return (
    <div className="admin-section">
      <h2 className="section-title">Pending ({pending.length})</h2>
      {pending.length === 0 && <p className="empty-note">No flags to review.</p>}
      {pending.map(flag => (
        <div key={flag.id} className="flag-card">
          <div className="flag-card-header">
            <span>Flagged by <strong>{flag.flagger?.username}</strong></span>
            {flag.reason && <p className="flag-reason">"{flag.reason}"</p>}
          </div>
          {flag.bet && (
            <div className="flag-bet-detail">
              <p><strong>{flag.bet.user?.username}</strong>'s bet</p>
              <p>{flag.bet.booking_code} | ₦{Number(flag.bet.stake).toLocaleString()} @ {flag.bet.odds} | {flag.bet.outcome}</p>
              <button
                className="btn-small btn-ghost"
                onClick={() => setViewingScreenshot(viewingScreenshot === flag.id ? null : flag.id)}
              >
                {viewingScreenshot === flag.id ? 'Hide proof' : 'View proof'}
              </button>
              {viewingScreenshot === flag.id && (
                <div className="screenshot-view">
                  <img src={flag.bet.screenshot_url} alt="Bet screenshot" loading="lazy" />
                </div>
              )}
            </div>
          )}
          <div className="flag-actions">
            <button className="btn-small btn-ghost" onClick={() => handleResolve(flag, 'dismiss')}>
              Dismiss
            </button>
            <button className="btn-small btn-warning" onClick={() => handleResolve(flag, 'uphold_override')}>
              Flip outcome
            </button>
            <button className="btn-small btn-danger" onClick={() => handleResolve(flag, 'uphold_delete')}>
              Delete bet
            </button>
          </div>
        </div>
      ))}

      {resolved.length > 0 && (
        <>
          <h2 className="section-title" style={{ marginTop: '2rem' }}>Resolved ({resolved.length})</h2>
          {resolved.map(flag => (
            <div key={flag.id} className={`flag-card resolved ${flag.status}`}>
              <div className="flag-card-header">
                <span>{flag.flagger?.username} flagged {flag.bet?.user?.username}'s bet</span>
                <span className={`flag-status-badge ${flag.status}`}>{flag.status}</span>
              </div>
              {flag.reason && <p className="flag-reason">"{flag.reason}"</p>}
            </div>
          ))}
        </>
      )}
    </div>
  )
}

// ============================================
// USER MANAGEMENT TAB
// ============================================
function UserManagement({ adminId }) {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchUsers() }, [])

  async function fetchUsers() {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: true })
    setUsers(data || [])
    setLoading(false)
  }

  async function toggleActive(user) {
    const newStatus = !user.is_active
    await supabase
      .from('profiles')
      .update({ is_active: newStatus })
      .eq('id', user.id)

    await supabase.from('admin_actions').insert({
      admin_id: adminId,
      action_type: newStatus ? 'reactivate_user' : 'deactivate_user',
      target_user_id: user.id,
      details: `${newStatus ? 'Reactivated' : 'Deactivated'} user ${user.username}`,
    })

    await fetchUsers()
  }

  if (loading) return <div className="loading">Loading...</div>

  return (
    <div className="admin-section">
      {users.map(user => (
        <div key={user.id} className={`user-card ${!user.is_active ? 'inactive' : ''}`}>
          <div className="user-card-main">
            <span className="user-name">
              {user.username}
              {user.is_admin && <span className="admin-badge">admin</span>}
            </span>
            <span className="user-date">
              Joined {new Date(user.created_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
          </div>
          {!user.is_admin && (
            <button
              className={`btn-small ${user.is_active ? 'btn-danger' : 'btn-primary'}`}
              onClick={() => toggleActive(user)}
            >
              {user.is_active ? 'Deactivate' : 'Reactivate'}
            </button>
          )}
        </div>
      ))}
    </div>
  )
}

// ============================================
// ADMIN ACTION LOG TAB (PUBLIC)
// ============================================
function AdminLog() {
  const [actions, setActions] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchLog() }, [])

  async function fetchLog() {
    const { data } = await supabase
      .from('admin_actions')
      .select('*, admin:profiles!admin_actions_admin_id_fkey(username)')
      .order('created_at', { ascending: false })
      .limit(50)
    setActions(data || [])
    setLoading(false)
  }

  if (loading) return <div className="loading">Loading...</div>

  return (
    <div className="admin-section">
      {actions.length === 0 && <p className="empty-note">No admin actions taken yet.</p>}
      {actions.map(action => (
        <div key={action.id} className="log-entry">
          <div className="log-header">
            <span className={`log-type ${action.action_type}`}>
              {action.action_type.replace(/_/g, ' ')}
            </span>
            <span className="log-date">
              {new Date(action.created_at).toLocaleDateString('en-NG', {
                day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
              })}
            </span>
          </div>
          <p className="log-detail">{action.details}</p>
          <p className="log-admin">by {action.admin?.username}</p>
        </div>
      ))}
    </div>
  )
}
