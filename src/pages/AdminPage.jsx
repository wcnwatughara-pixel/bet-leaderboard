import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

const ADMIN_FLAG_REASONS = [
  'Suspicious screenshot',
  'Code mismatch',
  'Incorrect odds',
  'Duplicate bet',
  'Other',
]

export default function AdminPage() {
  const { profile } = useAuth()
  const [activeTab, setActiveTab] = useState('review')

  return (
    <div className="page">
      <div className="page-header">
        <h1>Admin</h1>
      </div>

      <div className="tab-bar">
        <button className={`tab ${activeTab === 'review' ? 'active' : ''}`} onClick={() => setActiveTab('review')}>
          Review
        </button>
        <button className={`tab ${activeTab === 'flags' ? 'active' : ''}`} onClick={() => setActiveTab('flags')}>
          Flags
        </button>
        <button className={`tab ${activeTab === 'codes' ? 'active' : ''}`} onClick={() => setActiveTab('codes')}>
          Codes
        </button>
        <button className={`tab ${activeTab === 'users' ? 'active' : ''}`} onClick={() => setActiveTab('users')}>
          Users
        </button>
        <button className={`tab ${activeTab === 'log' ? 'active' : ''}`} onClick={() => setActiveTab('log')}>
          Log
        </button>
      </div>

      {activeTab === 'review' && <ReviewQueue adminId={profile.id} />}
      {activeTab === 'flags' && <FlaggedBets adminId={profile.id} />}
      {activeTab === 'codes' && <InviteCodes adminId={profile.id} />}
      {activeTab === 'users' && <UserManagement adminId={profile.id} />}
      {activeTab === 'log' && <AdminLog />}
    </div>
  )
}

