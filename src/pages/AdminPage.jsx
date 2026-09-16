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
  const [showForm, setShowForm] = useState(false)
  const [codeType, setCodeType] = useState('unlimited_permanent') // 'unlimited_permanent', 'unlimited_expiring', 'capped'
  const [expiryDays, setExpiryDays] = useState(7)
  const [maxUses, setMaxUses] = useState(10)
  const [copiedId, setCopiedId] = useState(null)

  useEffect(() => { fetchCodes() }, [])

  async function fetchCodes() {
    const { data } = await supabase
      .from('invite_codes')
      .select('*')
      .order('created_at', { ascending: false })
    setCodes(data || [])
    setLoading(false)
  }

  // Generate a random code like "BDLB-A7K3"
  function generateCodeString() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    let code = 'BDLB-'
    for (let i = 0; i < 4; i++) {
      code += chars[Math.floor(Math.random() * chars.length)]
    }
    return code
  }

  async function handleGenerate() {
    setGenerating(true)
    const code = generateCodeString()

    // Build insert object based on code type
    const insert = {
      code,
      created_by: adminId,
      is_active: true,
      use_count: 0,
    }

    if (codeType === 'unlimited_permanent') {
      insert.max_uses = null
      insert.expires_at = null
    } else if (codeType === 'unlimited_expiring') {
      insert.max_uses = null
      const exp = new Date()
      exp.setDate(exp.getDate() + expiryDays)
      insert.expires_at = exp.toISOString()
    } else if (codeType === 'capped') {
      insert.max_uses = maxUses
      insert.expires_at = null
    }

    const { error } = await supabase.from('invite_codes').insert(insert)
    if (!error) await fetchCodes()
    setGenerating(false)
    setShowForm(false)
  }

  async function toggleActive(code) {
    await supabase
      .from('invite_codes')
      .update({ is_active: !code.is_active })
      .eq('id', code.id)
    await fetchCodes()
  }

  function copyLink(code) {
    const url = `${window.location.origin}/signup?code=${code.code}`
    navigator.clipboard.writeText(url).then(() => {
      setCopiedId(code.id)
      setTimeout(() => setCopiedId(null), 2000)
    })
  }

  function codeStatus(code) {
    if (!code.is_active) return 'deactivated'
    if (code.expires_at && new Date(code.expires_at) < new Date()) return 'expired'
    if (code.max_uses !== null && code.use_count >= code.max_uses) return 'maxed'
    return 'active'
  }

  function codeTypeLabel(code) {
    if (code.max_uses === null && !code.expires_at) return 'Unlimited'
    if (code.max_uses === null && code.expires_at) return 'Unlimited (expiring)'
    if (code.max_uses !== null) return `Capped (${code.use_count}/${code.max_uses})`
    return ''
  }

  if (loading) return <div className="loading">Loading...</div>

  return (
    <div className="admin-section">
      {!showForm ? (
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>
          Generate invite code
        </button>
      ) : (
        <div className="code-form">
          <p className="code-form-title">Code type</p>
          <div className="code-type-options">
            <button
              className={`code-type-btn ${codeType === 'unlimited_permanent' ? 'selected' : ''}`}
              onClick={() => setCodeType('unlimited_permanent')}
            >
              Unlimited, never expires
            </button>
            <button
              className={`code-type-btn ${codeType === 'unlimited_expiring' ? 'selected' : ''}`}
              onClick={() => setCodeType('unlimited_expiring')}
            >
              Unlimited, expires
            </button>
            <button
              className={`code-type-btn ${codeType === 'capped' ? 'selected' : ''}`}
              onClick={() => setCodeType('capped')}
            >
              Max uses
            </button>
          </div>

          {codeType === 'unlimited_expiring' && (
            <div className="form-group" style={{ marginTop: 12 }}>
              <label>Expires in (days)</label>
              <input
                type="number"
                inputMode="numeric"
                value={expiryDays}
                onChange={e => setExpiryDays(parseInt(e.target.value) || 1)}
                min="1"
                max="365"
              />
            </div>
          )}

          {codeType === 'capped' && (
            <div className="form-group" style={{ marginTop: 12 }}>
              <label>Maximum uses</label>
              <input
                type="number"
                inputMode="numeric"
                value={maxUses}
                onChange={e => setMaxUses(parseInt(e.target.value) || 1)}
                min="1"
                max="1000"
              />
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button className="btn btn-primary" onClick={handleGenerate} disabled={generating} style={{ flex: 1 }}>
              {generating ? 'Generating...' : 'Generate'}
            </button>
            <button className="btn-small btn-ghost" onClick={() => setShowForm(false)} style={{ padding: '12px 16px' }}>
              Cancel
            </button>
          </div>
        </div>
      )}

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
                <span>{codeTypeLabel(code)}</span>
                {code.use_count > 0 && <span> · {code.use_count} uses</span>}
                {code.expires_at && status !== 'expired' && (
                  <span> · Expires {new Date(code.expires_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })}</span>
                )}
              </div>
              <div className="code-actions">
                <button className="btn-small btn-ghost" onClick={() => copyLink(code)}>
                  {copiedId === code.id ? 'Copied!' : 'Copy link'}
                </button>
                {status === 'active' && (
                  <button className="btn-small btn-danger" onClick={() => toggleActive(code)}>
                    Deactivate
                  </button>
                )}
                {status === 'deactivated' && (
                  <button className="btn-small btn-primary" onClick={() => toggleActive(code)} style={{ fontSize: '0.75rem', padding: '6px 10px' }}>
                    Reactivate
                  </button>
                )}
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

  // Helper: log an admin action to all leagues the affected user belongs to
  async function logToUserLeagues(userId, eventType, details) {
    // Find all active leagues this user is in
    const { data: memberships } = await supabase
      .from('league_members')
      .select('league_id')
      .eq('user_id', userId)
      .eq('is_active', true)

    if (memberships && memberships.length > 0) {
      const entries = memberships.map(m => ({
        league_id: m.league_id,
        user_id: userId,
        event_type: eventType,
        details,
      }))
      await supabase.from('league_activity').insert(entries)
    }
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

      // Log to all leagues the bet owner is in
      await logToUserLeagues(
        flag.bet.user_id,
        'flag_dismissed',
        `Admin dismissed flag on ${flag.bet.user?.username}'s bet ${flag.bet.booking_code}. Reason: ${flag.reason || 'None'}`
      )
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

      // Log to all leagues the bet owner is in
      await logToUserLeagues(
        flag.bet.user_id,
        'outcome_overridden',
        `Admin changed ${flag.bet.user?.username}'s bet ${flag.bet.booking_code} from ${flag.bet.outcome} to ${newOutcome}`
      )
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

      // Log to all leagues the bet owner is in (before deleting the bet)
      await logToUserLeagues(
        flag.bet.user_id,
        'bet_deleted',
        `Admin deleted ${flag.bet.user?.username}'s bet ${flag.bet.booking_code} (₦${flag.bet.stake} @ ${flag.bet.odds}, ${flag.bet.outcome})`
      )

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
