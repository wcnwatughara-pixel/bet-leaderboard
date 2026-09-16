import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import BetRow from '../../components/BetRow'
import {
  getCurrentWeekStart,
  formatWeekRange,
  getPastWeeks,
  buildLeaderboard,
} from '../../lib/utils'

export default function LeagueDetailPage() {
  const { slug } = useParams()
  const { profile, isAdmin: isAppAdmin } = useAuth()
  const navigate = useNavigate()
  const [league, setLeague] = useState(null)
  const [members, setMembers] = useState([])
  const [myMembership, setMyMembership] = useState(null)
  const [tab, setTab] = useState('board') // 'board', 'activity', 'settings'
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchLeague()
  }, [slug, profile])

  async function fetchLeague() {
    // Fetch league by slug
    const { data: leagueData } = await supabase
      .from('leagues')
      .select('*, creator:profiles!leagues_created_by_fkey(username)')
      .eq('slug', slug)
      .single()

    if (!leagueData) {
      setLoading(false)
      return
    }

    setLeague(leagueData)

    // Fetch members
    const { data: memberData } = await supabase
      .from('league_members')
      .select('*, profiles:user_id(id, username, is_active)')
      .eq('league_id', leagueData.id)

    setMembers(memberData || [])
    setMyMembership(memberData?.find(m => m.user_id === profile?.id) || null)
    setLoading(false)
  }

  if (loading) return <div className="page"><div className="loading">Loading...</div></div>

  if (!league) {
    return (
      <div className="page">
        <div className="empty-state">
          <p>League not found.</p>
          <button className="btn btn-primary" onClick={() => navigate('/leagues')} style={{ maxWidth: 200, margin: '16px auto 0' }}>
            Back to leagues
          </button>
        </div>
      </div>
    )
  }

  const isLeagueAdmin = myMembership?.role === 'admin' || isAppAdmin

  return (
    <div className="page">
      <div className="page-header">
        <h1>{league.name}</h1>
        {league.description && <p className="week-label">{league.description}</p>}
        <p className="week-label">
          by {league.creator?.username}
          {league.is_archived && ' · Archived'}
        </p>
      </div>

      <div className="tab-bar">
        <button className={`tab ${tab === 'board' ? 'active' : ''}`} onClick={() => setTab('board')}>
          Board
        </button>
        <button className={`tab ${tab === 'activity' ? 'active' : ''}`} onClick={() => setTab('activity')}>
          Activity
        </button>
        {isLeagueAdmin && (
          <button className={`tab ${tab === 'settings' ? 'active' : ''}`} onClick={() => setTab('settings')}>
            Settings
          </button>
        )}
      </div>

      {tab === 'board' && (
        <LeagueBoard league={league} members={members} />
      )}
      {tab === 'activity' && (
        <LeagueActivity leagueId={league.id} />
      )}
      {tab === 'settings' && isLeagueAdmin && (
        <LeagueSettings
          league={league}
          members={members}
          onUpdate={fetchLeague}
          profile={profile}
        />
      )}

      {/* Leave league button for non-admin members */}
      {myMembership && !isLeagueAdmin && !league.is_archived && (
        <LeaveButton leagueId={league.id} profile={profile} onLeave={() => navigate('/leagues')} />
      )}
    </div>
  )
}

