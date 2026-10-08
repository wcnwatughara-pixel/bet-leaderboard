import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { compressImage, getCurrentWeekStart, formatWeekRange } from '../lib/utils'

export default function LogBetPage() {
  const { profile } = useAuth()
  const [mode, setMode] = useState('single') // 'single' or 'batch'

  const weekStart = getCurrentWeekStart()
  const weekLabel = formatWeekRange(weekStart)

  return (
    <div className="page">
      <div className="page-header">
        <h1>Log bets</h1>
        <p className="week-label">Logging for: {weekLabel}</p>
      </div>

      <div className="tab-bar">
        <button className={`tab ${mode === 'single' ? 'active' : ''}`} onClick={() => setMode('single')}>
          Single
        </button>
        <button className={`tab ${mode === 'batch' ? 'active' : ''}`} onClick={() => setMode('batch')}>
          Batch
        </button>
      </div>

      {mode === 'single' ? (
        <SingleBetForm profile={profile} />
      ) : (
        <BatchBetForm profile={profile} />
      )}
    </div>
  )
}

// ============================================
// SINGLE BET FORM
// ============================================
function SingleBetForm({ profile }) {
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

  const [lastStake] = useState(() => localStorage.getItem('lastStake') || '')

  useEffect(() => {
    if (!stake && lastStake) setStake(lastStake)
  }, [])

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
    if (!outcome) return 'Select an outcome.'
    if (!screenshot) return 'Screenshot is required.'
    return null
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const stakeNum = parseFloat(stake)
    const oddsNum = parseFloat(odds)

    if (oddsNum > 50 && !showOddsConfirm) { setShowOddsConfirm(true); return }
    if (stakeNum > 50000 && !showStakeConfirm) { setShowStakeConfirm(true); return }

    const validationError = validate()
    if (validationError) { setError(validationError); return }

    setError('')
    setLoading(true)

    try {
      const compressed = await compressImage(screenshot)
      const fileName = `${profile.id}/${Date.now()}.jpg`
      const { error: uploadError } = await supabase.storage
        .from('screenshots')
        .upload(fileName, compressed, { contentType: 'image/jpeg' })
      if (uploadError) throw uploadError

      const { data: signedData } = await supabase.storage
        .from('screenshots')
        .createSignedUrl(fileName, 60 * 60 * 24 * 365 * 10)
      const screenshotUrl = signedData?.signedUrl || fileName

      const betData = {
        user_id: profile.id,
        booking_code: bookingCode.trim().toUpperCase(),
        stake: stakeNum,
        odds: oddsNum,
        outcome,
        screenshot_url: screenshotUrl,
      }
      // Set settled_at for non-pending bets
      if (outcome !== 'pending') {
        betData.settled_at = new Date().toISOString()
      }

      const { error: betError } = await supabase.from('bets').insert(betData)
      if (betError) {
        if (betError.message?.includes('unique') || betError.code === '23505') {
          throw new Error('You already logged a bet with this booking code.')
        }
        throw betError
      }

      localStorage.setItem('lastStake', stake)
      setSuccess(true)
      setBookingCode('')
      setOdds('')
      setOutcome('')
      setScreenshot(null)
      setPreviewUrl('')
      setShowOddsConfirm(false)
      setShowStakeConfirm(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      setError(err.message || 'Failed to log bet.')
    }
    setLoading(false)
  }

  return (
    <>
      {success && <div className="form-success">Bet logged successfully.</div>}

      <form onSubmit={handleSubmit} className="bet-form">
        <div className="form-group">
          <label htmlFor="bookingCode">Booking code</label>
          <input id="bookingCode" type="text" value={bookingCode}
            onChange={e => setBookingCode(e.target.value)}
            placeholder="e.g. BK9-X3J7" required autoComplete="off" />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="stake">Stake ({'₦'})</label>
            <input id="stake" type="number" inputMode="numeric" value={stake}
              onChange={e => { setStake(e.target.value); setShowStakeConfirm(false) }}
              placeholder="e.g. 2000" required min="100" max="1000000" step="any" />
          </div>
          <div className="form-group">
            <label htmlFor="odds">Odds</label>
            <input id="odds" type="number" inputMode="decimal" value={odds}
              onChange={e => { setOdds(e.target.value); setShowOddsConfirm(false) }}
              placeholder="e.g. 4.50" required min="1.01" max="1000" step="any" />
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
            You're logging a {'₦'}{parseFloat(stake).toLocaleString()} bet. Confirm?
            <div className="confirm-actions">
              <button type="submit">Yes, continue</button>
              <button type="button" onClick={() => setShowStakeConfirm(false)}>Edit stake</button>
            </div>
          </div>
        )}

        <div className="form-group">
          <label>Outcome</label>
          <div className="outcome-toggle">
            <button type="button" className={`outcome-btn win ${outcome === 'win' ? 'selected' : ''}`}
              onClick={() => setOutcome('win')}>Win</button>
            <button type="button" className={`outcome-btn loss ${outcome === 'loss' ? 'selected' : ''}`}
              onClick={() => setOutcome('loss')}>Loss</button>
            <button type="button" className={`outcome-btn pending ${outcome === 'pending' ? 'selected' : ''}`}
              onClick={() => setOutcome('pending')}>Pending</button>
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="screenshot">Screenshot proof</label>
          <div className="file-upload" onClick={() => fileInputRef.current?.click()}>
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
          <input ref={fileInputRef} id="screenshot" type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileChange} style={{ display: 'none' }} />
        </div>

        {error && <div className="form-error">{error}</div>}

        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? 'Logging bet...' : 'Log bet'}
        </button>
      </form>
    </>
  )
}

