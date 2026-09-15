import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

export default function MyLeaguesPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [leagues, setLeagues] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (profile) fetchMyLeagues()
  }, [profile])

  async function fetchMyLeagues() {
    // Get all leagues this user is a member of
    const { data: memberships } = await supabase
      .from('league_members')
      .select('league_id, role, leagues(*)')
      .eq('user_id', profile.id)
      .eq('is_active', true)

    if (memberships) {
      const mapped = memberships
        .filter(m => m.leagues)
        .map(m => ({
          ...m.leagues,
          myRole: m.role,
        }))
      setLeagues(mapped)
    }
    setLoading(false)
  }

  if (loading) return <div className="page"><div className="loading">Loading...</div></div>

  return (
    <div className="page">
      <div className="page-header">
        <h1>My leagues</h1>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => navigate('/leagues/create')}>
          Create league
        </button>
        <button className="btn-small btn-ghost" style={{ padding: '12px 16px' }} onClick={() => navigate('/leagues/browse')}>
          Browse
        </button>
      </div>

      {leagues.length === 0 ? (
        <div className="empty-state">
          <p>You're not in any leagues yet.</p>
          <p>Create one and invite your friends, or browse open leagues to join.</p>
        </div>
      ) : (
        <div className="league-list">
          {leagues.map(league => (
            <Link
              key={league.id}
              to={`/leagues/${league.slug}`}
              className="league-card"
            >
              <div className="league-card-top">
                <span className="league-name">{league.name}</span>
                <span className={`league-type-badge ${league.league_type}`}>
                  {league.league_type === 'challenge' ? 'Challenge' : 'Ongoing'}
                </span>
              </div>
              {league.description && (
                <p className="league-desc">{league.description}</p>
              )}
              <div className="league-card-meta">
                {league.myRole === 'admin' && <span className="league-role">Admin</span>}
                <span className={`league-access ${league.access_type}`}>
                  {league.access_type === 'open' ? 'Open' : 'Invite only'}
                </span>
                {league.is_archived && <span className="league-archived">Archived</span>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
