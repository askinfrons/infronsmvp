import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from './supabaseClient'

const FEATURES = [
  { icon: '💬', text: 'Centralise all client conversations in one place' },
  { icon: '📊', text: 'Track engagement status with real-time signals' },
  { icon: '🔗', text: 'Share secure client portals instantly' },
]

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPass, setShowPass] = useState(false)
  const [focusedField, setFocusedField] = useState(null)
  const navigate = useNavigate()

  const handleLogin = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) { setError(error.message) } else { navigate('/dashboard') }
  }

  const inputStyle = (focused) => ({
    width: '100%', padding: '11px 14px', borderRadius: '10px',
    border: `1.5px solid ${focused ? '#6366f1' : '#e5e7eb'}`,
    boxShadow: focused ? '0 0 0 3px rgba(99,102,241,0.12)' : 'none',
    fontSize: '14px', color: '#111827', background: '#FFFFFF',
    outline: 'none', fontFamily: 'inherit', transition: 'all 150ms',
  })

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'Inter, sans-serif' }}>

      {/* ── Left: Brand panel ── */}
      <div style={{
        width: '44%', flexShrink: 0,
        background: 'linear-gradient(160deg, #0f0f1a 0%, #1a1a3e 60%, #2d2b6b 100%)',
        display: 'flex', flexDirection: 'column', padding: '56px 60px',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Ambient glows */}
        <div style={{
          position: 'absolute', top: '-120px', right: '-120px',
          width: '420px', height: '420px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(99,102,241,0.22) 0%, transparent 65%)',
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', bottom: '-80px', left: '-80px',
          width: '320px', height: '320px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(79,70,229,0.18) 0%, transparent 65%)',
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', top: '45%', left: '20%',
          width: '200px', height: '200px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(129,140,248,0.1) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        {/* Logo wordmark */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '2px', marginBottom: 'auto' }}>
          <span style={{
            fontSize: '22px', fontWeight: 800, letterSpacing: '-0.04em', color: '#ffffff',
          }}>infrons</span>
          <span style={{ fontSize: '22px', fontWeight: 800, color: '#6366f1', lineHeight: 1 }}>.</span>
        </div>

        {/* Headline */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', paddingTop: '48px' }}>
          <h2 style={{
            color: '#ffffff', fontSize: '32px', fontWeight: 800,
            letterSpacing: '-0.04em', lineHeight: 1.2, marginBottom: '16px',
          }}>
            Manage every client<br />
            <span style={{
              background: 'linear-gradient(90deg, #818cf8, #a5b4fc)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>relationship</span> with<br />
            confidence.
          </h2>
          <p style={{
            color: 'rgba(255,255,255,0.45)', fontSize: '14.5px',
            lineHeight: 1.7, marginBottom: '44px', maxWidth: '340px',
          }}>
            INFRONS gives your practice a single, organised workspace for client communications, notes, and portals.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {FEATURES.map(({ icon, text }) => (
              <div key={text} style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{
                  width: '34px', height: '34px', borderRadius: '10px', flexShrink: 0,
                  background: 'rgba(99,102,241,0.15)',
                  border: '1px solid rgba(99,102,241,0.25)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '16px',
                }}>{icon}</div>
                <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13.5px', lineHeight: 1.5 }}>{text}</p>
              </div>
            ))}
          </div>
        </div>

        <p style={{ color: 'rgba(255,255,255,0.18)', fontSize: '11.5px', marginTop: '48px' }}>
          © {new Date().getFullYear()} infrons. All rights reserved.
        </p>
      </div>

      {/* ── Right: Form panel ── */}
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center',
        justifyContent: 'center', background: '#f5f5fb', padding: '40px 24px',
      }}>
        <div style={{ width: '100%', maxWidth: '400px', animation: 'fadeIn 0.3s ease' }}>

          {/* Mobile logo */}
          <div style={{ display: 'none', marginBottom: '32px' }} className="mobile-logo">
            <span style={{ fontSize: '20px', fontWeight: 800, letterSpacing: '-0.04em', color: '#0f0f1a' }}>infrons</span>
            <span style={{ fontSize: '20px', fontWeight: 800, color: '#6366f1' }}>.</span>
          </div>

          <div style={{ marginBottom: '36px' }}>
            <h1 style={{
              fontSize: '26px', fontWeight: 800, color: '#111827',
              letterSpacing: '-0.04em', marginBottom: '8px',
            }}>Welcome back</h1>
            <p style={{ color: '#6B7280', fontSize: '14px' }}>
              Sign in to your infrons workspace.
            </p>
          </div>

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div>
              <label style={{
                display: 'block', marginBottom: '7px', fontSize: '11.5px',
                fontWeight: 700, color: '#6B7280',
                textTransform: 'uppercase', letterSpacing: '0.07em',
              }}>Email address</label>
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                style={inputStyle(focusedField === 'email')}
                onFocus={() => setFocusedField('email')}
                onBlur={() => setFocusedField(null)}
              />
            </div>

            <div>
              <label style={{
                display: 'block', marginBottom: '7px', fontSize: '11.5px',
                fontWeight: 700, color: '#6B7280',
                textTransform: 'uppercase', letterSpacing: '0.07em',
              }}>Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  id="login-password"
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  style={{ ...inputStyle(focusedField === 'password'), paddingRight: '52px' }}
                  onFocus={() => setFocusedField('password')}
                  onBlur={() => setFocusedField(null)}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  style={{
                    position: 'absolute', right: '12px', top: '50%',
                    transform: 'translateY(-50%)', background: 'none',
                    border: 'none', cursor: 'pointer', color: '#9CA3AF',
                    fontSize: '12px', padding: '4px', fontFamily: 'inherit',
                  }}
                >{showPass ? 'Hide' : 'Show'}</button>
              </div>
            </div>

            {error && (
              <div style={{
                background: '#FEF2F2', border: '1px solid #FECACA',
                borderRadius: '10px', padding: '11px 14px',
                display: 'flex', gap: '8px', alignItems: 'center',
              }}>
                <span style={{ fontSize: '14px' }}>⚠️</span>
                <p style={{ color: '#DC2626', fontSize: '13px' }}>{error}</p>
              </div>
            )}

            <button
              id="login-submit"
              type="submit"
              disabled={loading}
              style={{
                width: '100%', padding: '13px', borderRadius: '10px',
                background: loading ? '#a5b4fc' : '#6366f1',
                color: 'white', border: 'none', fontSize: '14.5px', fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                boxShadow: loading ? 'none' : '0 4px 16px rgba(99,102,241,0.38)',
                transition: 'all 150ms ease', letterSpacing: '-0.01em',
              }}
              onMouseEnter={(e) => !loading && (e.currentTarget.style.background = '#4f46e5')}
              onMouseLeave={(e) => !loading && (e.currentTarget.style.background = '#6366f1')}
            >
              {loading ? 'Signing in…' : 'Sign in →'}
            </button>
          </form>

          <p style={{ textAlign: 'center', marginTop: '28px', fontSize: '13.5px', color: '#6B7280' }}>
            Don&apos;t have an account?{' '}
            <Link to="/signup" style={{ color: '#6366f1', fontWeight: 600, textDecoration: 'none' }}>
              Create one free
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
