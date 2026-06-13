import { useState } from 'react'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import { supabase } from './supabaseClient'

const STEPS = [
  { icon: '🏢', text: 'Set up your practice in under 2 minutes' },
  { icon: '🔒', text: 'Enterprise-grade security, always encrypted' },
  { icon: '🚀', text: 'Start managing clients from day one' },
]

export default function Signup() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const invitePracticeId = searchParams.get('practice_id')
  const invitedName = searchParams.get('name') || ''
  const invitedEmail = searchParams.get('email') || ''
  const [practiceName, setPracticeName] = useState('')
  const [email, setEmail] = useState(invitedEmail)
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState(invitedName)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPass, setShowPass] = useState(false)
  const [focusedField, setFocusedField] = useState(null)

  const handleSignup = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      // Step 1: Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({ email, password })
      if (authError) throw authError
      if (!authData.user) throw new Error('Signup failed — no user returned. Check if email is already registered.')

      const userId = authData.user.id

      // Step 2: Sign in immediately to get a session (needed for RLS)
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
      if (signInError) {
        // Email confirmation may be required
        setError('Account created! Please check your email to confirm, then sign in.')
        setLoading(false)
        return
      }

      // Step 3: Insert practice/user records
      if (invitePracticeId) {
        const { error: userError } = await supabase
          .from('users')
          .insert([{ id: userId, practice_id: invitePracticeId, full_name: fullName, role: 'staff' }])
        if (userError) throw userError
      } else {
        const { error: practiceError } = await supabase
          .from('practices')
          .insert([{ id: userId, name: practiceName, email }])
        if (practiceError) throw practiceError

        const { error: userError } = await supabase
          .from('users')
          .insert([{ id: userId, practice_id: userId, full_name: fullName, role: 'principal' }])
        if (userError) throw userError
      }

      navigate('/dashboard')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const inputStyle = (field) => ({
    width: '100%', padding: '11px 14px', borderRadius: '10px',
    border: `1.5px solid ${focusedField === field ? '#6366f1' : '#e5e7eb'}`,
    boxShadow: focusedField === field ? '0 0 0 3px rgba(99,102,241,0.12)' : 'none',
    fontSize: '14px', color: '#111827', background: '#FFFFFF',
    outline: 'none', fontFamily: 'inherit', transition: 'all 150ms',
  })

  const fields = []
  if (!invitePracticeId) {
    fields.push({
      id: 'practice', key: 'practiceName', label: 'Practice / Company Name',
      placeholder: 'e.g. Smith & Associates', type: 'text',
      value: practiceName, onChange: setPracticeName, required: true,
    })
  }
  fields.push(
    {
      id: 'fullname', key: 'fullName', label: 'Your Full Name',
      placeholder: 'John Smith', type: 'text',
      value: fullName, onChange: setFullName, required: true,
    },
    {
      id: 'email', key: 'email', label: 'Email Address',
      placeholder: 'you@example.com', type: 'email',
      value: email, onChange: setEmail, required: true,
    },
  )

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'Inter, sans-serif' }}>

      {/* ── Left: Brand panel ── */}
      <div style={{
        width: '44%', flexShrink: 0,
        background: 'linear-gradient(160deg, #0f0f1a 0%, #1a1a3e 60%, #2d2b6b 100%)',
        display: 'flex', flexDirection: 'column', padding: '56px 60px',
        position: 'relative', overflow: 'hidden',
      }}>
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

        {/* Logo wordmark */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '2px', marginBottom: 'auto' }}>
          <span style={{ fontSize: '22px', fontWeight: 800, letterSpacing: '-0.04em', color: '#ffffff' }}>infrons</span>
          <span style={{ fontSize: '22px', fontWeight: 800, color: '#6366f1', lineHeight: 1 }}>.</span>
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', paddingTop: '48px' }}>
          {/* Free badge */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '7px',
            background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)',
            borderRadius: '20px', padding: '5px 14px', marginBottom: '24px', width: 'fit-content',
          }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#818cf8', flexShrink: 0 }} />
            <span style={{ color: '#a5b4fc', fontSize: '12px', fontWeight: 600 }}>Free to get started</span>
          </div>

          <h2 style={{
            color: '#ffffff', fontSize: '32px', fontWeight: 800,
            letterSpacing: '-0.04em', lineHeight: 1.2, marginBottom: '16px',
          }}>
            Your practice<br />
            <span style={{
              background: 'linear-gradient(90deg, #818cf8, #a5b4fc)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>deserves</span> better<br />
            client tools.
          </h2>
          <p style={{
            color: 'rgba(255,255,255,0.45)', fontSize: '14.5px',
            lineHeight: 1.7, marginBottom: '44px', maxWidth: '340px',
          }}>
            Join practices using infrons to streamline client communications, track engagement, and share secure portals.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {STEPS.map(({ icon, text }) => (
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
        justifyContent: 'center', background: '#f5f5fb',
        padding: '40px 24px', overflowY: 'auto',
      }}>
        <div style={{ width: '100%', maxWidth: '420px', animation: 'fadeIn 0.3s ease' }}>
          <div style={{ marginBottom: '32px' }}>
            <h1 style={{
              fontSize: '26px', fontWeight: 800, color: '#111827',
              letterSpacing: '-0.04em', marginBottom: '8px',
            }}>
              {invitePracticeId ? 'Join your team' : 'Create your account'}
            </h1>
            <p style={{ color: '#6B7280', fontSize: '14px' }}>
              {invitePracticeId
                ? 'Set up your staff account to start managing clients.'
                : 'Set up your infrons workspace in seconds.'}
            </p>
          </div>

          <form onSubmit={handleSignup} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {fields.map(({ id, key, label, placeholder, type, value, onChange, required }) => (
              <div key={key}>
                <label style={{
                  display: 'block', marginBottom: '7px', fontSize: '11.5px',
                  fontWeight: 700, color: '#6B7280',
                  textTransform: 'uppercase', letterSpacing: '0.07em',
                }}>{label}</label>
                <input
                  id={`signup-${id}`}
                  type={type}
                  value={value}
                  onChange={(e) => onChange(e.target.value)}
                  placeholder={placeholder}
                  required={required}
                  style={inputStyle(key)}
                  onFocus={() => setFocusedField(key)}
                  onBlur={() => setFocusedField(null)}
                />
              </div>
            ))}

            {/* Password */}
            <div>
              <label style={{
                display: 'block', marginBottom: '7px', fontSize: '11.5px',
                fontWeight: 700, color: '#6B7280',
                textTransform: 'uppercase', letterSpacing: '0.07em',
              }}>Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  id="signup-password"
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min. 6 characters"
                  required minLength={6}
                  style={{ ...inputStyle('password'), paddingRight: '52px' }}
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
              {password.length > 0 && (
                <div style={{ display: 'flex', gap: '4px', marginTop: '8px' }}>
                  {[1, 2, 3].map((i) => (
                    <div key={i} style={{
                      flex: 1, height: '3px', borderRadius: '99px',
                      background: password.length >= i * 4
                        ? i === 1 ? '#EF4444' : i === 2 ? '#F59E0B' : '#10B981'
                        : '#e5e7eb',
                      transition: 'background 300ms',
                    }} />
                  ))}
                </div>
              )}
            </div>

            {error && (
              <div style={{
                background: error.includes('confirm') ? '#EFF6FF' : '#FEF2F2',
                border: `1px solid ${error.includes('confirm') ? '#BFDBFE' : '#FECACA'}`,
                borderRadius: '10px', padding: '11px 14px',
                display: 'flex', gap: '8px', alignItems: 'center',
              }}>
                <span style={{ fontSize: '14px' }}>{error.includes('confirm') ? 'ℹ️' : '⚠️'}</span>
                <p style={{ color: error.includes('confirm') ? '#1D4ED8' : '#DC2626', fontSize: '13px' }}>{error}</p>
              </div>
            )}

            <button
              id="signup-submit"
              type="submit"
              disabled={loading}
              style={{
                width: '100%', padding: '13px', borderRadius: '10px',
                background: loading ? '#a5b4fc' : '#6366f1',
                color: 'white', border: 'none', fontSize: '14.5px', fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                boxShadow: loading ? 'none' : '0 4px 16px rgba(99,102,241,0.38)',
                transition: 'all 150ms ease', letterSpacing: '-0.01em', marginTop: '4px',
              }}
              onMouseEnter={(e) => !loading && (e.currentTarget.style.background = '#4f46e5')}
              onMouseLeave={(e) => !loading && (e.currentTarget.style.background = '#6366f1')}
            >
              {loading ? 'Setting up…' : (invitePracticeId ? 'Join Team' : 'Create account →')}
            </button>

            <p style={{ fontSize: '11.5px', color: '#9CA3AF', textAlign: 'center', lineHeight: 1.5 }}>
              By creating an account you agree to our{' '}
              <span style={{ color: '#6B7280', fontWeight: 500, cursor: 'pointer' }}>Terms of Service</span>
              {' '}and{' '}
              <span style={{ color: '#6B7280', fontWeight: 500, cursor: 'pointer' }}>Privacy Policy</span>.
            </p>
          </form>

          <p style={{ textAlign: 'center', marginTop: '24px', fontSize: '13.5px', color: '#6B7280' }}>
            Already have an account?{' '}
            <Link to="/login" style={{ color: '#6366f1', fontWeight: 600, textDecoration: 'none' }}>
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
