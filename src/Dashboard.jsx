import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'
import Papa from 'papaparse'

import Sidebar, { IC } from './Sidebar'

// ─── Styled form input ─────────────────────────────────────────────────────────
function StyledInput({ onFocus, onBlur, ...props }) {
  return (
    <input
      style={{
        border: '1px solid #E5E7EB', borderRadius: '8px', padding: '10px 14px',
        fontSize: '14px', width: '100%', outline: 'none', fontFamily: 'inherit',
        color: '#111827', background: '#FFFFFF', transition: 'border-color 150ms, box-shadow 150ms',
      }}
      onFocus={(e) => {
        e.target.style.borderColor = '#6366f1'
        e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.12)'
        onFocus?.(e)
      }}
      onBlur={(e) => {
        e.target.style.borderColor = '#E5E7EB'
        e.target.style.boxShadow = 'none'
        onBlur?.(e)
      }}
      {...props}
    />
  )
}

// ─── Client modal ──────────────────────────────────────────────────────────────
function ClientModal({ title, formData, setFormData, onSubmit, onCancel, submitLabel, loading, team }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(15,20,35,0.5)',
      backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center',
      justifyContent: 'center', padding: '16px', zIndex: 50,
    }}>
      <div style={{
        background: '#FFFFFF', borderRadius: '18px', padding: '32px',
        width: '100%', maxWidth: '460px',
        boxShadow: '0 32px 80px rgba(0,0,0,0.22), 0 0 0 1px rgba(0,0,0,0.06)',
        animation: 'slideIn 0.2s ease',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
          <h2 style={{ fontSize: '17px', fontWeight: 700, color: '#111827' }}>{title}</h2>
          <button onClick={onCancel} style={{
            background: '#F3F4F6', border: 'none', borderRadius: '8px',
            width: '30px', height: '30px', cursor: 'pointer', color: '#6B7280',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '18px', lineHeight: 1, fontFamily: 'inherit',
          }}>×</button>
        </div>
        <form onSubmit={onSubmit}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {[
              { key: 'name', label: 'Full Name', placeholder: 'Client name', required: true, type: 'text' },
              { key: 'company', label: 'Company', placeholder: 'Company name (optional)', required: false, type: 'text' },
              { key: 'phone', label: 'Phone', placeholder: 'Phone number (optional)', required: false, type: 'text' },
            ].map(({ key, label, placeholder, required, type }) => (
              <div key={key}>
                <label style={{
                  display: 'block', marginBottom: '6px', fontSize: '11.5px',
                  fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.07em',
                }}>{label}</label>
                <StyledInput
                  type={type}
                  value={formData[key]}
                  onChange={(e) => setFormData({ ...formData, [key]: e.target.value })}
                  placeholder={placeholder}
                  required={required}
                />
              </div>
            ))}
            {team && team.length > 0 && (
              <div>
                <label style={{
                  display: 'block', marginBottom: '6px', fontSize: '11.5px',
                  fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.07em',
                }}>Assigned To</label>
                <select
                  value={formData.assigned_to || ''}
                  onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value || null })}
                  style={{
                    width: '100%', border: '1px solid #E5E7EB', borderRadius: '8px', padding: '10px 14px',
                    fontSize: '14px', outline: 'none', fontFamily: 'inherit', color: '#111827', background: '#F9FAFB'
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#6366f1'
                    e.target.style.background = '#FFFFFF'
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#E5E7EB'
                    e.target.style.background = '#F9FAFB'
                  }}
                >
                  <option value="">Unassigned</option>
                  {team.map(member => (
                    <option key={member.id} value={member.id}>{member.full_name}</option>
                  ))}
                </select>
              </div>
            )}
            <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
              <button
                type="submit" disabled={loading}
                style={{
                  flex: 1, background: '#6366f1', color: 'white', border: 'none',
                  borderRadius: '9px', padding: '11px 20px', fontSize: '14px',
                  fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.65 : 1, fontFamily: 'inherit',
                  boxShadow: '0 2px 8px rgba(99,102,241,0.3)',
                }}
                onMouseEnter={(e) => !loading && (e.target.style.background = '#4f46e5')}
                onMouseLeave={(e) => !loading && (e.target.style.background = '#6366f1')}
              >
                {loading ? 'Saving…' : submitLabel}
              </button>
              <button
                type="button" onClick={onCancel}
                style={{
                  flex: 1, background: '#F9FAFB', color: '#374151',
                  border: '1px solid #E5E7EB', borderRadius: '9px',
                  padding: '11px 20px', fontSize: '14px', fontWeight: 500,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
                onMouseEnter={(e) => (e.target.style.background = '#F3F4F6')}
                onMouseLeave={(e) => (e.target.style.background = '#F9FAFB')}
              >
                Cancel
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Action button helper ──────────────────────────────────────────────────────
function ActionBtn({ children, onClick, title, accent, danger, success }) {
  const [hov, setHov] = useState(false)
  const base = danger ? { bg: hov ? '#FEF2F2' : '#FFF', color: hov ? '#DC2626' : '#9CA3AF', border: hov ? '#FECACA' : '#E5E7EB' }
    : success ? { bg: '#ECFDF5', color: '#059669', border: '#A7F3D0' }
    : accent  ? { bg: hov ? '#eef2ff' : '#F9FAFB', color: hov ? '#6366f1' : '#374151', border: hov ? '#c7d2fe' : '#E5E7EB' }
    : { bg: hov ? '#F3F4F6' : '#F9FAFB', color: '#374151', border: '#E5E7EB' }

  return (
    <button
      onClick={onClick} title={title}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '5px',
        background: base.bg, color: base.color,
        border: `1px solid ${base.border}`,
        borderRadius: '7px', padding: '5px 10px', fontSize: '12.5px',
        fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
        transition: 'all 150ms ease', whiteSpace: 'nowrap',
      }}
    >
      {children}
    </button>
  )
}

// ─── WhatsApp button helper ────────────────────────────────────────────────────
function WhatsAppBtn({ onClick, title }) {
  const [hov, setHov] = useState(false)
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
        background: hov ? '#D1F5E0' : '#E7F9EF',
        color: '#25D366',
        border: `1px solid ${hov ? '#25D366' : '#B7EFD0'}`,
        borderRadius: '7px',
        padding: '6px 10px',
        fontSize: '12.5px',
        fontWeight: 500,
        cursor: 'pointer',
        fontFamily: 'inherit',
        transition: 'all 150ms ease',
        whiteSpace: 'nowrap',
        height: '32px',
        boxSizing: 'border-box'
      }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="#25D366">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
      </svg>
      WhatsApp
    </button>
  )
}


