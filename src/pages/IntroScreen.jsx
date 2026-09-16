import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

// Inline styles as objects for the component
const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px 20px',
    boxSizing: 'border-box',
    background: '#0a0a0f',
  },
  inner: {
    width: '100%',
    maxWidth: '400px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    gap: 0,
  },
  logo: {
    width: '72px',
    height: '72px',
    borderRadius: '14px',
    background: 'rgba(132,255,36,0.1)',
    border: '1.5px solid rgba(132,255,36,0.2)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '36px',
    marginBottom: '32px',
    animation: 'logoIn 0.4s cubic-bezier(0.16,1,0.3,1) both, glowPulse 3s ease-in-out 1.8s infinite',
  },
  headline: {
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
    fontSize: '32px',
    fontWeight: 700,
    color: '#ffffff',
    margin: '0 0 14px 0',
    letterSpacing: '-0.5px',
    lineHeight: 1.15,
    animation: 'fadeUp 0.4s cubic-bezier(0.16,1,0.3,1) 0.35s both',
  },
  body: {
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
    fontSize: '16px',
    lineHeight: 1.55,
    color: '#6b6b80',
    margin: '0 0 36px 0',
    maxWidth: '340px',
    animation: 'fadeUp 0.4s cubic-bezier(0.16,1,0.3,1) 0.65s both',
  },
  button: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    maxWidth: '320px',
    padding: '16px 24px',
    background: '#84ff24',
    color: '#0a0a0f',
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
    fontSize: '17px',
    fontWeight: 600,
    borderRadius: '6px',
    textDecoration: 'none',
    border: 'none',
    cursor: 'pointer',
    animation: 'fadeUp 0.4s cubic-bezier(0.16,1,0.3,1) 0.95s both, btnGlow 3s ease-in-out 1.8s infinite',
    transition: 'transform 0.15s ease, filter 0.15s ease',
  },
  footer: {
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
    fontSize: '14px',
    color: '#6b6b80',
    margin: '36px 0 0 0',
    animation: 'fadeUp 0.35s cubic-bezier(0.16,1,0.3,1) 1.2s both',
  },
  footerLink: {
    color: '#84ff24',
    textDecoration: 'none',
    fontWeight: 500,
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: '14px',
    padding: 0,
  },
}

// CSS keyframes injected via a style tag
const keyframes = `
  @keyframes logoIn {
    0% { opacity: 0; transform: scale(0.5); }
    100% { opacity: 1; transform: scale(1); }
  }
  @keyframes fadeUp {
    0% { opacity: 0; transform: translateY(16px); }
    100% { opacity: 1; transform: translateY(0); }
  }
  @keyframes glowPulse {
    0%, 100% { box-shadow: 0 0 20px rgba(132,255,36,0.15), 0 0 40px rgba(132,255,36,0.05); }
    50% { box-shadow: 0 0 28px rgba(132,255,36,0.25), 0 0 56px rgba(132,255,36,0.1); }
  }
  @keyframes btnGlow {
    0%, 100% { box-shadow: 0 0 16px rgba(132,255,36,0.2); }
    50% { box-shadow: 0 0 24px rgba(132,255,36,0.35); }
  }
  @media (prefers-reduced-motion: reduce) {
    * { animation: none !important; transition: none !important; }
  }
`

export default function IntroScreen() {
  const navigate = useNavigate()
  const [isReturning, setIsReturning] = useState(false)

  useEffect(() => {
    try {
      const visited = localStorage.getItem('bet_leaderboard_visited')
      if (visited) {
        setIsReturning(true)
      } else {
        localStorage.setItem('bet_leaderboard_visited', '1')
      }
    } catch (e) {
      // localStorage unavailable, default to first-time
    }
  }, [])

  // Content based on visitor type
  const headline = isReturning ? 'Welcome back' : 'Log. Rank. Prove it.'
  const body = isReturning
    ? "The board's been moving. Check your rank."
    : 'Track your settled bets, compete with friends on the leaderboard, and back every claim with a screenshot.'
  const buttonLabel = isReturning ? 'Sign in' : 'Get started'
  const buttonHref = isReturning ? '/login' : '/signup'
  const footerPrefix = isReturning ? 'New here?' : 'Already have an account?'
  const footerLinkText = isReturning ? 'Create account' : 'Sign in'
  const footerHref = isReturning ? '/signup' : '/login'

  return (
    <>
      <style>{keyframes}</style>
      <div style={styles.container}>
        <div style={styles.inner}>

          {/* Logo */}
          <div style={styles.logo}>⚽</div>

          {/* Headline */}
          <h1 style={styles.headline}>{headline}</h1>

          {/* Body */}
          <p style={styles.body}>{body}</p>

          {/* Primary Button */}
          <button
            style={styles.button}
            onClick={() => navigate(buttonHref)}
            onMouseDown={e => e.currentTarget.style.transform = 'scale(0.98)'}
            onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
          >
            {buttonLabel}
          </button>

          {/* Footer Link */}
          <p style={styles.footer}>
            {footerPrefix}{' '}
            <button
              style={styles.footerLink}
              onClick={() => navigate(footerHref)}
            >
              {footerLinkText}
            </button>
          </p>

        </div>
      </div>
    </>
  )
}
