import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import {
  getCurrentWeekStart,
  getCurrentWeekEnd,
  formatWeekRange,
  getPastWeeks,
  buildLeaderboard,
} from '../lib/utils'

// Minimum bets to qualify: 3 for weekly, 10 for all-time
const WEEKLY_MIN = 3
const ALLTIME_MIN = 10

export default function LeaderboardPage() {
  const { profile } = useAuth()
  const [tab, setTab] = useState('weekly') // 'weekly' or 'alltime'
  const [weekIndex, setWeekIndex] = useState(0) // 0 = current week
  const [leaderboard, setLeaderboard] = useState({ qualified: [], unqualified: [], totalUsers: 0 })
  const [loading, setLoading] = useState(true)
  const [expandedUser, setExpandedUser] = useState(null)
  const [userBets, setUserBets] = useState({}) // userId -> bets for expanded view

  const weeks = getPastWeeks(12)

  useEffect(() => {
    fetchLeaderboard()
  }, [tab, weekIndex])

  async function fetchLeaderboard() {
    setLoading(true)
    setExpandedUser(null)

    // Fetch all profiles (including inactive for display)
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, is_admin, is_active')

    if (!profiles) {
      setLoading(false)
      return
    }

    // Build the query for bets based on the active tab/week
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

    if (!bets) {
      setLoading(false)
      return
    }

    // Group bets by user, excluding admin-only accounts (no bets)
    const userBetsMap = {}
    for (const p of profiles) {
      if (p.is_admin && !bets.some(b => b.user_id === p.id)) continue
      userBetsMap[p.id] = {
        username: p.username,
        bets: bets.filter(b => b.user_id === p.id),
      }
    }

    const minBets = tab === 'weekly' ? WEEKLY_MIN : ALLTIME_MIN
    const result = buildLeaderboard(userBetsMap, minBets)
    setLeaderboard(result)
    setLoading(false)
  }

  // Fetch individual bets when a user row is expanded
  async function handleExpand(userId) {
    if (expandedUser === userId) {
      setExpandedUser(null)
      return
    }
    setExpandedUser(userId)

    if (!userBets[userId]) {
      let query = supabase
        .from('bets')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (tab === 'weekly') {
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

  function formatStreak(streak) {
    if (!streak.type || streak.count === 0) return ''
    const letter = streak.type === 'win' ? 'W' : 'L'
    return `${letter}${streak.count} (${streak.avgOdds} avg)`
  }

  const currentWeekLabel = formatWeekRange(weeks[weekIndex])

  return (
    <div className="page">
      <div className="page-header">
        <h1>Sharpest</h1>
      </div>

      {/* Tab toggle */}
      <div className="tab-bar">
        <button
          className={`tab ${tab === 'weekly' ? 'active' : ''}`}
          onClick={() => { setTab('weekly'); setWeekIndex(0) }}
        >
          Weekly
        </button>
        <button
          className={`tab ${tab === 'alltime' ? 'active' : ''}`}
          onClick={() => setTab('alltime')}
        >
          All-time
        </button>
      </div>

      {/* Week selector for weekly tab */}
      {tab === 'weekly' && (
        <div className="week-selector">
          <button
            className="week-arrow"
            disabled={weekIndex >= weeks.length - 1}
            onClick={() => setWeekIndex(i => i + 1)}
          >
            ‹
          </button>
          <span className="week-label-display">{currentWeekLabel}</span>
          <button
            className="week-arrow"
            disabled={weekIndex === 0}
            onClick={() => setWeekIndex(i => i - 1)}
          >
            ›
          </button>
        </div>
      )}

      {loading ? (
        <div className="loading">Loading...</div>
      ) : leaderboard.qualified.length === 0 ? (
        <div className="empty-state">
          <p>
            {tab === 'weekly'
              ? `No one qualified this week. ${WEEKLY_MIN} settled bets needed to rank.`
              : `No one qualified yet. ${ALLTIME_MIN} settled bets needed for all-time.`
            }
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
          {/* Qualified count context */}
          {leaderboard.qualified.length < leaderboard.totalUsers && (
            <p className="qualifier-note">
              {leaderboard.qualified.length} of {leaderboard.totalUsers} users qualified
            </p>
          )}

          {/* Leaderboard table */}
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
                  <span className="lb-winrate">
                    {entry.winRate.toFixed(0)}%
                  </span>
                </div>

                {/* Expanded details */}
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

                    {/* Individual bets */}
                    {userBets[entry.userId] && (
                      <div className="bet-list">
                        {userBets[entry.userId].map(bet => (
                          <BetRow key={bet.id} bet={bet} />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Unqualified users below */}
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
    </div>
  )
}

// Individual bet row with lazy-loaded screenshot and flag button
function BetRow({ bet }) {
  const { profile } = useAuth()
  const [showScreenshot, setShowScreenshot] = useState(false)
  const [flagging, setFlagging] = useState(false)
  const [flagReason, setFlagReason] = useState('')
  const [flagStatus, setFlagStatus] = useState(null) // null, 'sent', 'error', 'exists'

  async function handleFlag() {
    if (!flagging) {
      setFlagging(true)
      return
    }

    const { error } = await supabase
      .from('flags')
      .insert({
        bet_id: bet.id,
        flagged_by: profile.id,
        reason: flagReason.trim() || null,
      })

    if (error) {
      if (error.code === '23505') {
        setFlagStatus('exists')
      } else {
        setFlagStatus('error')
      }
    } else {
      setFlagStatus('sent')
    }
    setFlagging(false)
  }

  return (
    <div className="bet-row-detail">
      <div className="bet-row-main">
        <span className={`bet-outcome ${bet.outcome}`}>{bet.outcome === 'win' ? 'W' : 'L'}</span>
        <span className="bet-code">{bet.booking_code}</span>
      </div>
      <div className="bet-row-stats">
        <span>₦{Number(bet.stake).toLocaleString()} stake</span>
        <span>{bet.odds}x odds</span>
        {bet.outcome === 'win' && (
          <span className="positive">₦{(Number(bet.stake) * Number(bet.odds)).toLocaleString()} return</span>
        )}
        {bet.outcome === 'loss' && (
          <span className="negative">-₦{Number(bet.stake).toLocaleString()}</span>
        )}
      </div>

      <div className="bet-row-actions">
        <button
          className="btn-small btn-ghost"
          onClick={() => setShowScreenshot(!showScreenshot)}
        >
          {showScreenshot ? 'Hide proof' : 'View proof'}
        </button>
        {profile && bet.user_id !== profile.id && (
          <button className="btn-small btn-ghost flag" onClick={handleFlag}>
            {flagging ? '' : '⚑'}
          </button>
        )}
        {/* Self-flag for corrections */}
        {profile && bet.user_id === profile.id && (
          <button className="btn-small btn-ghost flag" onClick={handleFlag}>
            {flagging ? '' : '✎'}
          </button>
        )}
      </div>

      {/* Flag reason input */}
      {flagging && (
        <div className="flag-input">
          <input
            type="text"
            placeholder="What's wrong? (optional)"
            maxLength={200}
            value={flagReason}
            onChange={e => setFlagReason(e.target.value)}
          />
          <button className="btn-small btn-primary" onClick={handleFlag}>Submit flag</button>
          <button className="btn-small btn-ghost" onClick={() => setFlagging(false)}>Cancel</button>
        </div>
      )}

      {flagStatus === 'sent' && <p className="flag-msg">Flagged for review.</p>}
      {flagStatus === 'exists' && <p className="flag-msg">You already flagged this bet.</p>}
      {flagStatus === 'error' && <p className="flag-msg">Failed to flag. Try again.</p>}

      {/* Lazy-loaded screenshot */}
      {showScreenshot && (
        <div className="screenshot-view">
          <img src={bet.screenshot_url} alt="Bet screenshot" loading="lazy" />
        </div>
      )}
    </div>
  )
}
