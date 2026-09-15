import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

export default function BrowseLeaguesPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [leagues, setLeagues] = useState([])
  const [myLeagueIds, setMyLeagueIds] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState(null)

  useEffect(() => {
    fetchData()
  }, [profile])

  async function fetchData() {
    // Fetch open, non-archived leagues
    const { data: openLeagues } = await supabase
      .from('leagues')
      .select('*, profiles:created_by(username)')
      .eq('access_type', 'open')
      .eq('is_archived', false)
      .order('created_at', { ascending: false })

    // Fetch user's current memberships
    const { data: memberships } = await supabase
      .from('league_members')
      .select('league_id')
      .eq('user_id', profile.id)
      .eq('is_active', true)

    setLeagues(openLeagues || [])
    setMyLeagueIds(new Set((memberships || []).map(m => m.league_id)))
    setLoading(false)
  }

  async function handleJoin(league) {
    setJoining(league.id)

    await supabase.from('league_members').insert({
      league_id: league.id,
      user_id: profile.id,
      role: 'member',
    })

    await supabase.from('league_activity').insert({
      league_id: league.id,
      user_id: profile.id,
      event_type: 'member_joined',
      details: `${profile.username} joined the league`,
    })

    setJoining(null)
    navigate(`/leagues/${league.slug}`)
  }

  if (loading) return <div className="page"><div className="loading">Loading...</div></div>

  return (
    <div className="page">
      <div className="page-header">
        <h1>Browse leagues</h1>
      </div>

      {leagues.length === 0 ? (
        <div className="empty-state">
          <p>No open leagues available right now.</p>
        </div>
      ) : (
        <div className="league-list">
          {leagues.map(league => {
            const isMember = myLeagueIds.has(league.id)
            return (
              <div key={league.id} className="league-card">
                <div className="league-card-top">
                  <span className="league-name">{league.name}</span>
                  <span className={`league-type-badge ${league.league_type}`}>
                    {league.league_type === 'challenge' ? 'Challenge' : 'Ongoing'}
                  </span>
                </div>
                {league.description && (
                  <p className="league-desc">{league.description}</p>
                )}
                <p className="league-creator">by {league.profiles?.username}</p>
                {isMember ? (
                  <button
                    className="btn-small btn-ghost"
                    onClick={() => navigate(`/leagues/${league.slug}`)}
                  >
                    View league
                  </button>
                ) : (
                  <button
                    className="btn-small btn-primary"
                    style={{ fontSize: '0.75rem', padding: '6px 10px' }}
                    onClick={() => handleJoin(league)}
                    disabled={joining === league.id}
                  >
                    {joining === league.id ? 'Joining...' : 'Join'}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
