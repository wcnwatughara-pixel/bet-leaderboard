import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import BetRow from '../components/BetRow'
import { calculateUserStats, compressImage } from '../lib/utils'

export default function MyBetsPage() {
  const { profile } = useAuth()
  const [bets, setBets] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [settlingBet, setSettlingBet] = useState(null) // bet being settled
  const [shareModal, setShareModal] = useState(null) // { bet, type }

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

  function handleSettle(bet) {
    setSettlingBet(bet)
  }

  function handleShare(bet, type) {
    setShareModal({ bet, type })
  }

  async function onSettleComplete() {
    setSettlingBet(null)
    await fetchMyBets()
  }

  async function onShareComplete() {
    setShareModal(null)
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
          <p>Log your first bet to appear on the leaderboard. You need at least 3 settled bets to qualify for weekly rankings.</p>
          <Link to="/log-bet" className="btn btn-primary">Log a bet</Link>
        </div>
      </div>
    )
  }

  const pendingBets = bets.filter(b => b.outcome === 'pending')
  const settledBets = bets.filter(b => b.outcome !== 'pending')

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
              <span className="stat-label">Settled</span>
            </div>
            <div className="stat">
              <span className="stat-value large">{stats.pendingCount}</span>
              <span className="stat-label">Pending</span>
            </div>
          </div>
        </div>
      )}

      {/* Pending bets section */}
      {pendingBets.length > 0 && (
        <div className="section">
          <h2 className="section-title">Pending ({pendingBets.length})</h2>
          <div className="bet-history">
            {pendingBets.map(bet => (
              <BetRow
                key={bet.id}
                bet={bet}
                showActions
                onSettle={handleSettle}
                onShare={handleShare}
              />
            ))}
          </div>
        </div>
      )}

      {/* Settled bet history */}
      <div className="section">
        <h2 className="section-title">History ({settledBets.length})</h2>
        <div className="bet-history">
          {settledBets.map(bet => (
            <BetRow
              key={bet.id}
              bet={bet}
              showActions
              onShare={handleShare}
            />
          ))}
        </div>
      </div>

      {/* Settle modal */}
      {settlingBet && (
        <SettleModal
          bet={settlingBet}
          profile={profile}
          onClose={() => setSettlingBet(null)}
          onComplete={onSettleComplete}
        />
      )}

      {/* Share modal */}
      {shareModal && (
        <ShareModal
          bet={shareModal.bet}
          type={shareModal.type}
          profile={profile}
          onClose={() => setShareModal(null)}
          onComplete={onShareComplete}
        />
      )}
    </div>
  )
}

