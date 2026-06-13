import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import Login from './Login'
import Signup from './Signup'
import Dashboard from './Dashboard'
import Messages from './Messages'
import Notes from './Notes'
import ClientPortal from './ClientPortal'
import Team from './Team'
import Settings from './Settings'
import { MarketingHome, InfoPage } from './PublicPages'
import { supabase } from './supabaseClient'

function LoadingSpinner() {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#FFFFFF',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column',
      gap: '18px',
      fontFamily: 'Inter, sans-serif',
    }}>
      <style>{`
        @keyframes routeSpin {
          to { transform: rotate(360deg); }
        }
      `}</style>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '2px' }}>
        <span style={{
          fontSize: '24px',
          fontWeight: 800,
          letterSpacing: '-0.04em',
          background: 'linear-gradient(90deg, #0f0f1a 0%, #6366f1 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        }}>
          infrons
        </span>
        <span style={{ fontSize: '24px', fontWeight: 800, color: '#6366f1', lineHeight: 1 }}>.</span>
      </div>
      <div style={{
        width: '34px',
        height: '34px',
        borderRadius: '50%',
        border: '3px solid #EEF2FF',
        borderTopColor: '#6366f1',
        animation: 'routeSpin 0.75s linear infinite',
      }} />
    </div>
  )
}

function ProtectedRoute({ children, principalOnly = false }) {
  const [status, setStatus] = useState('checking')
  const location = useLocation()

  useEffect(() => {
    let active = true

    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!active) return

      if (!session) {
        setStatus('signed-out')
        return
      }

      if (!principalOnly) {
        setStatus('allowed')
        return
      }

      const { data: profile, error } = await supabase
        .from('users')
        .select('role')
        .eq('id', session.user.id)
        .single()

      if (!active) return
      setStatus(!error && profile?.role === 'principal' ? 'allowed' : 'blocked')
    }

    checkSession()
    return () => { active = false }
  }, [principalOnly])

  if (status === 'checking') return <LoadingSpinner />
  if (status === 'signed-out') return <Navigate to="/login" replace state={{ from: location }} />
  if (status === 'blocked') return <Navigate to="/dashboard" replace />
  return children
}

function PublicRedirect({ children }) {
  const [status, setStatus] = useState('checking')

  useEffect(() => {
    let active = true

    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (active) setStatus(session ? 'signed-in' : 'signed-out')
    }

    checkSession()
    return () => { active = false }
  }, [])

  if (status === 'checking') return <LoadingSpinner />
  if (status === 'signed-in') return <Navigate to="/dashboard" replace />
  return children
}

function NotFound() {
  const navigate = useNavigate()

  return (
    <div style={{
      minHeight: '100vh',
      background: '#FFFFFF',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'Inter, sans-serif',
      padding: '32px',
      textAlign: 'center',
    }}>
      <div>
        <h1 style={{ fontSize: '28px', fontWeight: 800, color: '#111827', letterSpacing: '-0.04em', marginBottom: '10px' }}>
          Page not found
        </h1>
        <p style={{ fontSize: '14px', color: '#6B7280', marginBottom: '24px' }}>
          This page does not exist or has moved.
        </p>
        <button
          onClick={() => navigate('/dashboard')}
          style={{
            background: '#6366f1',
            color: '#FFFFFF',
            border: 'none',
            borderRadius: '9px',
            padding: '11px 20px',
            fontSize: '14px',
            fontWeight: 700,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          Back to dashboard
        </button>
      </div>
    </div>
  )
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<PublicRedirect><MarketingHome /></PublicRedirect>} />
        <Route path="/login" element={<PublicRedirect><Login /></PublicRedirect>} />
        <Route path="/signup" element={<PublicRedirect><Signup /></PublicRedirect>} />
        <Route path="/privacy" element={<InfoPage type="privacy" />} />
        <Route path="/privacy-policy" element={<InfoPage type="privacy" />} />
        <Route path="/terms" element={<InfoPage type="terms" />} />
        <Route path="/terms-and-conditions" element={<InfoPage type="terms" />} />
        <Route path="/data-usage" element={<InfoPage type="dataUsage" />} />
        <Route path="/support" element={<InfoPage type="support" />} />
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/clients" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/client/:id/messages" element={<ProtectedRoute><Messages /></ProtectedRoute>} />
        <Route path="/client/:id/notes" element={<ProtectedRoute><Notes /></ProtectedRoute>} />
        <Route path="/portal/:token" element={<ClientPortal />} />
        <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
        <Route path="/settings/team" element={<ProtectedRoute principalOnly><Team /></ProtectedRoute>} />
        <Route path="/team" element={<Navigate to="/settings/team" replace />} />
        <Route path="/404" element={<NotFound />} />
        <Route path="*" element={<Navigate to="/404" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
