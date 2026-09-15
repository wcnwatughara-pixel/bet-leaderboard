import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

export default function JoinLeaguePage() {
  const { code } = useParams()
  const { profile, session } = useAuth()
  const navigate = useNavigate()
  const [league, setLeague] = useState(null)
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState('')
  const [alreadyMember, setAlreadyMember] = useState(false)

  useEffect(() => {
    if (session && profile) {
      validateCode()
    } else {
      setLoading(false)
    }
  }, [session, profile, code])

  async function validateCode() {
    // Look up the league invite code
    const { data: codeData } = await supabase
      .from('league_invite_codes')
      .select('*, leagues(*)')
      .eq('code', code.toUpperCase())
      .eq('is_active', true)
      .single()

    if (!codeData || !codeData.leagues) {
      setError('Invalid or expired league invite code.')
      setLoading(false)
      return
    }

    // Check expiry
    if (codeData.expires_at && new Date(codeData.expires_at) < new Date()) {
      setError('This invite code has expired.')
      setLoading(false)
      return
    }

    // Check max uses
    if (codeData.max_uses !== null && codeData.use_count >= codeData.max_uses) {
      setError('This invite code has reached its limit.')
      setLoading(false)
      return
    }

    setLeague(codeData.leagues)

    // Check if already a member
    const { data: membership } = await supabase
      .from('league_members')
      .select('id, is_active')
      .eq('league_id', codeData.leagues.id)
      .eq('user_id', profile.id)
      .single()

    if (membership?.is_active) {
      setAlreadyMember(true)
    }

    setLoading(false)
  }

  async function handleJoin() {
    setJoining(true)

    // Insert membership
    await supabase.from('league_members').insert({
      league_id: league.id,
      user_id: profile.id,
      role: 'member',
    })

    // Increment code use count
    const { data: codeData } = await supabase
      .from('league_invite_codes')
      .select('use_count')
      .eq('code', code.toUpperCase())
      .single()

    if (codeData) {
      await supabase
        .from('league_invite_codes')
        .update({ use_count: (codeData.use_count || 0) + 1 })
        .eq('code', code.toUpperCase())
    }

    // Log activity
    await supabase.from('league_activity').insert({
      league_id: league.id,
      user_id: profile.id,
      event_type: 'member_joined',
      details: `${profile.username} joined via invite link`,
    })

    setJoining(false)
    navigate(`/leagues/${league.slug}`)
  }

  // Not logged in
  if (!session) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div className="auth-logo">
            <div className="auth-logo-icon">⚽</div>
          </div>
          <h1>Join a league</h1>
          <p className="auth-subtitle">You need an account to join. Sign up first, then come back to this link.</p>
          <Link to="/signup" className="btn btn-primary">Create account</Link>
          <p className="auth-footer">
            Already have an account? <Link to="/login">Sign in</Link>
          </p>
        </div>
      </div>
    )
  }

  if (loading) return <div className="page"><div className="loading">Loading...</div></div>

  if (error) {
    return (
      <div className="page">
        <div className="empty-state">
          <p>{error}</p>
          <button className="btn btn-primary" onClick={() => navigate('/leagues')} style={{ maxWidth: 200, margin: '16px auto 0' }}>
            Go to leagues
          </button>
        </div>
      </div>
    )
  }

  if (alreadyMember) {
    return (
      <div className="page">
        <div className="empty-state">
          <p>You're already in <strong>{league.name}</strong>.</p>
          <button className="btn btn-primary" onClick={() => navigate(`/leagues/${league.slug}`)} style={{ maxWidth: 200, margin: '16px auto 0' }}>
            View league
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <div className="empty-state">
        <h2 style={{ marginBottom: 8, color: 'var(--text)' }}>{league.name}</h2>
        {league.description && <p>{league.description}</p>}
        <p style={{ marginTop: 8 }}>
          {league.league_type === 'challenge' ? 'Challenge league' : 'Ongoing league'}
        </p>
        <button
          className="btn btn-primary"
          onClick={handleJoin}
          disabled={joining}
          style={{ maxWidth: 200, margin: '20px auto 0' }}
        >
          {joining ? 'Joining...' : 'Join league'}
        </button>
      </div>
    </div>
  )
}