// ============================================
// SETTLE MODAL
// Edit stake/odds/code, replace screenshot, pick Win/Loss
// ============================================
function SettleModal({ bet, profile, onClose, onComplete }) {
  const [bookingCode, setBookingCode] = useState(bet.booking_code)
  const [stake, setStake] = useState(String(bet.stake))
  const [odds, setOdds] = useState(String(bet.odds))
  const [outcome, setOutcome] = useState('')
  const [screenshot, setScreenshot] = useState(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const fileInputRef = useRef(null)

  function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.match(/^image\/(jpeg|png|webp)$/)) {
      setError('Only JPG, PNG, and WebP images are accepted.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be under 5MB.')
      return
    }
    setScreenshot(file)
    setPreviewUrl(URL.createObjectURL(file))
    setError('')
  }

  async function handleSettle() {
    if (!outcome) {
      setError('Select an outcome to settle this bet.')
      return
    }

    const stakeNum = parseFloat(stake)
    const oddsNum = parseFloat(odds)
    if (!bookingCode.trim()) { setError('Booking code is required.'); return }
    if (isNaN(stakeNum) || stakeNum < 100) { setError('Invalid stake.'); return }
    if (isNaN(oddsNum) || oddsNum < 1.01) { setError('Invalid odds.'); return }

    setError('')
    setLoading(true)

    try {
      const updateData = {
        booking_code: bookingCode.trim().toUpperCase(),
        stake: stakeNum,
        odds: oddsNum,
        outcome,
        settled_at: new Date().toISOString(),
      }

      // Upload new screenshot if provided
      if (screenshot) {
        const compressed = await compressImage(screenshot)
        const fileName = `${profile.id}/${Date.now()}.jpg`
        const { error: uploadError } = await supabase.storage
          .from('screenshots')
          .upload(fileName, compressed, { contentType: 'image/jpeg' })
        if (uploadError) throw uploadError

        const { data: signedData } = await supabase.storage
          .from('screenshots')
          .createSignedUrl(fileName, 60 * 60 * 24 * 365 * 10)
        updateData.screenshot_url = signedData?.signedUrl || fileName
      }

      const { error: updateError } = await supabase
        .from('bets')
        .update(updateData)
        .eq('id', bet.id)
        .eq('user_id', profile.id)

      if (updateError) throw updateError
      onComplete()
    } catch (err) {
      setError(err.message || 'Failed to settle bet.')
    }
    setLoading(false)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Settle bet</h2>
          <button className="btn-close" onClick={onClose}>&times;</button>
        </div>

        <div className="modal-body">
          <div className="form-group">
            <label>Booking code</label>
            <input type="text" value={bookingCode}
              onChange={e => setBookingCode(e.target.value)} autoComplete="off" />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Stake ({'₦'})</label>
              <input type="number" inputMode="numeric" value={stake}
                onChange={e => setStake(e.target.value)} min="100" step="any" />
            </div>
            <div className="form-group">
              <label>Odds</label>
              <input type="number" inputMode="decimal" value={odds}
                onChange={e => setOdds(e.target.value)} min="1.01" step="any" />
            </div>
          </div>

          <div className="form-group">
            <label>Result</label>
            <div className="outcome-toggle">
              <button type="button" className={`outcome-btn win ${outcome === 'win' ? 'selected' : ''}`}
                onClick={() => setOutcome('win')}>Win</button>
              <button type="button" className={`outcome-btn loss ${outcome === 'loss' ? 'selected' : ''}`}
                onClick={() => setOutcome('loss')}>Loss</button>
            </div>
          </div>

          <div className="form-group">
            <label>Replace screenshot (optional)</label>
            <div className="file-upload compact" onClick={() => fileInputRef.current?.click()}>
              {previewUrl ? (
                <img src={previewUrl} alt="Preview" className="upload-preview" />
              ) : (
                <span className="upload-placeholder-text">Tap to upload new screenshot</span>
              )}
            </div>
            <input ref={fileInputRef} type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileChange} style={{ display: 'none' }} />
          </div>

          {error && <div className="form-error">{error}</div>}
        </div>

        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSettle} disabled={loading}>
            {loading ? 'Settling...' : 'Settle bet'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ============================================
// SHARE MODAL
// Share a bet to the shared bets feed
// ============================================
function ShareModal({ bet, type, profile, onClose, onComplete }) {
  const [numGames, setNumGames] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  async function handleShare() {
    setError('')
    setLoading(true)

    try {
      const shareData = {
        user_id: profile.id,
        booking_code: bet.booking_code,
        odds: bet.odds,
        screenshot_url: bet.screenshot_url,
      }

      if (numGames) shareData.num_games = parseInt(numGames)

      // For post-result shares (wins), set owner_outcome and result screenshot
      if (type === 'post-result') {
        shareData.owner_outcome = bet.outcome
        shareData.result_screenshot_url = bet.screenshot_url
      }

      const { error: insertError } = await supabase
        .from('shared_bets')
        .insert(shareData)

      if (insertError) throw insertError

      setSuccess(true)
      setTimeout(() => {
        onComplete()
      }, 1500)
    } catch (err) {
      setError(err.message || 'Failed to share bet.')
    }
    setLoading(false)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Share bet</h2>
          <button className="btn-close" onClick={onClose}>&times;</button>
        </div>

        <div className="modal-body">
          {success ? (
            <div className="form-success">Bet shared to the feed!</div>
          ) : (
            <>
              <p className="share-info">
                {type === 'pre-result'
                  ? 'Share this slip with the community before the result.'
                  : 'Share this win with the community!'}
              </p>

              <div className="share-preview">
                <div className="share-preview-row">
                  <span className="label">Code</span>
                  <span>{bet.booking_code}</span>
                </div>
                <div className="share-preview-row">
                  <span className="label">Odds</span>
                  <span>{bet.odds}x</span>
                </div>
                {type === 'post-result' && (
                  <div className="share-preview-row">
                    <span className="label">Result</span>
                    <span className="positive">Win</span>
                  </div>
                )}
              </div>

              <div className="form-group">
                <label>Number of games (optional)</label>
                <input type="number" inputMode="numeric" value={numGames}
                  onChange={e => setNumGames(e.target.value)}
                  placeholder="e.g. 5" min="1" max="100" />
              </div>

              {error && <div className="form-error">{error}</div>}
            </>
          )}
        </div>

        {!success && (
          <div className="modal-footer">
            <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" onClick={handleShare} disabled={loading}>
              {loading ? 'Sharing...' : 'Share'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