// ─── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, color, bg, icon, clickable, active, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: active ? bg : '#FFFFFF',
        border: `1px solid ${active ? color + '60' : '#E5E7EB'}`,
        borderRadius: '14px',
        padding: '20px 22px', boxShadow: active ? `0 2px 8px ${color}20` : '0 1px 4px rgba(0,0,0,0.05)',
        display: 'flex', alignItems: 'center', gap: '16px',
        cursor: clickable ? 'pointer' : 'default',
        transition: 'all 150ms ease',
      }}
    >
      <div style={{
        width: '44px', height: '44px', borderRadius: '12px', background: bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color, flexShrink: 0,
      }}>
        {icon}
      </div>
      <div>
        <p style={{ fontSize: '11.5px', fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '4px' }}>{label}</p>
        <p style={{ fontSize: '26px', fontWeight: 800, color: '#111827', letterSpacing: '-0.04em', lineHeight: 1 }}>{value}</p>
      </div>
    </div>
  )
}

// ─── Toast notification ─────────────────────────────────────────────────────────
function Toast({ message, onClose }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000)
    return () => clearTimeout(timer)
  }, [onClose])

  return (
    <div style={{
      position: 'fixed', bottom: '28px', right: '28px', zIndex: 60,
      background: '#111827', color: '#FFFFFF',
      borderRadius: '12px', padding: '14px 18px',
      boxShadow: '0 12px 32px rgba(0,0,0,0.28)',
      display: 'flex', alignItems: 'center', gap: '12px',
      maxWidth: '360px', animation: 'slideIn 0.2s ease',
    }}>
      <span style={{
        width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0,
        background: 'rgba(99,102,241,0.25)', color: '#a5b4fc',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <IC.Calendar />
      </span>
      <p style={{ fontSize: '13.5px', lineHeight: 1.45, flex: 1 }}>{message}</p>
      <button
        onClick={onClose}
        style={{
          background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)',
          cursor: 'pointer', fontSize: '16px', lineHeight: 1, padding: 0, flexShrink: 0,
        }}
      >×</button>
    </div>
  )
}

// ─── Avatar color palette ──────────────────────────────────────────────────────
const AVATAR_COLORS = [
  '#6366f1', '#7C3AED', '#EC4899', '#14B8A6',
  '#F59E0B', '#EF4444', '#10B981', '#6366F1', '#0EA5E9',
]
const getAvatarColor = (name) => AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length]
const CLIENT_PAGE_SIZE = 50
const UPCOMING_WINDOW_DAYS = 7

