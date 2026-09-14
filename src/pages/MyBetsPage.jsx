import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { calculateUserStats } from '../lib/utils'

export default function MyBetsPage() {
  const { profile } = useAuth()
  const [bets, setBets] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [viewingScreenshot, setViewingScreenshot] = useState(null)

  useEffect(() => {
    if (profile) fetchMyBets()
  }, [profile])

  async function fetchMyBets() {
    const { data } = await supabase
      .from('bets')
      .select('*')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })

    if (data) {
      setBets(data)
      setStats(calculateUserStats(data))
    }
    setLoading(false)
  }

  if (loading) return <div className="page"><div className="loading">Loading...</div></div>

  // Empty state for new users
  if (bets.length === 0) {
    return (
      <div className="page">
        <div className="page-header">
          <h1>My bets</h1>
        </div>
        <div className="empty-state">
          <p>You haven't logged any bets yet.</p>
          <p>Log your first settled bet to appear on the leaderboard. You need at least 3 bets to qualify for weekly rankings.</p>
          <Link to="/log-bet" className="btn btn-primary">Log a bet</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>My bets</h1>
      </div>

      {/* Personal stats summary */}
      {stats && (
        <div className="stats-card">
          <div className="stat-grid four">
            <div className="stat">
              <span className="stat-value large">
                <span className={stats.roi >= 0 ? 'positive' : 'negative'}>
                  {stats.roi >= 0 ? '+' : ''}{stats.roi.toFixed(1)}%
                </span>
              </span>
              <span className="stat-label">ROI</span>
            </div>
            <div className="stat">
              <span className="stat-value large">{stats.winRate.toFixed(0)}%</span>
              <span className="stat-label">Win rate</span>
            </div>
            <div className="stat">
              <span className="stat-value large">{stats.totalBets}</span>
              <span className="stat-label">Total bets</span>
            </div>
            <div className="stat">
              <span className="stat-value large">₦{stats.totalStaked.toLocaleString()}</span>
              <span className="stat-label">Total staked</span>
            </div>
          </div>
        </div>
      )}

      {/* Bet history */}
      <div className="bet-history">
        {bets.map(bet => (
          <div key={bet.id} className="bet-card">
            <div className="bet-card-top">
              <span className={`bet-outcome ${bet.outcome}`}>
                {bet.outcome === 'win' ? 'WIN' : 'LOSS'}
              </span>
              <span className="bet-date">
                {new Date(bet.created_at).toLocaleDateString('en-NG', {
                  day: 'numeric', month: 'short', year: 'numeric'
                })}
              </span>
            </div>
            <div className="bet-card-body">
              <div className="bet-card-row">
                <span className="bet-card-label">Code</span>
                <span className="bet-card-val">{bet.booking_code}</span>
              </div>
              <div className="bet-card-row">
                <span className="bet-card-label">Stake</span>
                <span className="bet-card-val">₦{Number(bet.stake).toLocaleString()}</span>
              </div>
              <div className="bet-card-row">
                <span className="bet-card-label">Odds</span>
                <span className="bet-card-val">{bet.odds}</span>
              </div>
              {bet.outcome === 'win' && (
                <div className="bet-card-row">
                  <span className="bet-card-label">Return</span>
                  <span className="bet-card-val positive">
                    ₦{(Number(bet.stake) * Number(bet.odds)).toLocaleString()}
                  </span>
                </div>
              )}
            </div>
            <button
              className="btn-small btn-ghost"
              onClick={() => setViewingScreenshot(viewingScreenshot === bet.id ? null : bet.id)}
            >
              {viewingScreenshot === bet.id ? 'Hide screenshot' : 'View screenshot'}
            </button>
            {viewingScreenshot === bet.id && (
              <div className="screenshot-view">
                <img src={bet.screenshot_url} alt="Bet screenshot" loading="lazy" />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
