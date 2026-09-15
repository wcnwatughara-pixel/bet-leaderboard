import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

export default function CreateLeaguePage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [leagueType, setLeagueType] = useState('ongoing')
  const [accessType, setAccessType] = useState('invite')
  const [minBets, setMinBets] = useState(3)
  const [challengeStart, setChallengeStart] = useState('')
  const [challengeEnd, setChallengeEnd] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Generate a URL-safe slug from the league name
  function generateSlug(name) {
    const base = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 30)
    // Append random chars to guarantee uniqueness
    const rand = Math.random().toString(36).slice(2, 6)
    return `${base}-${rand}`
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (name.trim().length < 2) {
      setError('League name must be at least 2 characters.')
      return
    }

    if (leagueType === 'challenge') {
      if (!challengeStart || !challengeEnd) {
        setError('Challenge leagues need a start and end date.')
        return
      }
      if (new Date(challengeEnd) <= new Date(challengeStart)) {
        setError('End date must be after start date.')
        return
      }
    }

    setLoading(true)

    const slug = generateSlug(name.trim())

    // 1. Create the league
    const { data: league, error: leagueError } = await supabase
      .from('leagues')
      .insert({
        name: name.trim(),
        slug,
        description: description.trim() || null,
        created_by: profile.id,
        league_type: leagueType,
        access_type: accessType,
        min_bets_weekly: minBets,
        challenge_start: leagueType === 'challenge' ? new Date(challengeStart).toISOString() : null,
        challenge_end: leagueType === 'challenge' ? new Date(challengeEnd).toISOString() : null,
      })
      .select()
      .single()

    if (leagueError) {
      setError(leagueError.message || 'Failed to create league.')
      setLoading(false)
      return
    }

    // 2. Add creator as league admin
    await supabase.from('league_members').insert({
      league_id: league.id,
      user_id: profile.id,
      role: 'admin',
    })

    // 3. Log activity
    await supabase.from('league_activity').insert({
      league_id: league.id,
      user_id: profile.id,
      event_type: 'league_created',
      details: `${profile.username} created the league`,
    })

    // 4. If invite-only, auto-generate a league invite code
    if (accessType === 'invite') {
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
    }

    setLoading(false)
    navigate(`/leagues/${slug}`)
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Create a league</h1>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="leagueName">League name</label>
          <input
            id="leagueName"
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. The Sharp Boys"
            required
            maxLength={50}
          />
        </div>

        <div className="form-group">
          <label htmlFor="leagueDesc">Description (optional)</label>
          <input
            id="leagueDesc"
            type="text"
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="What's this league about?"
            maxLength={120}
          />
        </div>

        <div className="form-group">
          <label>League type</label>
          <div className="outcome-toggle">
            <button
              type="button"
              className={`outcome-btn ${leagueType === 'ongoing' ? 'win selected' : ''}`}
              onClick={() => setLeagueType('ongoing')}
            >
              Ongoing
            </button>
            <button
              type="button"
              className={`outcome-btn ${leagueType === 'challenge' ? 'win selected' : ''}`}
              onClick={() => setLeagueType('challenge')}
            >
              Challenge
            </button>
          </div>
          <p className="form-hint">
            {leagueType === 'ongoing'
              ? 'Uses the standard Friday-to-Thursday weekly cycle.'
              : 'Runs for a specific date range (e.g. Champions League week).'}
          </p>
        </div>

        {leagueType === 'challenge' && (
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="cStart">Start date</label>
              <input
                id="cStart"
                type="date"
                value={challengeStart}
                onChange={e => setChallengeStart(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="cEnd">End date</label>
              <input
                id="cEnd"
                type="date"
                value={challengeEnd}
                onChange={e => setChallengeEnd(e.target.value)}
                required
              />
            </div>
          </div>
        )}

        <div className="form-group">
          <label>Access</label>
          <div className="outcome-toggle">
            <button
              type="button"
              className={`outcome-btn ${accessType === 'invite' ? 'win selected' : ''}`}
              onClick={() => setAccessType('invite')}
            >
              Invite only
            </button>
            <button
              type="button"
              className={`outcome-btn ${accessType === 'open' ? 'win selected' : ''}`}
              onClick={() => setAccessType('open')}
            >
              Open
            </button>
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="minBets">Min bets to qualify (weekly)</label>
          <input
            id="minBets"
            type="number"
            inputMode="numeric"
            value={minBets}
            onChange={e => setMinBets(parseInt(e.target.value) || 1)}
            min="1"
            max="50"
          />
        </div>

        {error && <div className="form-error">{error}</div>}

        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? 'Creating...' : 'Create league'}
        </button>
      </form>
    </div>
  )
}