// ============================================
// LEAGUE LEADERBOARD
// ============================================
function LeagueBoard({ league, members }) {
  const [leaderboard, setLeaderboard] = useState({ qualified: [], unqualified: [], totalUsers: 0 })
  const [tab, setTab] = useState('weekly')
  const [sortBy, setSortBy] = useState('winRate')
  const [weekIndex, setWeekIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [expandedUser, setExpandedUser] = useState(null)
  const [userBets, setUserBets] = useState({})

  const weeks = getPastWeeks(12)
  const isChallenge = league.league_type === 'challenge'

  useEffect(() => {
    fetchBoard()
  }, [tab, weekIndex, members, sortBy])

  async function fetchBoard() {
    setLoading(true)
    setExpandedUser(null)
    const memberUserIds = members.map(m => m.user_id)

    if (memberUserIds.length === 0) {
      setLeaderboard({ qualified: [], unqualified: [], totalUsers: 0 })
      setLoading(false)
      return
    }

    let query = supabase
      .from('bets')
      .select('*')
      .in('user_id', memberUserIds)

    if (isChallenge) {
      query = query
        .gte('created_at', league.challenge_start)
        .lte('created_at', league.challenge_end)
    } else if (tab === 'weekly') {
      const weekStart = weeks[weekIndex]
      const weekEnd = new Date(weekStart)
      weekEnd.setUTCDate(weekEnd.getUTCDate() + 7)
      query = query
        .gte('created_at', weekStart.toISOString())
        .lt('created_at', weekEnd.toISOString())
    }

    const { data: bets } = await query

    const userBetsMap = {}
    for (const m of members) {
      if (!m.profiles) continue
      userBetsMap[m.user_id] = {
        username: m.profiles.username,
        bets: (bets || []).filter(b => b.user_id === m.user_id),
      }
    }

    const minBets = league.min_bets_weekly || 3
    const result = buildLeaderboard(userBetsMap, minBets, sortBy)
    setLeaderboard(result)
    setLoading(false)
  }

  // Fetch individual bets when a user row is expanded in a league
  async function handleExpand(userId) {
    if (expandedUser === userId) {
      setExpandedUser(null)
      return
    }
    setExpandedUser(userId)

    if (!userBets[userId]) {
      const memberUserIds = members.map(m => m.user_id)
      let query = supabase
        .from('bets')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (isChallenge) {
        query = query
          .gte('created_at', league.challenge_start)
          .lte('created_at', league.challenge_end)
      } else if (tab === 'weekly') {
        const weekStart = weeks[weekIndex]
        const weekEnd = new Date(weekStart)
        weekEnd.setUTCDate(weekEnd.getUTCDate() + 7)
        query = query
          .gte('created_at', weekStart.toISOString())
          .lt('created_at', weekEnd.toISOString())
      }

      const { data } = await query
      setUserBets(prev => ({ ...prev, [userId]: data || [] }))
    }
  }

  function formatROI(roi) {
    const sign = roi >= 0 ? '+' : ''
    return `${sign}${roi.toFixed(1)}%`
  }

  return (
    <div>
      {/* Sort toggle */}
      <div className="sort-toggle">
        <span className="sort-label">Rank by</span>
        <button className={`sort-btn ${sortBy === 'winRate' ? 'active' : ''}`} onClick={() => setSortBy('winRate')}>
          Win rate
        </button>
        <button className={`sort-btn ${sortBy === 'roi' ? 'active' : ''}`} onClick={() => setSortBy('roi')}>
          ROI
        </button>
      </div>

      {/* Ongoing leagues get weekly/all-time tabs; challenges don't */}
      {!isChallenge && (
        <>
          <div className="tab-bar" style={{ marginBottom: 8 }}>
            <button className={`tab ${tab === 'weekly' ? 'active' : ''}`} onClick={() => { setTab('weekly'); setWeekIndex(0) }}>
              Weekly
            </button>
            <button className={`tab ${tab === 'alltime' ? 'active' : ''}`} onClick={() => setTab('alltime')}>
              All-time
            </button>
          </div>

          {tab === 'weekly' && (
            <div className="week-selector">
              <button className="week-arrow" disabled={weekIndex >= weeks.length - 1} onClick={() => setWeekIndex(i => i + 1)}>‹</button>
              <span className="week-label-display">{formatWeekRange(weeks[weekIndex])}</span>
              <button className="week-arrow" disabled={weekIndex === 0} onClick={() => setWeekIndex(i => i - 1)}>›</button>
            </div>
          )}
        </>
      )}

      {isChallenge && (
        <p className="qualifier-note" style={{ marginBottom: 12 }}>
          {new Date(league.challenge_start).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })}
          {' - '}
          {new Date(league.challenge_end).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })}
        </p>
      )}

      {loading ? (
        <div className="loading">Loading...</div>
      ) : leaderboard.qualified.length === 0 ? (
        <div className="empty-state">
          <p>No one qualified yet. {league.min_bets_weekly} settled bets needed.</p>
          {leaderboard.unqualified.length > 0 && (
            <div className="unqualified-list">
              {leaderboard.unqualified.map(u => (
                <div key={u.userId} className="unqualified-row">
                  <span className="unq-name">{u.username}</span>
                  <span className="unq-count">{u.totalBets} / {league.min_bets_weekly} bets</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="leaderboard">
          {leaderboard.qualified.map(entry => (
            <div key={entry.userId} className="lb-entry">
              <div className="lb-row" onClick={() => handleExpand(entry.userId)}>
                <span className={`lb-rank ${entry.rank <= 3 ? `rank-${entry.rank}` : ''}`}>{entry.rank}</span>
                <span className="lb-name">{entry.username}</span>
                {sortBy === 'winRate' ? (
                  <span className="lb-winrate">{entry.winRate.toFixed(0)}%</span>
                ) : (
                  <span className={`lb-roi ${entry.roi >= 0 ? 'positive' : 'negative'}`}>
                    {formatROI(entry.roi)}
                  </span>
                )}
              </div>

              {/* Expanded: League shows ROI, total bets, W/L, streak + individual bets */}
              {expandedUser === entry.userId && (
                <div className="lb-expanded">
                  <div className="stat-grid">
                    <div className="stat">
                      <span className="stat-label">ROI</span>
                      <span className={`stat-value ${entry.roi >= 0 ? 'positive' : 'negative'}`}>
                        {formatROI(entry.roi)}
                      </span>
                    </div>
                    <div className="stat">
                      <span className="stat-label">Total bets</span>
                      <span className="stat-value">{entry.totalBets}</span>
                    </div>
                    <div className="stat">
                      <span className="stat-label">W / L</span>
                      <span className="stat-value">{entry.wins} / {entry.losses}</span>
                    </div>
                    <div className="stat">
                      <span className="stat-label">Streak</span>
                      <span className={`stat-value ${entry.streak.type === 'win' ? 'positive' : 'negative'}`}>
                        {entry.streak.type
                          ? `${entry.streak.type === 'win' ? 'W' : 'L'}${entry.streak.count} at ${entry.streak.avgOdds} avg odds`
                          : 'None'}
                      </span>
                    </div>
                  </div>

                  {/* Individual bets with screenshots and flags */}
                  {userBets[entry.userId] && (
                    <div className="bet-list">
                      {userBets[entry.userId].map(bet => (
                        <BetRow key={bet.id} bet={bet} leagueId={league.id} />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ============================================
// LEAGUE ACTIVITY FEED
// ============================================
function LeagueActivity({ leagueId }) {
  const [activity, setActivity] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetch() {
      const { data } = await supabase
        .from('league_activity')
        .select('*, profiles:user_id(username)')
        .eq('league_id', leagueId)
        .order('created_at', { ascending: false })
        .limit(50)
      setActivity(data || [])
      setLoading(false)
    }
    fetch()
  }, [leagueId])

  if (loading) return <div className="loading">Loading...</div>

  if (activity.length === 0) {
    return <div className="empty-state"><p>No activity yet.</p></div>
  }

  return (
    <div className="admin-section">
      {activity.map(a => (
        <div key={a.id} className="log-entry">
          <div className="log-header">
            <span className={`log-type ${a.event_type}`}>
              {a.event_type.replace(/_/g, ' ')}
            </span>
            <span className="log-date">
              {new Date(a.created_at).toLocaleDateString('en-NG', {
                day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
              })}
            </span>
          </div>
          <p className="log-detail">{a.details}</p>
        </div>
      ))}
    </div>
  )
}

// ============================================
// LEAGUE SETTINGS (league admin only)
// ============================================
function LeagueSettings({ league, members, onUpdate, profile }) {
  const [inviteCodes, setInviteCodes] = useState([])
  const [copiedId, setCopiedId] = useState(null)
  const [generating, setGenerating] = useState(false)

  // Edit league state
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState(league.name)
  const [editDesc, setEditDesc] = useState(league.description || '')
  const [editAccess, setEditAccess] = useState(league.access_type)
  const [editMinBets, setEditMinBets] = useState(league.min_bets_weekly)
  const [editError, setEditError] = useState('')
  const [saving, setSaving] = useState(false)

  // Member action confirmations
  const [confirmKick, setConfirmKick] = useState(null) // member id to kick
  const [confirmTransfer, setConfirmTransfer] = useState(null) // member id to transfer to

  useEffect(() => {
    fetchCodes()
  }, [league.id])

  async function fetchCodes() {
    const { data } = await supabase
      .from('league_invite_codes')
      .select('*')
      .eq('league_id', league.id)
      .order('created_at', { ascending: false })
    setInviteCodes(data || [])
  }

  async function generateCode() {
    setGenerating(true)
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    let code = 'LG-'
    for (let i = 0; i < 4; i++) {
      code += chars[Math.floor(Math.random() * chars.length)]
    }

    await supabase.from('league_invite_codes').insert({
      league_id: league.id,
      code,
      created_by: profile.id,
      max_uses: null,
      is_active: true,
    })

    await fetchCodes()
    setGenerating(false)
  }

  function copyLink(code) {
    const url = `${window.location.origin}/league/join/${code.code}`
    navigator.clipboard.writeText(url).then(() => {
      setCopiedId(code.id)
      setTimeout(() => setCopiedId(null), 2000)
    })
  }

  async function toggleCodeActive(code) {
    await supabase
      .from('league_invite_codes')
      .update({ is_active: !code.is_active })
      .eq('id', code.id)
    await fetchCodes()
  }

  // ---- EDIT LEAGUE ----
  async function handleSaveEdit() {
    setEditError('')
    if (editName.trim().length < 2) {
      setEditError('League name must be at least 2 characters.')
      return
    }
    setSaving(true)

    const { error } = await supabase
      .from('leagues')
      .update({
        name: editName.trim(),
        description: editDesc.trim() || null,
        access_type: editAccess,
        min_bets_weekly: editMinBets,
      })
      .eq('id', league.id)

    if (error) {
      setEditError(error.message || 'Failed to save.')
    } else {
      await supabase.from('league_activity').insert({
        league_id: league.id,
        user_id: profile.id,
        event_type: 'league_edited',
        details: `${profile.username} updated league settings`,
      })
      setEditing(false)
      onUpdate()
    }
    setSaving(false)
  }

  // ---- KICK MEMBER ----
  async function handleKick(member) {
    // Remove membership entirely so they can rejoin later if invited
    await supabase
      .from('league_members')
      .delete()
      .eq('id', member.id)

    await supabase.from('league_activity').insert({
      league_id: league.id,
      user_id: profile.id,
      event_type: 'member_removed',
      details: `${profile.username} removed ${member.profiles?.username} from the league`,
    })

    setConfirmKick(null)
    onUpdate()
  }

  // ---- TRANSFER ADMIN ----
  async function handleTransfer(member) {
    // Set the target member as admin
    await supabase
      .from('league_members')
      .update({ role: 'admin' })
      .eq('id', member.id)

    // Demote current admin to member
    const myMembership = members.find(m => m.user_id === profile.id)
    if (myMembership) {
      await supabase
        .from('league_members')
        .update({ role: 'member' })
        .eq('id', myMembership.id)
    }

    // Update league creator reference
    await supabase
      .from('leagues')
      .update({ created_by: member.user_id })
      .eq('id', league.id)

    await supabase.from('league_activity').insert({
      league_id: league.id,
      user_id: profile.id,
      event_type: 'admin_transferred',
      details: `${profile.username} transferred admin to ${member.profiles?.username}`,
    })

    setConfirmTransfer(null)
    onUpdate()
  }

  // ---- ARCHIVE ----
  async function handleArchive() {
    if (!confirm('Archive this league? It becomes read-only.')) return
    await supabase
      .from('leagues')
      .update({ is_archived: true })
      .eq('id', league.id)

    await supabase.from('league_activity').insert({
      league_id: league.id,
      user_id: profile.id,
      event_type: 'league_archived',
      details: `${profile.username} archived the league`,
    })

    onUpdate()
  }

  return (
    <div className="admin-section">

      {/* ---- EDIT LEAGUE ---- */}
      <h2 className="section-title">League info</h2>
      {!editing ? (
        <div className="league-info-display">
          <p className="league-info-row"><span className="league-info-label">Name:</span> {league.name}</p>
          <p className="league-info-row"><span className="league-info-label">Description:</span> {league.description || 'None'}</p>
          <p className="league-info-row"><span className="league-info-label">Access:</span> {league.access_type === 'open' ? 'Open' : 'Invite only'}</p>
          <p className="league-info-row"><span className="league-info-label">Min bets:</span> {league.min_bets_weekly}</p>
          {!league.is_archived && (
            <button className="btn-small btn-ghost" style={{ marginTop: 8 }} onClick={() => setEditing(true)}>
              Edit
            </button>
          )}
        </div>
      ) : (
        <div className="league-edit-form">
          <div className="form-group">
            <label htmlFor="editName">Name</label>
            <input id="editName" type="text" value={editName} onChange={e => setEditName(e.target.value)} maxLength={50} />
          </div>
          <div className="form-group">
            <label htmlFor="editDesc">Description</label>
            <input id="editDesc" type="text" value={editDesc} onChange={e => setEditDesc(e.target.value)} maxLength={120} />
          </div>
          <div className="form-group">
            <label>Access</label>
            <div className="outcome-toggle">
              <button type="button" className={`outcome-btn ${editAccess === 'invite' ? 'win selected' : ''}`} onClick={() => setEditAccess('invite')}>
                Invite only
              </button>
              <button type="button" className={`outcome-btn ${editAccess === 'open' ? 'win selected' : ''}`} onClick={() => setEditAccess('open')}>
                Open
              </button>
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="editMinBets">Min bets to qualify</label>
            <input id="editMinBets" type="number" inputMode="numeric" value={editMinBets} onChange={e => setEditMinBets(parseInt(e.target.value) || 1)} min="1" max="50" />
          </div>
          {editError && <div className="form-error">{editError}</div>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-small btn-primary" onClick={handleSaveEdit} disabled={saving} style={{ fontSize: '0.75rem', padding: '8px 12px' }}>
              {saving ? 'Saving...' : 'Save changes'}
            </button>
            <button className="btn-small btn-ghost" onClick={() => { setEditing(false); setEditError('') }}>Cancel</button>
          </div>
        </div>
      )}

      {/* ---- INVITE CODES ---- */}
      <h2 className="section-title" style={{ marginTop: 24 }}>Invite codes</h2>
      {!league.is_archived && (
        <button className="btn-small btn-primary" onClick={generateCode} disabled={generating} style={{ marginBottom: 12, fontSize: '0.75rem', padding: '8px 12px' }}>
          {generating ? 'Generating...' : 'Generate league code'}
        </button>
      )}

      {inviteCodes.map(code => (
        <div key={code.id} className={`code-item ${code.is_active ? 'active' : 'deactivated'}`}>
          <div className="code-main">
            <span className="code-string">{code.code}</span>
            <span className={`code-status-badge ${code.is_active ? 'active' : 'deactivated'}`}>
              {code.is_active ? 'active' : 'off'}
            </span>
          </div>
          <div className="code-meta">
            <span>{code.use_count} uses</span>
          </div>
          <div className="code-actions">
            <button className="btn-small btn-ghost" onClick={() => copyLink(code)}>
              {copiedId === code.id ? 'Copied!' : 'Copy link'}
            </button>
            {!league.is_archived && (
              <button className="btn-small btn-ghost" onClick={() => toggleCodeActive(code)}>
                {code.is_active ? 'Deactivate' : 'Reactivate'}
              </button>
            )}
          </div>
        </div>
      ))}

      {/* ---- MEMBERS ---- */}
      <h2 className="section-title" style={{ marginTop: 24 }}>Members ({members.length})</h2>
      {members.map(m => {
        const isMe = m.user_id === profile.id
        const isMemberAdmin = m.role === 'admin'

        return (
          <div key={m.id} className={`user-card ${!m.is_active ? 'inactive' : ''}`}>
            <div className="user-card-main">
              <span className="user-name">
                {m.profiles?.username}
                {isMemberAdmin && <span className="admin-badge">admin</span>}
                {isMe && <span className="you-tag">you</span>}
              </span>
            </div>

            {/* Action buttons: only show for non-self, non-archived leagues */}
            {!isMe && !league.is_archived && m.is_active && (
              <div className="member-actions">
                {/* Kick confirmation */}
                {confirmKick === m.id ? (
                  <div className="member-confirm">
                    <span className="member-confirm-text">Remove {m.profiles?.username}?</span>
                    <button className="btn-small btn-danger" onClick={() => handleKick(m)}>Yes</button>
                    <button className="btn-small btn-ghost" onClick={() => setConfirmKick(null)}>No</button>
                  </div>
                ) : confirmTransfer === m.id ? (
                  <div className="member-confirm">
                    <span className="member-confirm-text">Transfer admin to {m.profiles?.username}? You will become a regular member.</span>
                    <button className="btn-small btn-warning" onClick={() => handleTransfer(m)}>Yes</button>
                    <button className="btn-small btn-ghost" onClick={() => setConfirmTransfer(null)}>No</button>
                  </div>
                ) : (
                  <>
                    {!isMemberAdmin && (
                      <button className="btn-small btn-danger" onClick={() => setConfirmKick(m.id)}>Remove</button>
                    )}
                    {!isMemberAdmin && (
                      <button className="btn-small btn-ghost" onClick={() => setConfirmTransfer(m.id)}>
                        Make admin
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )
      })}

      {/* ---- DANGER ZONE ---- */}
      {!league.is_archived && (
        <>
          <h2 className="section-title" style={{ marginTop: 24 }}>Danger zone</h2>
          <button className="btn-small btn-danger" onClick={handleArchive}>
            Archive league
          </button>
        </>
      )}
    </div>
  )
}

// ============================================
// LEAVE LEAGUE BUTTON
// ============================================
function LeaveButton({ leagueId, profile, onLeave }) {
  const [confirming, setConfirming] = useState(false)

  async function handleLeave() {
    await supabase
      .from('league_members')
      .update({ is_active: false })
      .eq('league_id', leagueId)
      .eq('user_id', profile.id)

    await supabase.from('league_activity').insert({
      league_id: leagueId,
      user_id: profile.id,
      event_type: 'member_left',
      details: `${profile.username} left the league`,
    })

    onLeave()
  }

  if (confirming) {
    return (
      <div className="confirm-prompt" style={{ marginTop: 20 }}>
        Leave this league? Your historical bets stay on the board.
        <div className="confirm-actions">
          <button onClick={handleLeave}>Yes, leave</button>
          <button onClick={() => setConfirming(false)}>Cancel</button>
        </div>
      </div>
    )
  }

  return (
    <button className="btn-small btn-danger" style={{ marginTop: 20 }} onClick={() => setConfirming(true)}>
      Leave league
    </button>
  )
}
