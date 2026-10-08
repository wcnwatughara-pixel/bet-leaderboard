import { useState } from 'react'

export default function BetRow({ bet, showActions = false, onSettle, onShare }) {
  const [showScreenshot, setShowScreenshot] = useState(false)

  const isPending = bet.outcome === 'pending'
  const isFlagged = bet.is_flagged

  return (
    <div className={`bet-row-detail ${isPending ? 'pending' : ''} ${isFlagged ? 'flagged' : ''}`}>
      <div className="bet-row-main">
        <span className={`bet-outcome ${bet.outcome}`}>
          {isPending ? 'P' : bet.outcome === 'win' ? 'W' : 'L'}
        </span>
        <span className="bet-code">{bet.booking_code}</span>
        {isFlagged && <span className="flagged-badge">Flagged</span>}
      </div>
      <div className="bet-row-stats">
        <span>{'₦'}{Number(bet.stake).toLocaleString()} stake</span>
        <span>{bet.odds}x odds</span>
        {bet.outcome === 'win' && (
          <span className="positive">{'₦'}{(Number(bet.stake) * Number(bet.odds)).toLocaleString()} return</span>
        )}
        {bet.outcome === 'loss' && (
          <span className="negative">-{'₦'}{Number(bet.stake).toLocaleString()}</span>
        )}
        {isPending && (
          <span className="pending-text">Awaiting result</span>
        )}
      </div>

      <div className="bet-row-actions">
        <button
          className="btn-small btn-ghost"
          onClick={() => setShowScreenshot(!showScreenshot)}
        >
          {showScreenshot ? 'Hide proof' : 'View proof'}
        </button>
        {showActions && isPending && onSettle && (
          <button className="btn-small btn-primary" onClick={() => onSettle(bet)}>
            Settle
          </button>
        )}
        {showActions && onShare && !isPending && bet.outcome === 'win' && (
          <button className="btn-small btn-ghost" onClick={() => onShare(bet, 'post-result')}>
            Share
          </button>
        )}
        {showActions && onShare && isPending && (
          <button className="btn-small btn-ghost" onClick={() => onShare(bet, 'pre-result')}>
            Share
          </button>
        )}
      </div>

      {showScreenshot && (
        <div className="screenshot-view">
          <img src={bet.screenshot_url} alt="Bet screenshot" loading="lazy" />
        </div>
      )}
    </div>
  )
}