const formatFollowUpDate = (dateStr) => {
  const d = new Date(`${dateStr}T00:00:00`)
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

// ─── Main Dashboard ────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMoreClients, setHasMoreClients] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingClient, setEditingClient] = useState(null)
  const [formData, setFormData] = useState({ name: '', company: '', phone: '' })
  const [copiedId, setCopiedId] = useState(null)
  const [userEmail, setUserEmail] = useState('')
  const [filterAttention, setFilterAttention] = useState(false)
  const [filterFollowUp, setFilterFollowUp] = useState(false)
  const [followUpClient, setFollowUpClient] = useState(null)
  const [followUpDate, setFollowUpDate] = useState('')
  const [team, setTeam] = useState([])
  const [userRole, setUserRole] = useState('principal')
  const [practiceId, setPracticeId] = useState(null)
  const [cachedPracticeName, setCachedPracticeName] = useState('Practice')
  const [searchQuery, setSearchQuery] = useState('')
  const [showImportModal, setShowImportModal] = useState(false)
  const [importFile, setImportFile] = useState(null)
  const [importData, setImportData] = useState([])
  const [importError, setImportError] = useState('')
  const [importProgress, setImportProgress] = useState('')
  const [isImporting, setIsImporting] = useState(false)
  const [importSuccessMessage, setImportSuccessMessage] = useState('')
  const [dragActive, setDragActive] = useState(false)
  const [toast, setToast] = useState(null)
  const [showUpcomingPanel, setShowUpcomingPanel] = useState(false)
  const navigate = useNavigate()

  useEffect(() => { checkAuth() }, [])

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { navigate('/login'); return }
    setUserEmail(user.email || '')
    fetchClients()
  }

  const fetchClients = async ({ append = false } = {}) => {
    try {
      setError('')
      if (append) setLoadingMore(true)
      else setLoading(true)

      const { data: { user } } = await supabase.auth.getUser()
      const { data: userData } = await supabase
        .from('users')
        .select('id, practice_id, role, full_name')
        .eq('id', user.id)
        .single()

      let pid = user.id
      let role = 'principal'

      if (userData) {
        pid = userData.practice_id
        role = userData.role
      } else {
        await supabase.from('practices').upsert([{ id: user.id, name: 'Practice', email: user.email }])
        await supabase.from('users').upsert([{ id: user.id, practice_id: user.id, role: 'principal', full_name: user.email }])
      }

      setUserRole(role)
      setPracticeId(pid)

      const { data: practiceData } = await supabase
        .from('practices')
        .select('name')
        .eq('id', pid)
        .maybeSingle()
      if (practiceData?.name) {
        setCachedPracticeName(practiceData.name)
      }

      const start = append ? clients.length : 0
      const end = start + CLIENT_PAGE_SIZE - 1

      let query = supabase
        .from('clients')
        .select('id, practice_id, assigned_to, name, company, phone, portal_token, last_client_reply, follow_up_date, created_at')
        .eq('practice_id', pid)
      if (role === 'staff') query = query.eq('assigned_to', user.id)

      const { data, error } = await query
        .order('last_client_reply', { ascending: true, nullsFirst: true })
        .range(start, end)
      if (error) throw error
      setClients(prev => append ? [...prev, ...(data || [])] : (data || []))
      setHasMoreClients((data || []).length === CLIENT_PAGE_SIZE)

      if (role === 'principal') {
        const { data: staffData } = await supabase
          .from('users')
          .select('id, full_name')
          .eq('practice_id', pid)
          .eq('role', 'staff')
          .order('full_name', { ascending: true })
        setTeam(staffData || [])
      } else {
        setTeam([])
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }

  const resetImportState = () => {
    setImportFile(null)
    setImportData([])
    setImportError('')
    setImportProgress('')
    setIsImporting(false)
    setImportSuccessMessage('')
    setDragActive(false)
  }

  const downloadCsvTemplate = () => {
    const headers = ['name', 'company', 'phone', 'email']
    const row1 = ['Rajesh Kumar', 'Kumar & Associates', '9876543210', 'rajesh@kumar.com']
    const row2 = ['Priya Sharma', 'Sharma Textiles', '9123456789', '']
    
    const csvContent = [
      headers.join(','),
      row1.map(val => `"${val.replace(/"/g, '""')}"`).join(','),
      row2.map(val => `"${val.replace(/"/g, '""')}"`).join(',')
    ].join('\n')
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', 'infrons_client_template.csv')
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleFileSelect = (file) => {
    if (!file) return
    if (!file.name.endsWith('.csv') && file.type !== 'text/csv') {
      setImportError('Please upload a .csv file')
      setImportFile(null)
      setImportData([])
      return
    }
    
    setImportError('')
    setImportSuccessMessage('')
    setImportFile(file)
    setImportProgress('')
    
    Papa.parse(file, {
      header: true,
      skipEmptyLines: 'greedy',
      complete: (results) => {
        if (results.errors && results.errors.length > 0) {
          console.error(results.errors)
        }
        
        const parsed = results.data.map(row => {
          const normalized = {}
          Object.keys(row).forEach(key => {
            const normalizedKey = key.trim().toLowerCase()
            normalized[normalizedKey] = row[key] ? row[key].trim() : ''
          })
          return normalized
        })
        
        if (parsed.length === 0) {
          setImportError('No clients found in this file')
          setImportData([])
          return
        }
        
        setImportData(parsed)
      },
      error: (err) => {
        setImportError(`Error parsing CSV: ${err.message}`)
        setImportData([])
      }
    })
  }

  const handleDrag = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0])
    }
  }

  const handleImportSubmit = async () => {
    const validRows = importData.filter(row => row.name && row.name.trim())
    if (validRows.length === 0) {
      setImportError('No valid clients with a name found to import')
      return
    }

    setIsImporting(true)
    setImportError('')
    setImportSuccessMessage('')

    const total = validRows.length
    let imported = 0
    let failed = 0
    const batchSize = 10

    try {
      for (let i = 0; i < total; i += batchSize) {
        const batch = validRows.slice(i, i + batchSize).map(row => ({
          practice_id: practiceId,
          name: row.name,
          company: row.company || null,
          phone: row.phone || null,
          email: row.email || null,
          portal_token: crypto.randomUUID()
        }))

        const { error: insertError } = await supabase
          .from('clients')
          .insert(batch)

        if (insertError) {
          for (const row of batch) {
            const { error: singleError } = await supabase
              .from('clients')
              .insert([row])
            if (singleError) {
              failed++
            } else {
              imported++
            }
          }
        } else {
          imported += batch.length
        }

        setImportProgress(`Importing... ${Math.min(i + batchSize, total)}/${total}`)
      }

      if (failed > 0) {
        if (imported === 0) {
          throw new Error('All inserts failed. Please check connection or database policies.')
        } else {
          setImportError(`Imported ${imported}/${total} clients. ${failed} failed — duplicate entries skipped.`)
        }
      } else {
        setImportSuccessMessage(`Successfully imported ${total} clients!`)
        setTimeout(() => {
          setShowImportModal(false)
          resetImportState()
          fetchClients()
        }, 1500)
      }
    } catch (err) {
      setImportError(err.message)
    } finally {
      setIsImporting(false)
    }
  }

  const handleAddClient = async (e) => {
    e.preventDefault()
    setSaving(true)
    const { error } = await supabase.from('clients').insert([{
      practice_id: practiceId, ...formData, portal_token: crypto.randomUUID()
    }])
    setSaving(false)
    if (error) { setError(error.message) } else {
      setShowAddModal(false)
      setFormData({ name: '', company: '', phone: '', assigned_to: null })
      fetchClients()
    }
  }

  const handleEditClient = async (e) => {
    e.preventDefault()
    setSaving(true)
    const { error } = await supabase.from('clients').update(formData).eq('id', editingClient.id)
    setSaving(false)
    if (error) { setError(error.message) } else {
      setEditingClient(null)
      setFormData({ name: '', company: '', phone: '', assigned_to: null })
      fetchClients()
    }
  }

  const handleDeleteClient = async (id) => {
    if (!confirm('Delete this client? This cannot be undone.')) return
    const { error } = await supabase.from('clients').delete().eq('id', id)
    if (error) { setError(error.message) } else { fetchClients() }
  }

  const handleSetFollowUp = async (e) => {
    e.preventDefault()
    setSaving(true)
    const { error } = await supabase.from('clients').update({ follow_up_date: followUpDate || null }).eq('id', followUpClient.id)
    setSaving(false)
    if (error) {
      setError(error.message)
    } else {
      const clientName = followUpClient.name
      const dateForToast = followUpDate
      setFollowUpClient(null)
      setFollowUpDate('')
      fetchClients()
      if (dateForToast) {
        setToast(`Reminder set for ${clientName} — follow-up on ${formatFollowUpDate(dateForToast)}.`)
      }
    }
  }

  const getStatusStyle = (lastReply) => {
    if (!lastReply) return { color: '#EF4444', bg: '#FEF2F2', label: 'No reply' }
    const days = Math.floor((Date.now() - new Date(lastReply).getTime()) / 86400000)
    if (days <= 2) return { color: '#10B981', bg: '#ECFDF5', label: 'Active' }
    if (days <= 5) return { color: '#F59E0B', bg: '#FFFBEB', label: 'Pending' }
    return { color: '#EF4444', bg: '#FEF2F2', label: 'Overdue' }
  }

  const openEditModal = (client) => {
    setEditingClient(client)
    setFormData({
      name: client.name,
      company: client.company || '',
      phone: client.phone || '',
      assigned_to: client.assigned_to || null,
    })
  }

  const copyPortalLink = async (token, clientId) => {
    const url = `${window.location.origin}/portal/${token}`
    try {
      await navigator.clipboard.writeText(url)
      setCopiedId(clientId)
      setTimeout(() => setCopiedId(null), 2000)
    } catch {
      alert(`Portal link: ${url}`)
    }
  }

  const today = new Date().toISOString().split('T')[0]
  const upcomingWindowEnd = new Date(Date.now() + UPCOMING_WINDOW_DAYS * 86400000).toISOString().split('T')[0]

  // Computed stats
  const activeCount = clients.filter(c => {
    if (!c.last_client_reply) return false
    return Math.floor((Date.now() - new Date(c.last_client_reply).getTime()) / 86400000) <= 2
  }).length

  const needsAttentionCount = clients.filter(c =>
    !c.last_client_reply || Math.floor((Date.now() - new Date(c.last_client_reply).getTime()) / 86400000) > 5
  ).length

  const dueFollowUps = clients.filter(c => c.follow_up_date && c.follow_up_date <= today)

  // Upcoming (future, within window) follow-ups — distinct from due-today/overdue
  const upcomingFollowUps = clients
    .filter(c => c.follow_up_date && c.follow_up_date > today && c.follow_up_date <= upcomingWindowEnd)
    .sort((a, b) => a.follow_up_date.localeCompare(b.follow_up_date))

  // Filtered clients — search, attention filter, and follow-up filter all work together
  const displayedClients = clients.filter(c => {
    if (filterAttention) {
      const style = getStatusStyle(c.last_client_reply)
      if (style.label !== 'Overdue' && style.label !== 'Pending' && style.label !== 'No reply') return false
    }
    if (filterFollowUp) {
      if (!c.follow_up_date || c.follow_up_date > today) return false
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      return (
        c.name.toLowerCase().includes(q) ||
        (c.company && c.company.toLowerCase().includes(q)) ||
        (c.phone && c.phone.toLowerCase().includes(q))
      )
    }
    return true
  })

  const clearAllFilters = () => {
    setSearchQuery('')
    setFilterAttention(false)
    setFilterFollowUp(false)
  }

  const anyFilterActive = filterAttention || filterFollowUp || searchQuery.trim()
  const getAssignedName = (assignedTo) => team.find(member => member.id === assignedTo)?.full_name

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F4F6FB' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
        <div style={{
          width: '36px', height: '36px', border: '3px solid #E5E7EB',
          borderTopColor: '#6366f1', borderRadius: '50%',
          animation: 'spin 0.75s linear infinite',
        }} />
        <p style={{ color: '#9CA3AF', fontSize: '13.5px', fontWeight: 500 }}>Loading your workspace…</p>
      </div>
    </div>
  )

  return (
    <>
      <style>{`
        .client-row:hover { background: #F9FAFB !important; }
        .topbar-icon-btn:hover { background: #F3F4F6 !important; color: #374151 !important; }
        .topbar-help-btn:hover { background: #F3F4F6 !important; color: #374151 !important; }
      `}</style>

      <div style={{ display: 'flex', minHeight: '100vh', background: '#F4F6FB' }}>

        <Sidebar />

        <div style={{ marginLeft: '240px', flex: 1, display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>

          {/* ── Top bar ── */}
          <header style={{
            height: '56px', background: '#FFFFFF',
            borderBottom: '1px solid #f3f4f6',
            display: 'flex', alignItems: 'center', padding: '0 28px', gap: '16px',
            position: 'sticky', top: 0, zIndex: 30,
            boxShadow: '0 1px 0 #f3f4f6',
          }}>
            <div style={{ flex: 1, maxWidth: '420px', position: 'relative' }}>
              <div style={{
                position: 'absolute', left: '11px', top: '50%',
                transform: 'translateY(-50%)', color: '#9CA3AF', display: 'flex',
              }}>
                <IC.Search />
              </div>
              <input
                type="text"
                placeholder="Search by name, company, phone…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%', height: '34px', paddingLeft: '34px', paddingRight: searchQuery ? '32px' : '66px',
                  border: '1px solid #E5E7EB', borderRadius: '8px',
                  fontSize: '13px', color: '#374151', background: '#F9FAFB',
                  outline: 'none', fontFamily: 'inherit', transition: 'all 150ms',
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#6366f1'
                  e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.1)'
                  e.target.style.background = '#FFFFFF'
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#E5E7EB'
                  e.target.style.boxShadow = 'none'
                  e.target.style.background = '#F9FAFB'
                }}
              />
              <div style={{
                position: 'absolute', right: '9px', top: '50%',
                transform: 'translateY(-50%)', display: 'flex', gap: '3px', alignItems: 'center',
              }}>
                {searchQuery ? (
                  <button
                    onClick={() => setSearchQuery('')}
                    style={{
                      background: '#E5E7EB', border: 'none', borderRadius: '50%',
                      width: '16px', height: '16px', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#6B7280', fontSize: '11px', lineHeight: 1, padding: 0,
                    }}
                  >×</button>
                ) : (
                  ['Ctrl', 'K'].map((k) => (
                    <kbd key={k} style={{
                      background: '#F3F4F6', border: '1px solid #D1D5DB',
                      borderRadius: '4px', padding: '1px 5px',
                      fontSize: '10px', color: '#6B7280', fontFamily: 'inherit',
                    }}>{k}</kbd>
                  ))
                )}
              </div>
            </div>

            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '2px' }}>
              <button
                className="topbar-help-btn"
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  background: 'transparent', border: 'none', color: '#6B7280',
                  padding: '6px 10px', borderRadius: '8px', cursor: 'pointer',
                  fontFamily: 'inherit', fontSize: '13px', transition: 'all 150ms',
                }}
              >
                <IC.Help /> Need help?
              </button>
              <div style={{ width: '1px', height: '18px', background: '#E5E7EB', margin: '0 4px' }} />
              {[<IC.Bell />, <IC.Settings />].map((ico, i) => (
                <button
                  key={i}
                  className="topbar-icon-btn"
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: '34px', height: '34px', background: 'transparent',
                    border: 'none', color: '#6B7280', borderRadius: '8px',
                    cursor: 'pointer', transition: 'all 150ms',
                  }}
                >
                  {ico}
                </button>
              ))}
            </div>
          </header>

          {/* ── Page content ── */}
          <main style={{ flex: 1, padding: '32px 32px 56px', animation: 'fadeIn 0.3s ease' }}>
            <div style={{ maxWidth: '1120px', margin: '0 auto' }}>

              {/* Page header */}
              <div style={{
                display: 'flex', justifyContent: 'space-between',
                alignItems: 'flex-start', marginBottom: '28px',
              }}>
                <div>
                  <h1 style={{
                    fontSize: '22px', fontWeight: 800, color: '#111827',
                    letterSpacing: '-0.03em', marginBottom: '4px',
                  }}>Clients</h1>
                  <p style={{ fontSize: '13.5px', color: '#6B7280' }}>
                    Manage your client relationships and communications.
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => { setFilterAttention(!filterAttention); setFilterFollowUp(false) }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '7px',
                      background: filterAttention ? '#FEF2F2' : '#FFFFFF',
                      color: filterAttention ? '#DC2626' : '#374151',
                      border: `1px solid ${filterAttention ? '#FECACA' : '#E5E7EB'}`,
                      borderRadius: '9px', padding: '9px 16px', fontSize: '13.5px',
                      fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                      transition: 'all 150ms ease',
                    }}
                  >
                    <IC.Bell /> {filterAttention ? 'Needs Attention ✕' : 'Needs Attention'}
                  </button>
                  <button
                    onClick={() => { setFilterFollowUp(!filterFollowUp); setFilterAttention(false) }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '7px',
                      background: filterFollowUp ? '#FEF9C3' : '#FFFFFF',
                      color: filterFollowUp ? '#854D0E' : '#374151',
                      border: `1px solid ${filterFollowUp ? '#FEF08A' : '#E5E7EB'}`,
                      borderRadius: '9px', padding: '9px 16px', fontSize: '13.5px',
                      fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                      transition: 'all 150ms ease',
                    }}
                  >
                    <IC.Calendar /> {filterFollowUp ? 'Follow-ups Due ✕' : 'Follow-ups Due'}
                    {dueFollowUps.length > 0 && !filterFollowUp && (
                      <span style={{
                        background: '#F59E0B', color: 'white',
                        borderRadius: '99px', fontSize: '11px', fontWeight: 700,
                        padding: '1px 6px', minWidth: '18px', textAlign: 'center',
                      }}>{dueFollowUps.length}</span>
                    )}
                  </button>
                  <button
                    id="import-csv-btn"
                    onClick={() => { resetImportState(); setShowImportModal(true) }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '7px',
                      background: '#FFFFFF', color: '#374151',
                      border: '1px solid #E5E7EB',
                      borderRadius: '9px', padding: '9px 16px', fontSize: '13.5px',
                      fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                      transition: 'all 150ms ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#F9FAFB'
                      e.currentTarget.style.borderColor = '#D1D5DB'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = '#FFFFFF'
                      e.currentTarget.style.borderColor = '#E5E7EB'
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                      <polyline points="17 8 12 3 7 8"/>
                      <line x1="12" y1="3" x2="12" y2="15"/>
                    </svg>
                    Import CSV
                  </button>
                  <button
                    id="add-client-btn"
                    onClick={() => setShowAddModal(true)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '7px',
                      background: '#6366f1', color: 'white', border: 'none',
                      borderRadius: '9px', padding: '9px 18px', fontSize: '13.5px',
                      fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                      boxShadow: '0 2px 8px rgba(99,102,241,0.35)',
                      transition: 'all 150ms ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#4f46e5'
                      e.currentTarget.style.boxShadow = '0 6px 18px rgba(99,102,241,0.45)'
                      e.currentTarget.style.transform = 'translateY(-1px)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = '#6366f1'
                      e.currentTarget.style.boxShadow = '0 2px 8px rgba(99,102,241,0.35)'
                      e.currentTarget.style.transform = 'translateY(0)'
                    }}
                  >
                    <IC.Plus /> Add Client
                  </button>
                </div>
              </div>

              {/* Error banner */}
              {error && (
                <div style={{
                  background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '10px',
                  padding: '12px 16px', marginBottom: '20px',
                  display: 'flex', gap: '10px', alignItems: 'center',
                }}>
                  <span style={{ fontSize: '15px' }}>⚠️</span>
                  <p style={{ color: '#DC2626', fontSize: '13.5px' }}>{error}</p>
                </div>
              )}

              {/* Follow-up due banner — only when filter is off */}
              {dueFollowUps.length > 0 && !filterFollowUp && (
                <div
                  onClick={() => { setFilterFollowUp(true); setFilterAttention(false) }}
                  style={{
                    background: '#FEF9C3', border: '1px solid #FEF08A', borderRadius: '10px',
                    padding: '12px 16px', marginBottom: '12px',
                    display: 'flex', gap: '10px', alignItems: 'center',
                    cursor: 'pointer',
                  }}
                >
                  <span style={{ fontSize: '15px' }}>📅</span>
                  <p style={{ color: '#854D0E', fontSize: '13.5px', fontWeight: 500, flex: 1 }}>
                    {dueFollowUps.length === 1
                      ? `${dueFollowUps[0].name} — follow-up due today`
                      : `${dueFollowUps.length} clients have follow-ups due today`}
                  </p>
                  <span style={{ color: '#A16207', fontSize: '12px', fontWeight: 600 }}>View →</span>
                </div>
              )}

              {/* Upcoming follow-ups banner — next 7 days, excludes due-today/overdue */}
              {upcomingFollowUps.length > 0 && (
                <div style={{
                  background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: '10px',
                  marginBottom: '20px', overflow: 'hidden',
                }}>
                  <div
                    onClick={() => setShowUpcomingPanel(!showUpcomingPanel)}
                    style={{
                      padding: '12px 16px', display: 'flex', gap: '10px', alignItems: 'center',
                      cursor: 'pointer',
                    }}
                  >
                    <span style={{ fontSize: '15px' }}>🔔</span>
                    <p style={{ color: '#1D4ED8', fontSize: '13.5px', fontWeight: 500, flex: 1 }}>
                      {upcomingFollowUps.length === 1
                        ? `${upcomingFollowUps[0].name} — follow-up on ${formatFollowUpDate(upcomingFollowUps[0].follow_up_date)}`
                        : `${upcomingFollowUps.length} upcoming follow-ups in the next ${UPCOMING_WINDOW_DAYS} days`}
                    </p>
                    <span style={{ color: '#1D4ED8', fontSize: '12px', fontWeight: 600 }}>
                      {showUpcomingPanel ? 'Hide ↑' : 'View ↓'}
                    </span>
                  </div>
                  {showUpcomingPanel && (
                    <div style={{ borderTop: '1px solid #BFDBFE', background: '#FFFFFF' }}>
                      {upcomingFollowUps.map((c, i) => (
                        <div
                          key={c.id}
                          onClick={() => { setFollowUpClient(c); setFollowUpDate(c.follow_up_date || '') }}
                          style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            padding: '10px 16px', cursor: 'pointer',
                            borderBottom: i < upcomingFollowUps.length - 1 ? '1px solid #F3F4F6' : 'none',
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = '#F9FAFB')}
                          onMouseLeave={(e) => (e.currentTarget.style.background = '#FFFFFF')}
                        >
                          <div>
                            <span style={{ fontSize: '13.5px', fontWeight: 600, color: '#111827' }}>{c.name}</span>
                            {c.company && <span style={{ fontSize: '12px', color: '#9CA3AF', marginLeft: '6px' }}>{c.company}</span>}
                          </div>
                          <span style={{ fontSize: '12.5px', color: '#1D4ED8', fontWeight: 600 }}>
                            {formatFollowUpDate(c.follow_up_date)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Stats row */}
              {clients.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '28px' }}>
                  <StatCard
                    label="Total Clients" value={clients.length}
                    color="#6366f1" bg="#eef2ff"
                    icon={<IC.Users />}
                  />
                  <StatCard
                    label="Active" value={activeCount}
                    color="#10B981" bg="#ECFDF5"
                    icon={<IC.TrendUp />}
                  />
                  <StatCard
                    label="Need Attention" value={needsAttentionCount}
                    color="#EF4444" bg="#FEF2F2"
                    icon={<IC.Bell />}
                    clickable
                    active={filterAttention}
                    onClick={() => { setFilterAttention(!filterAttention); setFilterFollowUp(false) }}
                  />
                </div>
              )}

              {/* Active filter pill */}
              {anyFilterActive && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                  <span style={{ fontSize: '13px', color: '#6B7280' }}>
                    Showing {displayedClients.length} of {clients.length} clients
                  </span>
                  <button
                    onClick={clearAllFilters}
                    style={{
                      background: '#F3F4F6', border: '1px solid #E5E7EB', borderRadius: '6px',
                      padding: '3px 10px', fontSize: '12px', color: '#374151',
                      cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500,
                    }}
                  >
                    Clear all filters
                  </button>
                </div>
              )}

              {/* Client list */}
              {clients.length === 0 ? (
                <div style={{
                  background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '18px',
                  padding: '96px 32px', textAlign: 'center',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
                }}>
                  <div style={{
                    width: '68px', height: '68px', borderRadius: '18px',
                    background: '#eef2ff', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', margin: '0 auto 20px',
                  }}>
                    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                      <circle cx="9" cy="7" r="4"/>
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                    </svg>
                  </div>
                  <p style={{ fontSize: '16px', fontWeight: 700, color: '#111827', marginBottom: '8px' }}>No clients yet</p>
                  <p style={{ fontSize: '14px', color: '#9CA3AF', marginBottom: '28px' }}>
                    Add your first client to start managing communications with INFRONS.
                  </p>
                  <button
                    onClick={() => setShowAddModal(true)}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: '7px',
                      background: '#6366f1', color: 'white', border: 'none',
                      borderRadius: '9px', padding: '10px 22px', fontSize: '14px',
                      fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                      boxShadow: '0 2px 8px rgba(99,102,241,0.3)',
                    }}
                  >
                    <IC.Plus /> Add your first client
                  </button>
                </div>
              ) : displayedClients.length === 0 ? (
                <div style={{
                  background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '18px',
                  padding: '64px 32px', textAlign: 'center',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
                }}>
                  <p style={{ fontSize: '15px', fontWeight: 600, color: '#111827', marginBottom: '6px' }}>No results</p>
                  <p style={{ fontSize: '13.5px', color: '#9CA3AF', marginBottom: '20px' }}>
                    No clients match the current filters.
                  </p>
                  <button
                    onClick={clearAllFilters}
                    style={{
                      background: '#F3F4F6', border: '1px solid #E5E7EB', borderRadius: '8px',
                      padding: '8px 16px', fontSize: '13.5px', fontWeight: 500,
                      cursor: 'pointer', fontFamily: 'inherit', color: '#374151',
                    }}
                  >
                    Clear filters
                  </button>
                </div>
              ) : (
                <div style={{
                  background: '#FFFFFF', border: '1px solid #E5E7EB',
                  borderRadius: '16px', overflow: 'hidden',
                  boxShadow: '0 1px 6px rgba(0,0,0,0.06)',
                }}>
                  {/* Table header */}
                  <div style={{
                    display: 'grid', gridTemplateColumns: '1.4fr 130px 1fr',
                    padding: '11px 22px', background: '#F9FAFB',
                    borderBottom: '1px solid #E5E7EB',
                  }}>
                    {['Client', 'Status', 'Actions'].map(h => (
                      <span key={h} style={{
                        fontSize: '10.5px', fontWeight: 700, color: '#9CA3AF',
                        textTransform: 'uppercase', letterSpacing: '0.08em',
                      }}>{h}</span>
                    ))}
                  </div>

                  {/* Client rows */}
                  {displayedClients.map((client, i) => {
                    const status = getStatusStyle(client.last_client_reply)
                    const avatarColor = getAvatarColor(client.name)
                    const isCopied = copiedId === client.id
                    const isFollowUpDue = client.follow_up_date && client.follow_up_date <= today
                    return (
                      <div
                        key={client.id}
                        className="client-row"
                        style={{
                          display: 'grid', gridTemplateColumns: '1.4fr 130px 1fr',
                          padding: '14px 22px', alignItems: 'center',
                          borderBottom: i < displayedClients.length - 1 ? '1px solid #F3F4F6' : 'none',
                          transition: 'background 120ms ease',
                        }}
                      >
                        {/* Client info */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{
                            width: '40px', height: '40px', borderRadius: '11px',
                            background: `linear-gradient(135deg, ${avatarColor}ee, ${avatarColor}88)`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            flexShrink: 0, boxShadow: `0 2px 8px ${avatarColor}30`,
                          }}>
                            <span style={{ color: 'white', fontSize: '16px', fontWeight: 700 }}>
                              {client.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <button
                                onClick={() => openEditModal(client)}
                                style={{
                                  background: 'none', border: 'none', padding: 0,
                                  fontSize: '14px', fontWeight: 600, color: '#111827',
                                  cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                                  transition: 'color 150ms',
                                }}
                                onMouseEnter={(e) => (e.target.style.color = '#6366f1')}
                                onMouseLeave={(e) => (e.target.style.color = '#111827')}
                              >
                                {client.name}
                              </button>
                              {isFollowUpDue && (
                                <span title={`Follow-up due: ${client.follow_up_date}`} style={{
                                  fontSize: '11px', background: '#FEF9C3', color: '#854D0E',
                                  border: '1px solid #FEF08A', borderRadius: '4px',
                                  padding: '1px 5px', fontWeight: 600,
                                }}>📅 Due</span>
                              )}
                            </div>
                            {client.company && (
                              <p style={{ fontSize: '12px', color: '#9CA3AF', marginTop: '2px' }}>
                                {client.company}
                              </p>
                            )}
                            {userRole === 'principal' && client.assigned_to && (
                              <p style={{ fontSize: '11.5px', color: '#6366f1', marginTop: '3px', fontWeight: 500 }}>
                                Assigned to {getAssignedName(client.assigned_to) || 'Staff member'}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Status */}
                        <div>
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: '5px',
                            padding: '3px 10px', borderRadius: '20px',
                            fontSize: '11.5px', fontWeight: 600,
                            background: status.bg, color: status.color,
                          }}>
                            <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: status.color, flexShrink: 0 }} />
                            {status.label}
                          </span>
                        </div>

                        {/* Actions */}
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                          <ActionBtn onClick={() => navigate(`/client/${client.id}/messages`)} title="Open chat" accent>
                            <IC.Chat /> Chat
                          </ActionBtn>
                          <ActionBtn onClick={() => navigate(`/client/${client.id}/notes`)} title="View notes">
                            <IC.FileText /> Notes
                          </ActionBtn>
                          <ActionBtn
                            onClick={() => copyPortalLink(client.portal_token, client.id)}
                            title="Copy portal link"
                            success={isCopied}
                          >
                            {isCopied ? <IC.Check /> : <IC.Copy />}
                            {isCopied ? 'Copied!' : 'Portal'}
                          </ActionBtn>
                          <WhatsAppBtn
                            onClick={() => {
                              const portalUrl = `${window.location.origin}/portal/${client.portal_token}`
                              const whatsappMessage = `Hi ${client.name}, \n\nI'm using INFRONS to manage our communication securely. \n\nPlease use this link to send me documents and messages directly — no app download needed:\n\n${portalUrl}\n\nYou can reply anytime from this link. Looking forward to hearing from you.\n\n— ${cachedPracticeName}`
                              const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(whatsappMessage)}`
                              window.open(whatsappUrl, '_blank')
                            }}
                            title="Share portal link via WhatsApp"
                          />
                          <ActionBtn
                            onClick={() => { setFollowUpClient(client); setFollowUpDate(client.follow_up_date || '') }}
                            title={client.follow_up_date ? `Follow-up: ${client.follow_up_date}` : 'Set reminder'}
                            accent={!!client.follow_up_date}
                          >
                            <IC.Calendar /> {client.follow_up_date ? 'Reminder Set' : 'Reminder'}
                          </ActionBtn>
                          <ActionBtn onClick={() => openEditModal(client)} title="Edit client">
                            <IC.Edit />
                          </ActionBtn>
                          <ActionBtn onClick={() => handleDeleteClient(client.id)} title="Delete client" danger>
                            <IC.Trash />
                          </ActionBtn>
                        </div>
                      </div>
                    )
                  })}
                  {hasMoreClients && !anyFilterActive && (
                    <div style={{
                      padding: '16px 22px',
                      display: 'flex',
                      justifyContent: 'center',
                      borderTop: '1px solid #F3F4F6',
                      background: '#FFFFFF',
                    }}>
                      <button
                        onClick={() => fetchClients({ append: true })}
                        disabled={loadingMore}
                        style={{
                          background: '#F9FAFB',
                          color: '#374151',
                          border: '1px solid #E5E7EB',
                          borderRadius: '9px',
                          padding: '9px 18px',
                          fontSize: '13.5px',
                          fontWeight: 600,
                          cursor: loadingMore ? 'not-allowed' : 'pointer',
                          opacity: loadingMore ? 0.65 : 1,
                          fontFamily: 'inherit',
                        }}
                      >
                        {loadingMore ? 'Loading...' : 'Load more clients'}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </main>
        </div>
      </div>

      {/* ── Toast ── */}
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}

      {/* ── Modals ── */}
      {showAddModal && (
        <ClientModal
          title="Add New Client"
          formData={formData}
          setFormData={setFormData}
          onSubmit={handleAddClient}
          onCancel={() => { setShowAddModal(false); setFormData({ name: '', company: '', phone: '', assigned_to: null }) }}
          submitLabel="Add Client"
          loading={saving}
          team={team}
        />
      )}
      {editingClient && (
        <ClientModal
          title="Edit Client"
          formData={formData}
          setFormData={setFormData}
          onSubmit={handleEditClient}
          onCancel={() => { setEditingClient(null); setFormData({ name: '', company: '', phone: '', assigned_to: null }) }}
          submitLabel="Save Changes"
          loading={saving}
          team={team}
        />
      )}
      {followUpClient && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(15,20,35,0.5)',
          backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', padding: '16px', zIndex: 50,
        }}>
          <div style={{
            background: '#FFFFFF', borderRadius: '18px', padding: '32px',
            width: '100%', maxWidth: '360px',
            boxShadow: '0 32px 80px rgba(0,0,0,0.22), 0 0 0 1px rgba(0,0,0,0.06)',
            animation: 'slideIn 0.2s ease',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <h2 style={{ fontSize: '17px', fontWeight: 700, color: '#111827' }}>Set Reminder</h2>
              <button onClick={() => setFollowUpClient(null)} style={{
                background: '#F3F4F6', border: 'none', borderRadius: '8px',
                width: '30px', height: '30px', cursor: 'pointer', color: '#6B7280',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '18px', lineHeight: 1, fontFamily: 'inherit',
              }}>×</button>
            </div>
            <p style={{ fontSize: '13px', color: '#6B7280', marginBottom: '24px' }}>
              {followUpClient.name}{followUpClient.company ? ` · ${followUpClient.company}` : ''}
            </p>
            <form onSubmit={handleSetFollowUp}>
              <div style={{ marginBottom: '20px' }}>
                <label style={{
                  display: 'block', marginBottom: '6px', fontSize: '11.5px',
                  fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.07em',
                }}>Follow-up Date</label>
                <input
                  type="date"
                  value={followUpDate}
                  onChange={(e) => setFollowUpDate(e.target.value)}
                  min={today}
                  style={{
                    border: '1px solid #E5E7EB', borderRadius: '8px', padding: '10px 14px',
                    fontSize: '14px', width: '100%', outline: 'none', fontFamily: 'inherit',
                    color: '#111827', background: '#FFFFFF', boxSizing: 'border-box'
                  }}
                  onFocus={(e) => { e.target.style.borderColor = '#6366f1'; e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.1)' }}
                  onBlur={(e) => { e.target.style.borderColor = '#E5E7EB'; e.target.style.boxShadow = 'none' }}
                />
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="submit" disabled={saving || !followUpDate}
                  style={{
                    flex: 1, background: '#6366f1', color: 'white', border: 'none',
                    borderRadius: '9px', padding: '11px 20px', fontSize: '14px',
                    fontWeight: 600, cursor: saving || !followUpDate ? 'not-allowed' : 'pointer',
                    opacity: saving || !followUpDate ? 0.5 : 1, fontFamily: 'inherit',
                  }}
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showImportModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(15,20,35,0.5)',
          backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', padding: '16px', zIndex: 50,
        }}>
          <div style={{
            background: '#FFFFFF', borderRadius: '18px', padding: '32px',
            width: '100%', maxWidth: '520px',
            boxShadow: '0 32px 80px rgba(0,0,0,0.22), 0 0 0 1px rgba(0,0,0,0.06)',
            animation: 'slideIn 0.2s ease',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '17px', fontWeight: 700, color: '#111827' }}>Import Clients from CSV</h2>
              <button 
                type="button"
                onClick={() => { setShowImportModal(false); resetImportState() }} 
                disabled={isImporting}
                style={{
                  background: '#F3F4F6', border: 'none', borderRadius: '8px',
                  width: '30px', height: '30px', cursor: 'pointer', color: '#6B7280',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '18px', lineHeight: 1, fontFamily: 'inherit',
                }}
              >×</button>
            </div>

            {/* Error banner */}
            {importError && (
              <div style={{
                background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '10px',
                padding: '12px 16px', marginBottom: '20px',
                display: 'flex', gap: '10px', alignItems: 'center',
              }}>
                <span style={{ fontSize: '15px' }}>⚠️</span>
                <p style={{ color: '#DC2626', fontSize: '13.5px' }}>{importError}</p>
              </div>
            )}

            {/* Success banner */}
            {importSuccessMessage && (
              <div style={{
                background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: '10px',
                padding: '12px 16px', marginBottom: '20px',
                display: 'flex', gap: '10px', alignItems: 'center',
              }}>
                <span style={{ fontSize: '15px' }}>✅</span>
                <p style={{ color: '#059669', fontSize: '13.5px', fontWeight: 500 }}>{importSuccessMessage}</p>
              </div>
            )}

            {/* Step 1: Download Template */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block', marginBottom: '6px', fontSize: '11.5px',
                fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.07em',
              }}>Step 1: Download CSV Template</label>
              <button
                type="button"
                onClick={downloadCsvTemplate}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '6px',
                  background: '#FFFFFF', color: '#6366f1', border: '1px solid #E5E7EB',
                  borderRadius: '8px', padding: '8px 14px', fontSize: '13px',
                  fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#EEF2FF'
                  e.currentTarget.style.borderColor = '#C7D2FE'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#FFFFFF'
                  e.currentTarget.style.borderColor = '#E5E7EB'
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                Download Template
              </button>
            </div>

            {/* Step 2: Upload Area */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block', marginBottom: '6px', fontSize: '11.5px',
                fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.07em',
              }}>Step 2: Upload CSV File</label>
              
              <div
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                onClick={() => document.getElementById('csv-file-input').click()}
                style={{
                  border: `2px dashed ${dragActive ? '#6366f1' : '#D1D5DB'}`,
                  borderRadius: '12px',
                  padding: '32px 24px',
                  textAlign: 'center',
                  background: dragActive ? '#EEF2FF' : '#F9FAFB',
                  cursor: 'pointer',
                  transition: 'all 150ms ease',
                }}
                onMouseEnter={(e) => {
                  if (!dragActive) {
                    e.currentTarget.style.borderColor = '#6366f1'
                    e.currentTarget.style.background = '#F5F5FA'
                  }
                }}
                onMouseLeave={(e) => {
                  if (!dragActive) {
                    e.currentTarget.style.borderColor = '#D1D5DB'
                    e.currentTarget.style.background = '#F9FAFB'
                  }
                }}
              >
                <input
                  id="csv-file-input"
                  type="file"
                  accept=".csv"
                  onChange={(e) => handleFileSelect(e.target.files[0])}
                  style={{ display: 'none' }}
                />
                
                <svg style={{ margin: '0 auto 12px', color: '#9CA3AF' }} width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="16" y1="13" x2="8" y2="13"/>
                  <line x1="16" y1="17" x2="8" y2="17"/>
                </svg>

                {importFile ? (
                  <p style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>
                    📄 {importFile.name}
                  </p>
                ) : (
                  <>
                    <p style={{ fontSize: '13.5px', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>
                      Drag and drop your CSV here, or click to browse
                    </p>
                    <p style={{ fontSize: '11px', color: '#9CA3AF' }}>
                      Accepts .csv files only
                    </p>
                  </>
                )}
              </div>
            </div>

            {/* Step 3: Preview Table */}
            {importData.length > 0 && (
              <>
                <div style={{ marginTop: '20px', marginBottom: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '11.5px', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Preview (Showing first 5 rows)
                    </span>
                    <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#6366f1' }}>
                      Found {importData.length} clients
                    </span>
                  </div>
                  <div style={{
                    border: '1px solid #E5E7EB',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    maxHeight: '160px',
                    overflowY: 'auto'
                  }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                          <th style={{ padding: '8px 12px', fontWeight: 600, color: '#6B7280' }}>Name</th>
                          <th style={{ padding: '8px 12px', fontWeight: 600, color: '#6B7280' }}>Company</th>
                          <th style={{ padding: '8px 12px', fontWeight: 600, color: '#6B7280' }}>Phone</th>
                          <th style={{ padding: '8px 12px', fontWeight: 600, color: '#6B7280' }}>Email</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importData.slice(0, 5).map((row, idx) => (
                          <tr key={idx} style={{ borderBottom: idx < Math.min(importData.length, 5) - 1 ? '1px solid #F3F4F6' : 'none' }}>
                            <td style={{ padding: '8px 12px', color: row.name ? '#111827' : '#EF4444', fontWeight: row.name ? 500 : 600 }}>
                              {row.name || '[Missing Name]'}
                            </td>
                            <td style={{ padding: '8px 12px', color: '#6B7280' }}>{row.company || '-'}</td>
                            <td style={{ padding: '8px 12px', color: '#6B7280' }}>{row.phone || '-'}</td>
                            <td style={{ padding: '8px 12px', color: '#6B7280' }}>{row.email || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Warnings */}
                {importData.filter(row => !row.name).length > 0 && (
                  <div style={{
                    background: '#FFFBEB', border: '1px solid #FEF08A', borderRadius: '8px',
                    padding: '10px 12px', marginBottom: '20px',
                    display: 'flex', gap: '8px', alignItems: 'center'
                  }}>
                    <span style={{ fontSize: '13px' }}>⚠️</span>
                    <p style={{ color: '#854D0E', fontSize: '12px', fontWeight: 500 }}>
                      Warning: {importData.filter(row => !row.name).length} row(s) are missing the required Name field and will be skipped.
                    </p>
                  </div>
                )}
              </>
            )}

            {/* Progress indicator */}
            {importProgress && (
              <div style={{ marginBottom: '20px', textAlign: 'center' }}>
                <p style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '8px' }}>
                  {importProgress}
                </p>
                <div style={{ width: '100%', height: '6px', background: '#F3F4F6', borderRadius: '99px', overflow: 'hidden' }}>
                  <div style={{ 
                    height: '100%', 
                    background: '#6366f1', 
                    borderRadius: '99px',
                    width: `${(importData.filter(row => row.name && row.name.trim()).length > 0) ? (parseInt(importProgress.split(' ')[1].split('/')[0]) / parseInt(importProgress.split(' ')[1].split('/')[1])) * 100 : 0}%`,
                    transition: 'width 150ms ease'
                  }} />
                </div>
              </div>
            )}

            {/* Footer Buttons */}
            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
              <button
                type="button"
                onClick={handleImportSubmit}
                disabled={isImporting || importData.filter(row => row.name && row.name.trim()).length === 0}
                style={{
                  flex: 1, background: '#6366f1', color: 'white', border: 'none',
                  borderRadius: '9px', padding: '11px 20px', fontSize: '14px',
                  fontWeight: 600, cursor: (isImporting || importData.filter(row => row.name && row.name.trim()).length === 0) ? 'not-allowed' : 'pointer',
                  opacity: (isImporting || importData.filter(row => row.name && row.name.trim()).length === 0) ? 0.65 : 1, 
                  fontFamily: 'inherit',
                  boxShadow: '0 2px 8px rgba(99,102,241,0.3)',
                }}
              >
                {isImporting ? 'Importing…' : `Import ${importData.filter(row => row.name && row.name.trim()).length} Clients`}
              </button>
              <button
                type="button"
                onClick={() => { setShowImportModal(false); resetImportState() }}
                disabled={isImporting}
                style={{
                  flex: 1, background: '#F9FAFB', color: '#374151',
                  border: '1px solid #E5E7EB', borderRadius: '9px',
                  padding: '11px 20px', fontSize: '14px', fontWeight: 500,
                  cursor: isImporting ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
