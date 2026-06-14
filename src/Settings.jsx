import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Sidebar, { IC } from './Sidebar'
import { supabase } from './supabaseClient'

const fieldInputStyle = {
  width: '180px', border: '1px solid #E5E7EB', borderRadius: '8px',
  padding: '7px 10px', fontSize: '13px', outline: 'none',
  fontFamily: 'inherit', color: '#111827', background: '#FFFFFF',
  textAlign: 'right', transition: 'border-color 150ms, box-shadow 150ms',
}

const smallBtnStyle = (variant) => {
  if (variant === 'primary') {
    return {
      background: '#6366f1', color: 'white', border: 'none',
      borderRadius: '7px', padding: '6px 12px', fontSize: '12.5px',
      fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
    }
  }
  if (variant === 'ghost') {
    return {
      background: '#F9FAFB', color: '#374151', border: '1px solid #E5E7EB',
      borderRadius: '7px', padding: '6px 12px', fontSize: '12.5px',
      fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
    }
  }
  return {
    background: 'none', color: '#6366f1', border: 'none',
    fontSize: '12.5px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
    padding: '4px 6px',
  }
}

export default function Settings() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [practice, setPractice] = useState(null)
  const [profile, setProfile] = useState(null)
  const [error, setError] = useState('')

  // Practice name/email editing
  const [editingPractice, setEditingPractice] = useState(false)
  const [practiceNameInput, setPracticeNameInput] = useState('')
  const [practiceEmailInput, setPracticeEmailInput] = useState('')
  const [savingPractice, setSavingPractice] = useState(false)
  const [practiceError, setPracticeError] = useState('')
  const [practiceSuccess, setPracticeSuccess] = useState('')

  // Account login email editing
  const [accountEmail, setAccountEmail] = useState('')
  const [editingEmail, setEditingEmail] = useState(false)
  const [accountEmailInput, setAccountEmailInput] = useState('')
  const [savingEmail, setSavingEmail] = useState(false)
  const [emailError, setEmailError] = useState('')
  const [emailSuccess, setEmailSuccess] = useState('')

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
      setAccountEmail(user.email || '')

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

  const startEditPractice = () => {
    setPracticeError('')
    setPracticeSuccess('')
    setPracticeNameInput(practice?.name || '')
    setPracticeEmailInput(practice?.email || '')
    setEditingPractice(true)
  }

  const cancelEditPractice = () => {
    setEditingPractice(false)
    setPracticeError('')
  }

  const handleSavePractice = async (e) => {
    e.preventDefault()
    setPracticeError('')
    setPracticeSuccess('')

    const name = practiceNameInput.trim()
    const email = practiceEmailInput.trim()

    if (!name) {
      setPracticeError('Practice name cannot be empty.')
      return
    }

    setSavingPractice(true)
    const { error } = await supabase
      .from('practices')
      .update({ name, email: email || null })
      .eq('id', practice.id)
    setSavingPractice(false)

    if (error) {
      setPracticeError(error.message)
    } else {
      setPractice((prev) => ({ ...prev, name, email }))
      setEditingPractice(false)
      setPracticeSuccess('Practice details updated.')
    }
  }

  const startEditEmail = () => {
    setEmailError('')
    setEmailSuccess('')
    setAccountEmailInput(accountEmail || '')
    setEditingEmail(true)
  }

  const cancelEditEmail = () => {
    setEditingEmail(false)
    setEmailError('')
  }

  const handleSaveAccountEmail = async (e) => {
    e.preventDefault()
    setEmailError('')
    setEmailSuccess('')

    const newEmail = accountEmailInput.trim()
    if (!newEmail) {
      setEmailError('Email cannot be empty.')
      return
    }
    if (newEmail === accountEmail) {
      setEditingEmail(false)
      return
    }

    setSavingEmail(true)
    const { error } = await supabase.auth.updateUser({ email: newEmail })
    setSavingEmail(false)

    if (error) {
      setEmailError(error.message)
    } else {
      setEditingEmail(false)
      setEmailSuccess('Confirmation link sent. Your login email updates once you confirm it from your inbox.')
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FFFFFF' }}>
        <p style={{ color: '#9CA3AF', fontSize: '13.5px', fontWeight: 500 }}>Loading settings...</p>
      </div>
    )
  }

  const canEditPractice = profile?.role === 'principal'

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

          {/* Practice details card */}
          <div style={{
            background: '#FFFFFF',
            border: '1px solid #E5E7EB',
            borderRadius: '16px',
            overflow: 'hidden',
            boxShadow: '0 1px 6px rgba(0,0,0,0.06)',
            marginBottom: '12px',
          }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '14px 20px', borderBottom: '1px solid #F3F4F6',
            }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#111827' }}>Practice details</span>
              {canEditPractice && !editingPractice && (
                <button onClick={startEditPractice} style={smallBtnStyle('link')}>Edit</button>
              )}
            </div>

            {practiceError && (
              <div style={{ padding: '10px 20px', background: '#FEF2F2', borderBottom: '1px solid #FECACA' }}>
                <p style={{ color: '#DC2626', fontSize: '12.5px' }}>{practiceError}</p>
              </div>
            )}
            {practiceSuccess && !editingPractice && (
              <div style={{ padding: '10px 20px', background: '#ECFDF5', borderBottom: '1px solid #A7F3D0' }}>
                <p style={{ color: '#059669', fontSize: '12.5px', fontWeight: 500 }}>{practiceSuccess}</p>
              </div>
            )}

            {editingPractice ? (
              <form onSubmit={handleSavePractice}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '24px', padding: '16px 20px', borderBottom: '1px solid #F3F4F6' }}>
                  <span style={{ fontSize: '12px', color: '#6B7280', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                    Practice name
                  </span>
                  <input
                    type="text"
                    value={practiceNameInput}
                    onChange={(e) => setPracticeNameInput(e.target.value)}
                    required
                    style={fieldInputStyle}
                    onFocus={(e) => { e.target.style.borderColor = '#6366f1'; e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.1)' }}
                    onBlur={(e) => { e.target.style.borderColor = '#E5E7EB'; e.target.style.boxShadow = 'none' }}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '24px', padding: '16px 20px', borderBottom: '1px solid #F3F4F6' }}>
                  <span style={{ fontSize: '12px', color: '#6B7280', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                    Practice email
                  </span>
                  <input
                    type="email"
                    value={practiceEmailInput}
                    onChange={(e) => setPracticeEmailInput(e.target.value)}
                    placeholder="contact@practice.com"
                    style={fieldInputStyle}
                    onFocus={(e) => { e.target.style.borderColor = '#6366f1'; e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.1)' }}
                    onBlur={(e) => { e.target.style.borderColor = '#E5E7EB'; e.target.style.boxShadow = 'none' }}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '24px', padding: '16px 20px' }}>
                  <span style={{ fontSize: '12px', color: '#6B7280', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                    Your role
                  </span>
                  <span style={{ fontSize: '14px', color: '#111827', fontWeight: 600, textAlign: 'right' }}>
                    {profile?.role ? profile.role.charAt(0).toUpperCase() + profile.role.slice(1) : '-'}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '10px', padding: '14px 20px', borderTop: '1px solid #F3F4F6', justifyContent: 'flex-end' }}>
                  <button type="button" onClick={cancelEditPractice} disabled={savingPractice} style={smallBtnStyle('ghost')}>
                    Cancel
                  </button>
                  <button type="submit" disabled={savingPractice} style={{ ...smallBtnStyle('primary'), opacity: savingPractice ? 0.65 : 1, cursor: savingPractice ? 'not-allowed' : 'pointer' }}>
                    {savingPractice ? 'Saving…' : 'Save changes'}
                  </button>
                </div>
              </form>
            ) : (
              <>
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
              </>
            )}
          </div>

          {!canEditPractice && (
            <p style={{ fontSize: '12px', color: '#9CA3AF', marginBottom: '20px' }}>
              Only the principal account can edit practice name and email.
            </p>
          )}

          {/* Account login email card */}
          <div style={{
            background: '#FFFFFF',
            border: '1px solid #E5E7EB',
            borderRadius: '16px',
            overflow: 'hidden',
            boxShadow: '0 1px 6px rgba(0,0,0,0.06)',
            marginTop: canEditPractice ? '20px' : '0',
          }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '14px 20px', borderBottom: '1px solid #F3F4F6',
            }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#111827' }}>Account login email</span>
              {!editingEmail && (
                <button onClick={startEditEmail} style={smallBtnStyle('link')}>Edit</button>
              )}
            </div>

            {emailError && (
              <div style={{ padding: '10px 20px', background: '#FEF2F2', borderBottom: '1px solid #FECACA' }}>
                <p style={{ color: '#DC2626', fontSize: '12.5px' }}>{emailError}</p>
              </div>
            )}
            {emailSuccess && !editingEmail && (
              <div style={{ padding: '10px 20px', background: '#EFF6FF', borderBottom: '1px solid #BFDBFE' }}>
                <p style={{ color: '#1D4ED8', fontSize: '12.5px', fontWeight: 500 }}>{emailSuccess}</p>
              </div>
            )}

            {editingEmail ? (
              <form onSubmit={handleSaveAccountEmail}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '24px', padding: '16px 20px' }}>
                  <span style={{ fontSize: '12px', color: '#6B7280', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                    Login email
                  </span>
                  <input
                    type="email"
                    value={accountEmailInput}
                    onChange={(e) => setAccountEmailInput(e.target.value)}
                    required
                    style={fieldInputStyle}
                    onFocus={(e) => { e.target.style.borderColor = '#6366f1'; e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.1)' }}
                    onBlur={(e) => { e.target.style.borderColor = '#E5E7EB'; e.target.style.boxShadow = 'none' }}
                  />
                </div>
                <p style={{ fontSize: '11.5px', color: '#9CA3AF', padding: '0 20px 14px', lineHeight: 1.5 }}>
                  We'll send a confirmation link to the new address. Your login email won't change until you confirm it.
                </p>
                <div style={{ display: 'flex', gap: '10px', padding: '14px 20px', borderTop: '1px solid #F3F4F6', justifyContent: 'flex-end' }}>
                  <button type="button" onClick={cancelEditEmail} disabled={savingEmail} style={smallBtnStyle('ghost')}>
                    Cancel
                  </button>
                  <button type="submit" disabled={savingEmail} style={{ ...smallBtnStyle('primary'), opacity: savingEmail ? 0.65 : 1, cursor: savingEmail ? 'not-allowed' : 'pointer' }}>
                    {savingEmail ? 'Sending…' : 'Save changes'}
                  </button>
                </div>
              </form>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '24px', padding: '16px 20px' }}>
                <span style={{ fontSize: '12px', color: '#6B7280', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                  Login email
                </span>
                <span style={{ fontSize: '14px', color: '#111827', fontWeight: 600, textAlign: 'right' }}>
                  {accountEmail || '-'}
                </span>
              </div>
            )}
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