// ============================================
// REVIEW QUEUE TAB
// All new unreviewed bets for admin to approve/flag
// ============================================
function ReviewQueue({ adminId }) {
  const [bets, setBets] = useState([])
  const [loading, setLoading] = useState(true)
  const [viewingScreenshot, setViewingScreenshot] = useState(null)
  const [flaggingBet, setFlaggingBet] = useState(null)
  const [flagReason, setFlagReason] = useState('')
  const [customReason, setCustomReason] = useState('')

  useEffect(() => { fetchUnreviewed() }, [])

  async function fetchUnreviewed() {
    const { data } = await supabase
      .from('bets')
      .select('*, user:profiles(username)')
      .eq('is_reviewed', false)
      .order('created_at', { ascending: false })
    setBets(data || [])
    setLoading(false)
  }

  async function handleApprove(bet) {
    await supabase
      .from('bets')
      .update({ is_reviewed: true, reviewed_at: new Date().toISOString() })
      .eq('id', bet.id)

    await fetchUnreviewed()
  }

  async function handleApproveAll() {
    const ids = bets.map(b => b.id)
    if (ids.length === 0) return

    await supabase
      .from('bets')
      .update({ is_reviewed: true, reviewed_at: new Date().toISOString() })
      .in('id', ids)

    await fetchUnreviewed()
  }

  async function handleFlag(bet) {
    const reason = flagReason === 'Other' ? customReason : flagReason
    if (!reason.trim()) return

    await supabase
      .from('bets')
      .update({
        is_flagged: true,
        flag_reason: reason,
        flagged_at: new Date().toISOString(),
        flagged_by: adminId,
        is_reviewed: true,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', bet.id)

    // Notify the user
    await supabase.rpc('insert_notification', {
      p_user_id: bet.user_id,
      p_type: 'bet_flagged',
      p_message: `Your bet ${bet.booking_code} has been flagged: ${reason}`,
      p_reference_id: bet.id,
    })

    await supabase.from('admin_actions').insert({
      admin_id: adminId,
      action_type: 'flag_bet',
      target_bet_id: bet.id,
      target_user_id: bet.user_id,
      details: `Flagged ${bet.user?.username}'s bet ${bet.booking_code}. Reason: ${reason}`,
    })

    setFlaggingBet(null)
    setFlagReason('')
    setCustomReason('')
    await fetchUnreviewed()
  }

  if (loading) return <div className="loading">Loading...</div>

  return (
    <div className="admin-section">
      {bets.length === 0 ? (
        <p className="empty-note">All bets reviewed. Nothing to review.</p>
      ) : (
        <>
          <div className="section-header-row">
            <span className="review-count">{bets.length} unreviewed</span>
            <button className="btn-small btn-primary" onClick={handleApproveAll}>
              Approve all
            </button>
          </div>

          {bets.map(bet => (
            <div key={bet.id} className="review-card">
              <div className="review-card-header">
                <strong>{bet.user?.username}</strong>
                <span className={`bet-outcome ${bet.outcome}`}>
                  {bet.outcome === 'pending' ? 'P' : bet.outcome === 'win' ? 'W' : 'L'}
                </span>
              </div>
              <div className="review-card-detail">
                <span>{bet.booking_code}</span>
                <span>{'₦'}{Number(bet.stake).toLocaleString()} @ {bet.odds}x</span>
                <span className="review-date">
                  {new Date(bet.created_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>

              <button
                className="btn-small btn-ghost"
                onClick={() => setViewingScreenshot(viewingScreenshot === bet.id ? null : bet.id)}
              >
                {viewingScreenshot === bet.id ? 'Hide proof' : 'View proof'}
              </button>
              {viewingScreenshot === bet.id && (
                <div className="screenshot-view">
                  <img src={bet.screenshot_url} alt="Bet screenshot" loading="lazy" />
                </div>
              )}

              {flaggingBet === bet.id ? (
                <div className="flag-form">
                  <div className="flag-reasons">
                    {ADMIN_FLAG_REASONS.map(r => (
                      <button key={r} type="button"
                        className={`flag-reason-btn ${flagReason === r ? 'selected' : ''}`}
                        onClick={() => setFlagReason(r)}>
                        {r}
                      </button>
                    ))}
                  </div>
                  {flagReason === 'Other' && (
                    <input type="text" placeholder="Describe the issue..."
                      value={customReason} onChange={e => setCustomReason(e.target.value)}
                      autoComplete="off" style={{ marginTop: 8 }} />
                  )}
                  <div className="flag-form-actions">
                    <button className="btn-small btn-danger"
                      onClick={() => handleFlag(bet)}
                      disabled={!flagReason || (flagReason === 'Other' && !customReason.trim())}>
                      Flag
                    </button>
                    <button className="btn-small btn-ghost"
                      onClick={() => { setFlaggingBet(null); setFlagReason(''); setCustomReason('') }}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="review-actions">
                  <button className="btn-small btn-primary" onClick={() => handleApprove(bet)}>
                    Approve
                  </button>
                  <button className="btn-small btn-warning" onClick={() => setFlaggingBet(bet.id)}>
                    Flag
                  </button>
                </div>
              )}
            </div>
          ))}
        </>
      )}
    </div>
  )
}

// ============================================
// FLAGGED BETS TAB (admin-initiated flags only)
// ============================================
function FlaggedBets({ adminId }) {
  const [flaggedBets, setFlaggedBets] = useState([])
  const [loading, setLoading] = useState(true)
  const [viewingScreenshot, setViewingScreenshot] = useState(null)

  useEffect(() => { fetchFlagged() }, [])

  async function fetchFlagged() {
    const { data } = await supabase
      .from('bets')
      .select('*, user:profiles(username)')
      .eq('is_flagged', true)
      .order('flagged_at', { ascending: false })
    setFlaggedBets(data || [])
    setLoading(false)
  }

  async function handleResolve(bet) {
    await supabase
      .from('bets')
      .update({ is_flagged: false, flag_reason: null, flagged_at: null, flagged_by: null })
      .eq('id', bet.id)

    // Notify user their flag is resolved
    await supabase.rpc('insert_notification', {
      p_user_id: bet.user_id,
      p_type: 'flag_resolved',
      p_message: `Your bet ${bet.booking_code} has been unflagged and restored to the leaderboard.`,
      p_reference_id: bet.id,
    })

    await supabase.from('admin_actions').insert({
      admin_id: adminId,
      action_type: 'resolve_flag',
      target_bet_id: bet.id,
      target_user_id: bet.user_id,
      details: `Unflagged ${bet.user?.username}'s bet ${bet.booking_code}`,
    })

    await fetchFlagged()
  }

  async function handleDelete(bet) {
    // Delete screenshot from storage
    if (bet.screenshot_url) {
      const path = bet.screenshot_url.split('/screenshots/')[1]?.split('?')[0]
      if (path) {
        await supabase.storage.from('screenshots').remove([decodeURIComponent(path)])
      }
    }

    await supabase.from('admin_actions').insert({
      admin_id: adminId,
      action_type: 'delete_bet',
      target_user_id: bet.user_id,
      details: `Deleted flagged bet from ${bet.user?.username}: ${bet.booking_code}, ${'₦'}${bet.stake} @ ${bet.odds} (${bet.outcome}). Reason: ${bet.flag_reason}`,
    })

    await supabase.from('bets').delete().eq('id', bet.id)
    await fetchFlagged()
  }

  if (loading) return <div className="loading">Loading...</div>

  return (
    <div className="admin-section">
      {flaggedBets.length === 0 ? (
        <p className="empty-note">No flagged bets.</p>
      ) : (
        flaggedBets.map(bet => (
          <div key={bet.id} className="flag-card">
            <div className="flag-card-header">
              <strong>{bet.user?.username}</strong>
              <span className={`bet-outcome ${bet.outcome}`}>
                {bet.outcome === 'pending' ? 'P' : bet.outcome === 'win' ? 'W' : 'L'}
              </span>
            </div>
            <div className="review-card-detail">
              <span>{bet.booking_code}</span>
              <span>{'₦'}{Number(bet.stake).toLocaleString()} @ {bet.odds}x</span>
            </div>
            <p className="flag-reason">Reason: {bet.flag_reason}</p>

            <button
              className="btn-small btn-ghost"
              onClick={() => setViewingScreenshot(viewingScreenshot === bet.id ? null : bet.id)}
            >
              {viewingScreenshot === bet.id ? 'Hide proof' : 'View proof'}
            </button>
            {viewingScreenshot === bet.id && (
              <div className="screenshot-view">
                <img src={bet.screenshot_url} alt="Bet screenshot" loading="lazy" />
              </div>
            )}

            <div className="flag-actions">
              <button className="btn-small btn-primary" onClick={() => handleResolve(bet)}>
                Unflag
              </button>
              <button className="btn-small btn-danger" onClick={() => handleDelete(bet)}>
                Delete bet
              </button>
            </div>
          </div>
        ))
      )}
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
  const [codeType, setCodeType] = useState('unlimited_permanent')
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
              onClick={() => setCodeType('unlimited_permanent')}>
              Unlimited, never expires
            </button>
            <button
              className={`code-type-btn ${codeType === 'unlimited_expiring' ? 'selected' : ''}`}
              onClick={() => setCodeType('unlimited_expiring')}>
              Unlimited, expires
            </button>
            <button
              className={`code-type-btn ${codeType === 'capped' ? 'selected' : ''}`}
              onClick={() => setCodeType('capped')}>
              Max uses
            </button>
          </div>

          {codeType === 'unlimited_expiring' && (
            <div className="form-group" style={{ marginTop: 12 }}>
              <label>Expires in (days)</label>
              <input type="number" inputMode="numeric" value={expiryDays}
                onChange={e => setExpiryDays(parseInt(e.target.value) || 1)} min="1" max="365" />
            </div>
          )}
          {codeType === 'capped' && (
            <div className="form-group" style={{ marginTop: 12 }}>
              <label>Maximum uses</label>
              <input type="number" inputMode="numeric" value={maxUses}
                onChange={e => setMaxUses(parseInt(e.target.value) || 1)} min="1" max="1000" />
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
                {code.use_count > 0 && <span> | {code.use_count} uses</span>}
                {code.expires_at && status !== 'expired' && (
                  <span> | Expires {new Date(code.expires_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })}</span>
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
// ADMIN ACTION LOG TAB
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
