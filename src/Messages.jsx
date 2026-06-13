import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'
import Sidebar from './Sidebar'

export default function Messages() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [client, setClient] = useState(null)
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [selectedFile, setSelectedFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const messagesEndRef = useRef(null)
  const fileInputRef = useRef(null)

  useEffect(() => {
    checkAuthAndFetch()
    const channel = supabase
      .channel(`messages:${id}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'messages', filter: `client_id=eq.${id}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setMessages(prev => [...prev, payload.new])
            scrollToBottom()
          }
        }
      )
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [id])

  useEffect(() => { scrollToBottom() }, [messages])

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })

  const checkAuthAndFetch = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { navigate('/login'); return }
    await fetchClient()
    await fetchMessages()
  }

  const fetchClient = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: userData } = await supabase
        .from('users')
        .select('id, practice_id, role')
        .eq('id', user.id)
        .single()
      
      let practiceId = user.id
      let role = 'principal'
      if (userData) {
        practiceId = userData.practice_id
        role = userData.role
      }
      
      let query = supabase
        .from('clients')
        .select('id, practice_id, assigned_to, name, company')
        .eq('id', id)
        .eq('practice_id', practiceId)
      if (role === 'staff') query = query.eq('assigned_to', user.id)
      
      const { data, error } = await query.single()
      if (error) throw error
      setClient(data)
    } catch (err) { setError(err.message) }
  }

  const fetchMessages = async () => {
    try {
      setError('')
      const { data, error } = await supabase
        .from('messages')
        .select('id, client_id, sender, content, file_url, file_name, is_read, created_at')
        .eq('client_id', id)
        .order('created_at', { ascending: true })
      if (error) throw error
      setMessages(data || [])
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  const sendMessage = async (e) => {
    e.preventDefault()
    if (!newMessage.trim() && !selectedFile) return
    setSending(true)
    try {
      let fileUrl = null, fileName = null
      if (selectedFile) {
        if (selectedFile.size > 15 * 1024 * 1024) {
          setError('File must be under 15MB')
          return
        }
        setUploading(true)
        const fileExt = selectedFile.name.split('.').pop()
        const filePath = `${id}/${Date.now()}.${fileExt}`
        const { error: uploadError } = await supabase.storage.from('message-attachments').upload(filePath, selectedFile)
        if (uploadError) throw uploadError
        const { data: { publicUrl } } = supabase.storage.from('message-attachments').getPublicUrl(filePath)
        fileUrl = publicUrl
        fileName = selectedFile.name
        setUploading(false)
      }
      const { error } = await supabase.from('messages').insert([{
        client_id: id, sender: 'ca',
        content: newMessage.trim() || '📎 File attached',
        file_url: fileUrl, file_name: fileName, is_read: true
      }])
      if (error) throw error
      setNewMessage('')
      setSelectedFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch (err) { setError(err.message) }
    finally { setSending(false); setUploading(false) }
  }

  const handleFileSelect = (e) => {
    const file = e.target.files[0]
    if (file) {
      if (file.size > 15 * 1024 * 1024) {
        setError('File must be under 15MB')
        if (fileInputRef.current) fileInputRef.current.value = ''
        return
      }
      setError('')
      setSelectedFile(file)
    }
  }

  const formatTime = (ts) => new Date(ts).toLocaleString('en-IN', {
    hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short'
  })

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-page)' }}>
      <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Loading...</p>
    </div>
  )

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-page)' }}>
      {/* Sidebar */}
      <Sidebar client={client} />

      {/* Main: chat area */}
      <main style={{ marginLeft: '240px', flex: 1, display: 'flex', flexDirection: 'column', height: '100vh' }}>
        {/* Header */}
        <div style={{
          padding: '20px 32px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--bg-surface)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <div>
            <h1 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)' }}>{client?.name}</h1>
            {client?.company && <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>{client.company}</p>}
          </div>
          <span style={{
            padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 500,
            background: 'rgba(99,102,241,0.1)', color: 'var(--accent)',
          }}>
            Messages
          </span>
        </div>

        {error && (
          <div style={{ padding: '12px 32px', background: '#FEF2F2', borderBottom: '1px solid #FECACA' }}>
            <p style={{ color: 'var(--danger)', fontSize: '13px' }}>{error}</p>
          </div>
        )}

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {messages.length === 0 ? (
            <div style={{ textAlign: 'center', marginTop: '64px' }}>
              <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>No messages yet. Start the conversation.</p>
            </div>
          ) : (
            messages.map((msg) => {
              const isCA = msg.sender === 'ca'
              return (
                <div key={msg.id} style={{ display: 'flex', justifyContent: isCA ? 'flex-end' : 'flex-start' }}>
                  <div style={{
                    maxWidth: '65%',
                    background: isCA ? 'var(--accent)' : 'var(--bg-surface)',
                    color: isCA ? 'white' : 'var(--text-primary)',
                    border: isCA ? 'none' : '1px solid var(--border)',
                    borderRadius: isCA ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                    padding: '12px 16px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                  }}>
                    <p style={{ fontSize: '14px', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                      {msg.content}
                    </p>
                    {msg.file_url && (
                      <a
                        href={msg.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: 'block', marginTop: '8px', fontSize: '13px',
                          color: isCA ? 'rgba(255,255,255,0.85)' : 'var(--accent)',
                          textDecoration: 'underline',
                        }}
                      >
                        📎 {msg.file_name || 'Download attachment'}
                      </a>
                    )}
                    <p style={{
                      fontSize: '11px', marginTop: '6px',
                      color: isCA ? 'rgba(255,255,255,0.6)' : 'var(--text-muted)',
                      textAlign: 'right',
                    }}>
                      {formatTime(msg.created_at)}
                    </p>
                  </div>
                </div>
              )
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div style={{
          padding: '16px 32px',
          borderTop: '1px solid var(--border)',
          background: 'var(--bg-surface)',
          flexShrink: 0,
        }}>
          {selectedFile && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              marginBottom: '10px', padding: '8px 12px',
              background: 'var(--bg-subtle)', borderRadius: '8px',
              border: '1px solid var(--border)',
            }}>
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)', flex: 1 }}>📎 {selectedFile.name}</span>
              <button
                onClick={() => { setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = '' }}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--danger)', fontSize: '13px', fontFamily: 'inherit',
                }}
              >
                Remove
              </button>
            </div>
          )}
          <form onSubmit={sendMessage} style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <input type="file" ref={fileInputRef} onChange={handleFileSelect} style={{ display: 'none' }} accept="image/*,.pdf,.doc,.docx,.xls,.xlsx" />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={sending || uploading}
              style={{
                background: 'var(--bg-surface)', border: '1px solid var(--border)',
                borderRadius: '8px', padding: '10px 12px',
                cursor: sending || uploading ? 'not-allowed' : 'pointer',
                opacity: sending || uploading ? 0.5 : 1, fontSize: '16px',
                flexShrink: 0,
              }}
              onMouseEnter={(e) => !(sending || uploading) && (e.currentTarget.style.background = 'var(--bg-subtle)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--bg-surface)')}
            >
              📎
            </button>
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type a message…"
              disabled={sending || uploading}
              style={{
                flex: 1, border: '1px solid var(--border)', borderRadius: '8px',
                padding: '10px 14px', fontSize: '14px', outline: 'none',
                fontFamily: 'inherit', color: 'var(--text-primary)',
                background: 'var(--bg-surface)',
              }}
              onFocus={(e) => {
                e.target.style.borderColor = 'var(--accent)'
                e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.1)'
              }}
              onBlur={(e) => {
                e.target.style.borderColor = 'var(--border)'
                e.target.style.boxShadow = 'none'
              }}
            />
            <button
              type="submit"
              disabled={sending || uploading || (!newMessage.trim() && !selectedFile)}
              style={{
                background: 'var(--accent)', color: 'white',
                border: 'none', borderRadius: '8px',
                padding: '10px 20px', fontSize: '14px', fontWeight: 500,
                cursor: sending || uploading || (!newMessage.trim() && !selectedFile) ? 'not-allowed' : 'pointer',
                opacity: sending || uploading || (!newMessage.trim() && !selectedFile) ? 0.5 : 1,
                fontFamily: 'inherit', flexShrink: 0,
              }}
              onMouseEnter={(e) => { if (!e.currentTarget.disabled) e.currentTarget.style.background = '#4f46e5' }}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--accent)')}
            >
              {uploading ? 'Uploading…' : sending ? 'Sending…' : 'Send'}
            </button>
          </form>
        </div>
      </main>
    </div>
  )
}
