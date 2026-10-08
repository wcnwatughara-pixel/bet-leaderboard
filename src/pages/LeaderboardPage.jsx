import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import {
  formatWeekRange,
  getPastWeeks,
  buildLeaderboard,
} from '../lib/utils'

// Minimum bets to qualify: 3 for weekly, 10 for all-time
const WEEKLY_MIN = 3
const ALLTIME_MIN = 10

export default function LeaderboardPage() {
  const [homeTab, setHomeTab] = useState('leaderboard') // 'leaderboard' or 'shared'

  return (
    <div className="page">
      <div className="page-header">
        <h1>Home</h1>
      </div>

      <div className="tab-bar">
        <button
          className={`tab ${homeTab === 'leaderboard' ? 'active' : ''}`}
          onClick={() => setHomeTab('leaderboard')}
        >
          Leaderboard
        </button>
        <button
          className={`tab ${homeTab === 'shared' ? 'active' : ''}`}
          onClick={() => setHomeTab('shared')}
        >
          Shared Bets
        </button>
      </div>

      {homeTab === 'leaderboard' ? <LeaderboardTab /> : <SharedBetsFeed />}
    </div>
  )
}

// ============================================
// LEADERBOARD TAB
// ============================================
function LeaderboardTab() {
  const { profile } = useAuth()
  const [tab, setTab] = useState('weekly')
  const [sortBy, setSortBy] = useState('winRate')
  const [weekIndex, setWeekIndex] = useState(0)
  const [leaderboard, setLeaderboard] = useState({ qualified: [], unqualified: [], totalUsers: 0 })
  const [loading, setLoading] = useState(true)
  const [expandedUser, setExpandedUser] = useState(null)

  const weeks = getPastWeeks(12)

  useEffect(() => {
    fetchLeaderboard()
  }, [tab, weekIndex, sortBy])

  async function fetchLeaderboard() {
    setLoading(true)
    setExpandedUser(null)

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, is_admin, is_active')

    if (!profiles) { setLoading(false); return }

    let query = supabase.from('bets').select('*')
    if (tab === 'weekly') {
      const weekStart = weeks[weekIndex]
      const weekEnd = new Date(weekStart)
      weekEnd.setUTCDate(weekEnd.getUTCDate() + 7)
      query = query
        .gte('created_at', weekStart.toISOString())
        .lt('created_at', weekEnd.toISOString())
    }

    const { data: bets } = await query
    if (!bets) { setLoading(false); return }

    const userBetsMap = {}
    for (const p of profiles) {
      if (p.is_admin && !bets.some(b => b.user_id === p.id)) continue
      userBetsMap[p.id] = {
        username: p.username,
        bets: bets.filter(b => b.user_id === p.id),
      }
    }

    const minBets = tab === 'weekly' ? WEEKLY_MIN : ALLTIME_MIN
    const result = buildLeaderboard(userBetsMap, minBets, sortBy)
    setLeaderboard(result)
    setLoading(false)
  }

  function handleExpand(userId) {
    setExpandedUser(expandedUser === userId ? null : userId)
  }

  function formatROI(roi) {
    const sign = roi >= 0 ? '+' : ''
    return `${sign}${roi.toFixed(1)}%`
  }

  const currentWeekLabel = formatWeekRange(weeks[weekIndex])

  return (
    <>
      {/* Sort toggle */}
      <div className="sort-toggle">
        <span className="sort-label">Rank by</span>
        <button className={`sort-btn ${sortBy === 'winRate' ? 'active' : ''}`}
          onClick={() => setSortBy('winRate')}>Win rate</button>
        <button className={`sort-btn ${sortBy === 'roi' ? 'active' : ''}`}
          onClick={() => setSortBy('roi')}>ROI</button>
      </div>

      {/* Weekly / All-time toggle */}
      <div className="tab-bar">
        <button className={`tab ${tab === 'weekly' ? 'active' : ''}`}
          onClick={() => { setTab('weekly'); setWeekIndex(0) }}>Weekly</button>
        <button className={`tab ${tab === 'alltime' ? 'active' : ''}`}
          onClick={() => setTab('alltime')}>All-time</button>
      </div>

      {tab === 'weekly' && (
        <div className="week-selector">
          <button className="week-arrow" disabled={weekIndex >= weeks.length - 1}
            onClick={() => setWeekIndex(i => i + 1)}>&#8249;</button>
          <span className="week-label-display">{currentWeekLabel}</span>
          <button className="week-arrow" disabled={weekIndex === 0}
            onClick={() => setWeekIndex(i => i - 1)}>&#8250;</button>
        </div>
      )}

      {loading ? (
        <div className="loading">Loading...</div>
      ) : leaderboard.qualified.length === 0 ? (
        <div className="empty-state">
          <p>
            {tab === 'weekly'
              ? `No one qualified this week. ${WEEKLY_MIN} settled bets needed to rank.`
              : `No one qualified yet. ${ALLTIME_MIN} settled bets needed for all-time.`}
          </p>
          {leaderboard.unqualified.length > 0 && (
            <div className="unqualified-list">
              <p className="unqualified-heading">Progress this {tab === 'weekly' ? 'week' : 'period'}:</p>
              {leaderboard.unqualified.map(u => (
                <div key={u.userId} className="unqualified-row">
                  <span className="unq-name">{u.username}</span>
                  <span className="unq-count">{u.totalBets} / {tab === 'weekly' ? WEEKLY_MIN : ALLTIME_MIN} bets</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <>
          {leaderboard.qualified.length < leaderboard.totalUsers && (
            <p className="qualifier-note">
              {leaderboard.qualified.length} of {leaderboard.totalUsers} users qualified
            </p>
          )}

          <div className="leaderboard">
            {leaderboard.qualified.map(entry => (
              <div key={entry.userId} className="lb-entry">
                <div className="lb-row" onClick={() => handleExpand(entry.userId)}>
                  <span className={`lb-rank ${entry.rank <= 3 ? `rank-${entry.rank}` : ''}`}>
                    {entry.rank}
                  </span>
                  <span className="lb-name">
                    {entry.username}
                    {entry.userId === profile?.id && <span className="you-tag">you</span>}
                  </span>
                  {sortBy === 'winRate' ? (
                    <span className="lb-winrate">{entry.winRate.toFixed(0)}%</span>
                  ) : (
                    <span className={`lb-roi ${entry.roi >= 0 ? 'positive' : 'negative'}`}>
                      {formatROI(entry.roi)}
                    </span>
                  )}
                </div>

                {expandedUser === entry.userId && (
                  <div className="lb-expanded">
                    <div className="stat-grid">
                      <div className="stat">
                        <span className="stat-label">Win rate</span>
                        <span className="stat-value">{entry.winRate.toFixed(1)}%</span>
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
                  </div>
                )}
              </div>
            ))}
          </div>

          {leaderboard.unqualified.length > 0 && (
            <div className="unqualified-list">
              <p className="unqualified-heading">Not yet qualified:</p>
              {leaderboard.unqualified.map(u => (
                <div key={u.userId} className="unqualified-row">
                  <span className="unq-name">{u.username}</span>
                  <span className="unq-count">{u.totalBets} bets</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </>
  )
}

// ============================================
// SHARED BETS FEED
// ============================================
function SharedBetsFeed() {
  const { profile, session } = useAuth()
  const [sharedBets, setSharedBets] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchSharedBets()
  }, [])

  async function fetchSharedBets() {
    const { data } = await supabase
      .from('shared_bets')
      .select(`
        *,
        profiles:user_id (username),
        shared_bet_confirmations (id, user_id)
      `)
      .order('created_at', { ascending: false })
      .limit(50)

    if (data) setSharedBets(data)
    setLoading(false)
  }

  async function handleConfirm(sharedBetId) {
    if (!session) return

    const { error } = await supabase
      .from('shared_bet_confirmations')
      .insert({ shared_bet_id: sharedBetId, user_id: profile.id })

    if (!error) {
      // Optimistically update
      setSharedBets(prev => prev.map(sb => {
        if (sb.id !== sharedBetId) return sb
        return {
          ...sb,
          shared_bet_confirmations: [
            ...sb.shared_bet_confirmations,
            { id: 'temp', user_id: profile.id }
          ]
        }
      }))
    }
  }

  async function handleMarkOutcome(sharedBetId, outcome) {
    const { error } = await supabase
      .from('shared_bets')
      .update({ owner_outcome: outcome })
      .eq('id', sharedBetId)
      .eq('user_id', profile.id)

    if (!error) {
      setSharedBets(prev => prev.map(sb =>
        sb.id === sharedBetId ? { ...sb, owner_outcome: outcome } : sb
      ))
    }
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

  if (loading) return <div className="loading">Loading...</div>

  if (sharedBets.length === 0) {
    return (
      <div className="empty-state">
        <p>No shared bets yet.</p>
        <p>Share your bets from the My Bets page to appear here.</p>
      </div>
    )
  }

  return (
    <div className="shared-feed">
      {sharedBets.map(sb => {
        const isOwner = sb.user_id === profile?.id
        const hasConfirmed = sb.shared_bet_confirmations?.some(c => c.user_id === profile?.id)
        const confirmCount = sb.shared_bet_confirmations?.length || 0
        const isPre = !sb.owner_outcome
        const username = sb.profiles?.username || 'Unknown'

        return (
          <div key={sb.id} className="shared-card">
            <div className="shared-card-header">
              <span className="shared-user">{username}</span>
              <span className="shared-time">{formatTime(sb.created_at)}</span>
            </div>

            <div className="shared-card-body">
              <div className="shared-detail-row">
                <span className="label">Code</span>
                <span className="shared-code">{sb.booking_code}</span>
              </div>
              <div className="shared-detail-row">
                <span className="label">Odds</span>
                <span>{sb.odds}x</span>
              </div>
              {sb.num_games && (
                <div className="shared-detail-row">
                  <span className="label">Games</span>
                  <span>{sb.num_games}</span>
                </div>
              )}
              <div className="shared-detail-row">
                <span className="label">Status</span>
                {isPre ? (
                  <span className="shared-status pending">Awaiting result</span>
                ) : (
                  <span className={`shared-status ${sb.owner_outcome}`}>
                    {sb.owner_outcome === 'win' ? 'Won' : 'Lost'}
                  </span>
                )}
              </div>
            </div>

            {/* Screenshot */}
            {sb.screenshot_url && (
              <div className="shared-screenshot">
                <img src={sb.screenshot_url} alt="Bet slip" loading="lazy" />
              </div>
            )}

            {/* Result screenshot if post-result win */}
            {sb.result_screenshot_url && sb.result_screenshot_url !== sb.screenshot_url && (
              <div className="shared-screenshot">
                <img src={sb.result_screenshot_url} alt="Result" loading="lazy" />
              </div>
            )}

            {/* Actions bar */}
            <div className="shared-card-actions">
              {/* Owner can mark outcome on pre-result shares */}
              {isOwner && isPre && (
                <div className="shared-owner-actions">
                  <button className="btn-small btn-primary"
                    onClick={() => handleMarkOutcome(sb.id, 'win')}>Mark Win</button>
                  <button className="btn-small btn-danger"
                    onClick={() => handleMarkOutcome(sb.id, 'loss')}>Mark Loss</button>
                </div>
              )}

              {/* Community confirm */}
              {!isOwner && session && (
                <button
                  className={`btn-small ${hasConfirmed ? 'btn-ghost confirmed' : 'btn-ghost'}`}
                  onClick={() => !hasConfirmed && handleConfirm(sb.id)}
                  disabled={hasConfirmed}
                >
                  {hasConfirmed ? 'Confirmed' : 'Confirm'}
                </button>
              )}

              {confirmCount > 0 && (
                <span className="shared-confirm-count">
                  {confirmCount} confirmation{confirmCount !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
