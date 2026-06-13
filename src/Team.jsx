import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'
import Sidebar, { IC } from './Sidebar'

export default function Team() {
  const navigate = useNavigate()
  const [team, setTeam] = useState([])
  const [assignedCounts, setAssignedCounts] = useState({})
  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState(null)
  const [currentProfile, setCurrentProfile] = useState(null)
  const [copiedInvite, setCopiedInvite] = useState(false)
  
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteData, setInviteData] = useState({ name: '', email: '' })
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    checkAuthAndFetch()
  }, [])

  const checkAuthAndFetch = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { navigate('/login'); return }
    setCurrentUser(user)
    
    try {
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, practice_id, full_name, role')
        .eq('id', user.id)
        .single()

      if (userError) throw userError
      if (userData) {
        setCurrentProfile(userData)

        const { data: teamData, error: teamError } = await supabase
          .from('users')
          .select('id, practice_id, full_name, role, created_at')
          .eq('practice_id', userData.practice_id)
          .order('created_at', { ascending: true })

        if (teamError) throw teamError
        setTeam(teamData || [])

        const { data: clientData, error: clientError } = await supabase
          .from('clients')
          .select('assigned_to')
          .eq('practice_id', userData.practice_id)

        if (clientError) throw clientError
        setAssignedCounts((clientData || []).reduce((counts, client) => {
          if (!client.assigned_to) return counts
          counts[client.assigned_to] = (counts[client.assigned_to] || 0) + 1
          return counts
        }, {}))
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const getInviteLink = () => {
    if (!currentProfile?.practice_id) return ''
    const params = new URLSearchParams({ practice_id: currentProfile.practice_id })
    if (inviteData.name.trim()) params.set('name', inviteData.name.trim())
    if (inviteData.email.trim()) params.set('email', inviteData.email.trim())
    return `${window.location.origin}/signup?${params.toString()}`
  }

  const copyInviteLink = async () => {
    const inviteLink = getInviteLink()
    if (!inviteLink) return
    await navigator.clipboard.writeText(inviteLink)
    setCopiedInvite(true)
    setTimeout(() => setCopiedInvite(false), 1800)
  }

  const handleInvite = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setSending(true)

    try {
      if (currentProfile?.role !== 'principal') {
        throw new Error('Only the principal account can invite staff.')
      }

      const inviteLink = getInviteLink()
      const response = await fetch('/api/send-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: inviteData.email,
          name: inviteData.name,
          inviteLink,
          inviterName: currentProfile.full_name,
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Failed to send invite')
      }

      setSuccess('Invitation sent successfully.')
      setInviteData({ name: '', email: '' })
      setShowInviteModal(false)
    } catch (err) {
      setError(`${err.message}. You can still copy the invite link and send it manually.`)
    } finally {
      setSending(false)
    }
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F4F6FB' }}>
      <p style={{ color: '#9CA3AF', fontSize: '13.5px', fontWeight: 500 }}>Loading team…</p>
    </div>
  )

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#F4F6FB' }}>
      <Sidebar />
      
      <main style={{ marginLeft: '240px', flex: 1, padding: '32px 32px 56px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ maxWidth: '960px', margin: '0 auto', width: '100%' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px' }}>
            <div>
              <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#111827', letterSpacing: '-0.03em', marginBottom: '4px' }}>Team</h1>
              <p style={{ fontSize: '13.5px', color: '#6B7280' }}>Manage staff members in your practice.</p>
            </div>
            {currentProfile?.role === 'principal' && (
              <button
                onClick={() => setShowInviteModal(true)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '7px',
                  background: '#6366f1', color: 'white', border: 'none',
                  borderRadius: '9px', padding: '9px 18px', fontSize: '13.5px',
                  fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                  boxShadow: '0 2px 8px rgba(99,102,241,0.35)',
                }}
              >
                <IC.Plus /> Invite Staff
              </button>
            )}
          </div>

          {error && (
            <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '10px', padding: '12px 16px', marginBottom: '20px', color: '#DC2626', fontSize: '13.5px' }}>
              {error}
            </div>
          )}
          {success && (
            <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: '10px', padding: '12px 16px', marginBottom: '20px', color: '#059669', fontSize: '13.5px' }}>
              {success}
            </div>
          )}

          <div style={{ background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E5E7EB', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                  <th style={{ padding: '14px 22px', fontSize: '11.5px', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Name</th>
                  <th style={{ padding: '14px 22px', fontSize: '11.5px', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Role</th>
                  <th style={{ padding: '14px 22px', fontSize: '11.5px', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Clients</th>
                  <th style={{ padding: '14px 22px', fontSize: '11.5px', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Joined</th>
                </tr>
              </thead>
              <tbody>
                {team.map((member, i) => (
                  <tr key={member.id} style={{ borderBottom: i < team.length - 1 ? '1px solid #F3F4F6' : 'none' }}>
                    <td style={{ padding: '14px 22px', fontSize: '14px', fontWeight: 600, color: '#111827' }}>
                      {member.full_name}
                      {member.id === currentUser?.id && (
                        <span style={{ marginLeft: '8px', fontSize: '11px', color: '#9CA3AF', fontWeight: 500 }}>You</span>
                      )}
                    </td>
                    <td style={{ padding: '14px 22px' }}>
                      <span style={{
                        display: 'inline-block', padding: '3px 10px', borderRadius: '20px',
                        fontSize: '11.5px', fontWeight: 600,
                        background: member.role === 'principal' ? '#F3E8FF' : '#E0E7FF',
                        color: member.role === 'principal' ? '#7E22CE' : '#4338CA',
                      }}>
                        {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                      </span>
                    </td>
                    <td style={{ padding: '14px 22px', fontSize: '13px', color: '#6B7280' }}>
                      {assignedCounts[member.id] || 0}
                    </td>
                    <td style={{ padding: '14px 22px', fontSize: '13px', color: '#6B7280' }}>
                      {new Date(member.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

        </div>
      </main>

      {/* Invite Modal */}
      {showInviteModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(15,20,35,0.5)', backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', zIndex: 50,
        }}>
          <div style={{
            background: '#FFFFFF', borderRadius: '18px', padding: '32px', width: '100%', maxWidth: '400px',
            boxShadow: '0 32px 80px rgba(0,0,0,0.22)', animation: 'slideIn 0.2s ease',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#111827' }}>Invite Staff</h2>
              <button onClick={() => setShowInviteModal(false)} style={{
                background: '#F3F4F6', border: 'none', borderRadius: '8px', width: '30px', height: '30px',
                cursor: 'pointer', color: '#6B7280', fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>×</button>
            </div>
            <form onSubmit={handleInvite}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', fontWeight: 600, color: '#374151' }}>Staff Name</label>
                <input
                  type="text" required value={inviteData.name} onChange={e => setInviteData({...inviteData, name: e.target.value})}
                  style={{ width: '100%', border: '1px solid #E5E7EB', borderRadius: '8px', padding: '10px 14px', fontSize: '14px', boxSizing: 'border-box' }}
                  placeholder="e.g. Jane Doe"
                />
              </div>
              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', fontWeight: 600, color: '#374151' }}>Email Address</label>
                <input
                  type="email" required value={inviteData.email} onChange={e => setInviteData({...inviteData, email: e.target.value})}
                  style={{ width: '100%', border: '1px solid #E5E7EB', borderRadius: '8px', padding: '10px 14px', fontSize: '14px', boxSizing: 'border-box' }}
                  placeholder="jane@example.com"
                />
              </div>
              <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
                <button
                  type="button"
                  onClick={copyInviteLink}
                  style={{
                    flex: 1, background: '#F9FAFB', color: '#374151', border: '1px solid #E5E7EB',
                    borderRadius: '9px', padding: '10px 12px', fontSize: '13px', fontWeight: 600,
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  {copiedInvite ? 'Link copied' : 'Copy invite link'}
                </button>
              </div>
              <button
                type="submit" disabled={sending}
                style={{
                  width: '100%', background: '#6366f1', color: 'white', border: 'none', borderRadius: '9px',
                  padding: '12px', fontSize: '14px', fontWeight: 600, cursor: sending ? 'not-allowed' : 'pointer',
                  opacity: sending ? 0.7 : 1
                }}
              >
                {sending ? 'Sending Invite...' : 'Send Invitation'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