// ============================================
// BATCH BET FORM
// ============================================
function BatchBetForm({ profile }) {
  const emptyRow = () => ({
    bookingCode: '',
    stake: localStorage.getItem('lastStake') || '',
    odds: '',
    outcome: '',
    screenshot: null,
    previewUrl: '',
  })

  const [rows, setRows] = useState([emptyRow(), emptyRow()])
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState([]) // { index, success, message }
  const fileRefs = useRef([])

  function updateRow(index, field, value) {
    setRows(prev => prev.map((r, i) => i === index ? { ...r, [field]: value } : r))
  }

  function handleFileChange(index, e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.match(/^image\/(jpeg|png|webp)$/)) return
    if (file.size > 5 * 1024 * 1024) return
    updateRow(index, 'screenshot', file)
    updateRow(index, 'previewUrl', URL.createObjectURL(file))
  }

  function addRow() {
    if (rows.length < 10) setRows(prev => [...prev, emptyRow()])
  }

  function removeRow(index) {
    if (rows.length > 1) setRows(prev => prev.filter((_, i) => i !== index))
  }

  function validateRow(row) {
    const stakeNum = parseFloat(row.stake)
    const oddsNum = parseFloat(row.odds)
    if (!row.bookingCode.trim()) return 'Missing booking code'
    if (isNaN(stakeNum) || stakeNum < 100) return 'Invalid stake'
    if (isNaN(oddsNum) || oddsNum < 1.01) return 'Invalid odds'
    if (!row.outcome) return 'No outcome selected'
    if (!row.screenshot) return 'No screenshot'
    return null
  }

  async function handleSubmitAll() {
    setLoading(true)
    setResults([])
    const newResults = []

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const validationError = validateRow(row)
      if (validationError) {
        newResults.push({ index: i, success: false, message: validationError })
        continue
      }

      try {
        const compressed = await compressImage(row.screenshot)
        const fileName = `${profile.id}/${Date.now()}-${i}.jpg`
        const { error: uploadError } = await supabase.storage
          .from('screenshots')
          .upload(fileName, compressed, { contentType: 'image/jpeg' })
        if (uploadError) throw uploadError

        const { data: signedData } = await supabase.storage
          .from('screenshots')
          .createSignedUrl(fileName, 60 * 60 * 24 * 365 * 10)
        const screenshotUrl = signedData?.signedUrl || fileName

        const betData = {
          user_id: profile.id,
          booking_code: row.bookingCode.trim().toUpperCase(),
          stake: parseFloat(row.stake),
          odds: parseFloat(row.odds),
          outcome: row.outcome,
          screenshot_url: screenshotUrl,
        }
        if (row.outcome !== 'pending') {
          betData.settled_at = new Date().toISOString()
        }

        const { error: betError } = await supabase.from('bets').insert(betData)
        if (betError) {
          if (betError.code === '23505') throw new Error('Duplicate booking code')
          throw betError
        }

        newResults.push({ index: i, success: true, message: 'Logged' })
      } catch (err) {
        newResults.push({ index: i, success: false, message: err.message || 'Failed' })
      }
    }

    setResults(newResults)
    // Remove successful rows
    const failedIndices = newResults.filter(r => !r.success).map(r => r.index)
    if (failedIndices.length === 0) {
      setRows([emptyRow(), emptyRow()])
    } else {
      setRows(prev => prev.filter((_, i) => failedIndices.includes(i)))
    }
    setLoading(false)
  }

  return (
    <>
      {results.length > 0 && (
        <div className="batch-results">
          {results.map((r, i) => (
            <div key={i} className={`batch-result ${r.success ? 'success' : 'error'}`}>
              Row {r.index + 1}: {r.message}
            </div>
          ))}
        </div>
      )}

      <div className="batch-rows">
        {rows.map((row, index) => (
          <div key={index} className="batch-row">
            <div className="batch-row-header">
              <span className="batch-row-num">#{index + 1}</span>
              {rows.length > 1 && (
                <button className="btn-small btn-ghost" onClick={() => removeRow(index)}>Remove</button>
              )}
            </div>

            <input type="text" placeholder="Booking code"
              value={row.bookingCode} autoComplete="off"
              onChange={e => updateRow(index, 'bookingCode', e.target.value)} />

            <div className="form-row">
              <input type="number" inputMode="numeric" placeholder="Stake"
                value={row.stake} min="100" step="any"
                onChange={e => updateRow(index, 'stake', e.target.value)} />
              <input type="number" inputMode="decimal" placeholder="Odds"
                value={row.odds} min="1.01" step="any"
                onChange={e => updateRow(index, 'odds', e.target.value)} />
            </div>

            <div className="outcome-toggle compact">
              <button type="button" className={`outcome-btn win ${row.outcome === 'win' ? 'selected' : ''}`}
                onClick={() => updateRow(index, 'outcome', 'win')}>W</button>
              <button type="button" className={`outcome-btn loss ${row.outcome === 'loss' ? 'selected' : ''}`}
                onClick={() => updateRow(index, 'outcome', 'loss')}>L</button>
              <button type="button" className={`outcome-btn pending ${row.outcome === 'pending' ? 'selected' : ''}`}
                onClick={() => updateRow(index, 'outcome', 'pending')}>P</button>
            </div>

            <div className="batch-screenshot" onClick={() => fileRefs.current[index]?.click()}>
              {row.previewUrl ? (
                <img src={row.previewUrl} alt="Preview" />
              ) : (
                <span>+ Screenshot</span>
              )}
            </div>
            <input ref={el => fileRefs.current[index] = el} type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={e => handleFileChange(index, e)} style={{ display: 'none' }} />
          </div>
        ))}
      </div>

      <div className="batch-actions">
        <button className="btn-small btn-ghost" onClick={addRow} disabled={rows.length >= 10}>
          + Add row
        </button>
        <button className="btn btn-primary" onClick={handleSubmitAll} disabled={loading}>
          {loading ? 'Logging...' : `Log ${rows.length} bet${rows.length > 1 ? 's' : ''}`}
        </button>
      </div>
    </>
  )
}
