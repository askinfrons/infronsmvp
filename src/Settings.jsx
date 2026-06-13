import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Sidebar, { IC } from './Sidebar'
import { supabase } from './supabaseClient'

export default function Settings() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [practice, setPractice] = useState(null)
  const [profile, setProfile] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        navigate('/login')
        return
      }

      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, practice_id, full_name, role')
        .eq('id', user.id)
        .single()

      if (userError) throw userError
      setProfile(userData)

      const { data: practiceData, error: practiceError } = await supabase
        .from('practices')
        .select('id, name, email, created_at')
        .eq('id', userData.practice_id)
        .maybeSingle()

      if (practiceError) throw practiceError

      if (practiceData) {
        setPractice(practiceData)
        return
      }

      const canCreatePractice = userData.role === 'principal' && userData.practice_id === user.id
      if (!canCreatePractice) {
        throw new Error('Practice profile is missing. Please ask the principal account to open Settings.')
      }

      const fallbackPractice = {
        id: userData.practice_id,
        name: 'Practice',
        email: user.email,
      }

      const { data: createdPractice, error: createPracticeError } = await supabase
        .from('practices')
        .upsert([fallbackPractice])
        .select('id, name, email, created_at')
        .single()

      if (createPracticeError) throw createPracticeError
      setPractice(createdPractice || fallbackPractice)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FFFFFF' }}>
        <p style={{ color: '#9CA3AF', fontSize: '13.5px', fontWeight: 500 }}>Loading settings...</p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#F4F6FB' }}>
      <Sidebar />
      <main style={{ marginLeft: '240px', flex: 1, padding: '32px 32px 56px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ maxWidth: '760px', margin: '0 auto', width: '100%' }}>
          <div style={{ marginBottom: '28px' }}>
            <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#111827', letterSpacing: '-0.03em', marginBottom: '4px' }}>
              Settings
            </h1>
            <p style={{ fontSize: '13.5px', color: '#6B7280' }}>Practice workspace details.</p>
          </div>

          {error && (
            <div style={{
              background: '#FEF2F2',
              border: '1px solid #FECACA',
              borderRadius: '10px',
              padding: '12px 16px',
              marginBottom: '20px',
              color: '#DC2626',
              fontSize: '13.5px',
            }}>
              {error}
            </div>
          )}

          <div style={{
            background: '#FFFFFF',
            border: '1px solid #E5E7EB',
            borderRadius: '16px',
            overflow: 'hidden',
            boxShadow: '0 1px 6px rgba(0,0,0,0.06)',
          }}>
            {[
              ['Practice name', practice?.name || 'Practice'],
              ['Practice email', practice?.email || '-'],
              ['Your role', profile?.role ? profile.role.charAt(0).toUpperCase() + profile.role.slice(1) : '-'],
            ].map(([label, value], index, rows) => (
              <div
                key={label}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: '24px',
                  padding: '16px 20px',
                  borderBottom: index < rows.length - 1 ? '1px solid #F3F4F6' : 'none',
                }}
              >
                <span style={{ fontSize: '12px', color: '#6B7280', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                  {label}
                </span>
                <span style={{ fontSize: '14px', color: '#111827', fontWeight: 600, textAlign: 'right' }}>
                  {value}
                </span>
              </div>
            ))}
          </div>

          {profile?.role === 'principal' && (
            <button
              onClick={() => navigate('/settings/team')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '7px',
                marginTop: '20px',
                background: '#6366f1',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '9px',
                padding: '10px 18px',
                fontSize: '13.5px',
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'inherit',
                boxShadow: '0 2px 8px rgba(99,102,241,0.28)',
              }}
            >
              <IC.Shield /> Manage team
            </button>
          )}
        </div>
      </main>
    </div>
  )
}
