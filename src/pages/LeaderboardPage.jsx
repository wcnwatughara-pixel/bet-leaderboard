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
  const { profile } = useAuth()
  const [tab, setTab] = useState('weekly') // 'weekly' or 'alltime'
  const [sortBy, setSortBy] = useState('winRate') // 'winRate' or 'roi'
  const [weekIndex, setWeekIndex] = useState(0) // 0 = current week
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
    const result = buildLeaderboard(userBetsMap, minBets, sortBy)
    setLeaderboard(result)
    setLoading(false)
  }

  // Simple toggle for expanded stats view (no individual bets on general)
  function handleExpand(userId) {
    setExpandedUser(expandedUser === userId ? null : userId)
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
        <h1>General</h1>
      </div>

      {/* Sort toggle */}
      <div className="sort-toggle">
        <span className="sort-label">Rank by</span>
        <button
          className={`sort-btn ${sortBy === 'winRate' ? 'active' : ''}`}
          onClick={() => setSortBy('winRate')}
        >
          Win rate
        </button>
        <button
          className={`sort-btn ${sortBy === 'roi' ? 'active' : ''}`}
          onClick={() => setSortBy('roi')}
        >
          ROI
        </button>
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
                  {sortBy === 'winRate' ? (
                    <span className="lb-winrate">{entry.winRate.toFixed(0)}%</span>
                  ) : (
                    <span className={`lb-roi ${entry.roi >= 0 ? 'positive' : 'negative'}`}>
                      {formatROI(entry.roi)}
                    </span>
                  )}
                </div>

                {/* Expanded: General always shows win rate, total bets, W/L, streak */}
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


