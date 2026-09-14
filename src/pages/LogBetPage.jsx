import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { compressImage, getCurrentWeekStart, formatWeekRange } from '../lib/utils'

export default function LogBetPage() {
  const { profile } = useAuth()
  const [bookingCode, setBookingCode] = useState('')
  const [stake, setStake] = useState('')
  const [odds, setOdds] = useState('')
  const [outcome, setOutcome] = useState('')
  const [screenshot, setScreenshot] = useState(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [showOddsConfirm, setShowOddsConfirm] = useState(false)
  const [showStakeConfirm, setShowStakeConfirm] = useState(false)
  const fileInputRef = useRef(null)

  // Retrieve last used stake from localStorage for pre-fill
  const [lastStake] = useState(() => localStorage.getItem('lastStake') || '')

  useEffect(() => {
    if (!stake && lastStake) setStake(lastStake)
  }, [])

  // Current week label
  const weekStart = getCurrentWeekStart()
  const weekLabel = formatWeekRange(weekStart)

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

  function validate() {
    const stakeNum = parseFloat(stake)
    const oddsNum = parseFloat(odds)

    if (!bookingCode.trim()) return 'Booking code is required.'
    if (isNaN(stakeNum) || stakeNum < 100 || stakeNum > 1000000) return 'Stake must be between ₦100 and ₦1,000,000.'
    if (isNaN(oddsNum) || oddsNum < 1.01 || oddsNum > 1000) return 'Odds must be between 1.01 and 1000.'
    if (!outcome) return 'Select an outcome (Win or Loss).'
    if (!screenshot) return 'Screenshot is required.'
    return null
  }

  async function handleSubmit(e) {
    e.preventDefault()

    const stakeNum = parseFloat(stake)
    const oddsNum = parseFloat(odds)

    // Confirmation prompts for unusual values
    if (oddsNum > 50 && !showOddsConfirm) {
      setShowOddsConfirm(true)
      return
    }
    if (stakeNum > 50000 && !showStakeConfirm) {
      setShowStakeConfirm(true)
      return
    }

    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }

    setError('')
    setLoading(true)

    try {
      // 1. Compress the screenshot
      const compressed = await compressImage(screenshot)

      // 2. Upload to Supabase Storage
      const fileName = `${profile.id}/${Date.now()}.jpg`
      const { error: uploadError } = await supabase.storage
        .from('screenshots')
        .upload(fileName, compressed, { contentType: 'image/jpeg' })

      if (uploadError) throw uploadError

      // 3. Get the public URL for the uploaded file
      const { data: urlData } = supabase.storage
        .from('screenshots')
        .getPublicUrl(fileName)

      // For private buckets, we use a signed URL instead
      const { data: signedData } = await supabase.storage
        .from('screenshots')
        .createSignedUrl(fileName, 60 * 60 * 24 * 365 * 10) // 10-year signed URL

      const screenshotUrl = signedData?.signedUrl || urlData?.publicUrl || fileName

      // 4. Insert the bet
      const { error: betError } = await supabase
        .from('bets')
        .insert({
          user_id: profile.id,
          booking_code: bookingCode.trim().toUpperCase(),
          stake: stakeNum,
          odds: oddsNum,
          outcome,
          screenshot_url: screenshotUrl,
        })

      if (betError) {
        if (betError.message?.includes('unique') || betError.code === '23505') {
          throw new Error('You already logged a bet with this booking code.')
        }
        throw betError
      }

      // 5. Save last stake for pre-fill
      localStorage.setItem('lastStake', stake)

      // 6. Reset form (keep stake for convenience)
      setSuccess(true)
      setBookingCode('')
      setOdds('')
      setOutcome('')
      setScreenshot(null)
      setPreviewUrl('')
      setShowOddsConfirm(false)
      setShowStakeConfirm(false)
      if (fileInputRef.current) fileInputRef.current.value = ''

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      setError(err.message || 'Failed to log bet.')
    }

    setLoading(false)
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Log a bet</h1>
        <p className="week-label">Logging for: {weekLabel}</p>
      </div>

      {success && (
        <div className="form-success">Bet logged successfully.</div>
      )}

      <form onSubmit={handleSubmit} className="bet-form">
        <div className="form-group">
          <label htmlFor="bookingCode">Booking code</label>
          <input
            id="bookingCode"
            type="text"
            value={bookingCode}
            onChange={e => setBookingCode(e.target.value)}
            placeholder="e.g. BK9-X3J7"
            required
            autoComplete="off"
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="stake">Stake (₦)</label>
            <input
              id="stake"
              type="number"
              inputMode="numeric"
              value={stake}
              onChange={e => { setStake(e.target.value); setShowStakeConfirm(false) }}
              placeholder="e.g. 2000"
              required
              min="100"
              max="1000000"
              step="any"
            />
          </div>

          <div className="form-group">
            <label htmlFor="odds">Odds</label>
            <input
              id="odds"
              type="number"
              inputMode="decimal"
              value={odds}
              onChange={e => { setOdds(e.target.value); setShowOddsConfirm(false) }}
              placeholder="e.g. 4.50"
              required
              min="1.01"
              max="1000"
              step="any"
            />
          </div>
        </div>

        {showOddsConfirm && (
          <div className="confirm-prompt">
            You entered <strong>{odds}</strong> odds. That seems high. Did you mean {(parseFloat(odds) / 100).toFixed(2)}?
            <div className="confirm-actions">
              <button type="button" onClick={() => { setOdds((parseFloat(odds) / 100).toFixed(2)); setShowOddsConfirm(false) }}>
                Use {(parseFloat(odds) / 100).toFixed(2)}
              </button>
              <button type="submit">Keep {odds}</button>
            </div>
          </div>
        )}

        {showStakeConfirm && (
          <div className="confirm-prompt">
            You're logging a ₦{parseFloat(stake).toLocaleString()} bet. Confirm?
            <div className="confirm-actions">
              <button type="submit">Yes, continue</button>
              <button type="button" onClick={() => setShowStakeConfirm(false)}>Edit stake</button>
            </div>
          </div>
        )}

        <div className="form-group">
          <label>Outcome</label>
          <div className="outcome-toggle">
            <button
              type="button"
              className={`outcome-btn win ${outcome === 'win' ? 'selected' : ''}`}
              onClick={() => setOutcome('win')}
            >
              Win
            </button>
            <button
              type="button"
              className={`outcome-btn loss ${outcome === 'loss' ? 'selected' : ''}`}
              onClick={() => setOutcome('loss')}
            >
              Loss
            </button>
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="screenshot">Screenshot proof</label>
          <div
            className="file-upload"
            onClick={() => fileInputRef.current?.click()}
          >
            {previewUrl ? (
              <img src={previewUrl} alt="Preview" className="upload-preview" />
            ) : (
              <div className="upload-placeholder">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <path d="M21 15l-5-5L5 21" />
                </svg>
                <span>Tap to upload screenshot</span>
              </div>
            )}
          </div>
          <input
            ref={fileInputRef}
            id="screenshot"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
        </div>

        {error && <div className="form-error">{error}</div>}

        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? 'Logging bet...' : 'Log bet'}
        </button>
      </form>
    </div>
  )
}
