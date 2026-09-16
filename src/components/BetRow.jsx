import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

// Predefined reasons for flagging someone else's bet
const FLAG_REASONS = [
  'Screenshot shows different odds',
  'Screenshot shows different stake',
  'Screenshot shows a loss, marked as win',
  'Screenshot is blurry or unreadable',
  'Screenshot is from a different bet',
  'Booking code doesn\'t match screenshot',
]

// Predefined reasons for self-flagging (correction request)
const SELF_FLAG_REASONS = [
  'Entered wrong odds',
  'Entered wrong stake',
  'Selected wrong outcome',
  'Entered wrong booking code',
  'Uploaded wrong screenshot',
]

export default function BetRow({ bet }) {
  const { profile } = useAuth()
  const [showScreenshot, setShowScreenshot] = useState(false)
  const [flagging, setFlagging] = useState(false)
  const [selectedReason, setSelectedReason] = useState('')
  const [customReason, setCustomReason] = useState('')
  const [flagStatus, setFlagStatus] = useState(null)

  const isSelf = profile && bet.user_id === profile.id
  const reasons = isSelf ? SELF_FLAG_REASONS : FLAG_REASONS

  function getFlagText() {
    if (selectedReason === 'other') return customReason.trim()
    return selectedReason
  }

  async function handleFlag() {
    if (!flagging) {
      setFlagging(true)
      return
    }

    const reason = getFlagText()
    if (!reason) {
      setFlagStatus('no_reason')
      return
    }

    const { error } = await supabase
      .from('flags')
      .insert({
        bet_id: bet.id,
        flagged_by: profile.id,
        reason,
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
    setSelectedReason('')
    setCustomReason('')
  }

  function cancelFlag() {
    setFlagging(false)
    setSelectedReason('')
    setCustomReason('')
    setFlagStatus(null)
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
        {profile && !flagging && flagStatus !== 'sent' && (
          <button className="btn-small btn-ghost flag" onClick={handleFlag}>
            {isSelf ? '✎' : '⚑'}
          </button>
        )}
      </div>

      {/* Flag reason selection */}
      {flagging && (
        <div className="flag-form">
          <p className="flag-form-title">
            {isSelf ? 'What needs correcting?' : 'What\'s wrong?'}
          </p>
          <div className="flag-reason-list">
            {reasons.map(reason => (
              <button
                key={reason}
                className={`flag-reason-btn ${selectedReason === reason ? 'selected' : ''}`}
                onClick={() => setSelectedReason(reason)}
              >
                {reason}
              </button>
            ))}
            <button
              className={`flag-reason-btn ${selectedReason === 'other' ? 'selected' : ''}`}
              onClick={() => setSelectedReason('other')}
            >
              Other
            </button>
          </div>

          {selectedReason === 'other' && (
            <input
              type="text"
              className="flag-custom-input"
              placeholder="Describe the issue..."
              maxLength={200}
              value={customReason}
              onChange={e => setCustomReason(e.target.value)}
            />
          )}

          {flagStatus === 'no_reason' && (
            <p className="flag-msg">Select or type a reason.</p>
          )}

          <div className="flag-form-actions">
            <button className="btn-small btn-primary" onClick={handleFlag} style={{ fontSize: '0.75rem', padding: '8px 12px' }}>
              {isSelf ? 'Request correction' : 'Submit flag'}
            </button>
            <button className="btn-small btn-ghost" onClick={cancelFlag}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {flagStatus === 'sent' && <p className="flag-msg success">{isSelf ? 'Correction requested.' : 'Flagged for review.'}</p>}
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
