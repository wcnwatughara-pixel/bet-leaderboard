import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

export default function LoginPage() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [resendMsg, setResendMsg] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setResendMsg('')
    setLoading(true)

    const { error } = await signIn(email, password)

    if (error) {
      // Supabase returns this message for unverified emails
      if (error.message?.includes('Email not confirmed')) {
        setError('Your email is not verified yet. Check your inbox (and spam folder).')
        setResendMsg('show')
      } else {
        setError(error.message || 'Failed to sign in.')
      }
    }
    setLoading(false)
  }

  async function handleResend() {
    setResendMsg('sending')
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
    })
    if (error) {
      setResendMsg('error')
    } else {
      setResendMsg('sent')
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>Bet Leaderboard</h1>
        <p className="auth-subtitle">Sign in to your account</p>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>

          {error && (
            <div className="form-error">
              {error}
              {resendMsg === 'show' && (
                <button type="button" className="resend-btn" onClick={handleResend}>
                  Resend verification email
                </button>
              )}
              {resendMsg === 'sending' && <span className="resend-status">Sending...</span>}
              {resendMsg === 'sent' && <span className="resend-status success">Verification email sent. Check your inbox.</span>}
              {resendMsg === 'error' && <span className="resend-status">Failed to resend. Try again.</span>}
            </div>
          )}

          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <p className="auth-footer">
          Have an invite code? <Link to="/signup">Create account</Link>
        </p>
      </div>
    </div>
  )
}
