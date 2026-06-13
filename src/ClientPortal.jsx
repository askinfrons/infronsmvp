import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from './supabaseClient'

export default function ClientPortal() {
  const { token } = useParams()
  const [client, setClient] = useState(null)
  const [practice, setPractice] = useState(null)
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [selectedFile, setSelectedFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [messageTimestamps, setMessageTimestamps] = useState([])
  const messagesEndRef = useRef(null)
  const fileInputRef = useRef(null)

  useEffect(() => { fetchClientByToken() }, [token])

  useEffect(() => {
    if (!client?.id) return
    fetchMessages()
    const channel = supabase
      .channel(`portal-messages:${client.id}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'messages', filter: `client_id=eq.${client.id}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setMessages(prev => [...prev, payload.new])
            scrollToBottom()
          }
        }
      ).subscribe()
    return () => supabase.removeChannel(channel)
  }, [client?.id])

  useEffect(() => { scrollToBottom() }, [messages])
  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })

  const fetchClientByToken = async () => {
    try {
      setError('')
      const { data, error } = await supabase
        .from('clients')
        .select('id, name, company, portal_token, practices(name)')
        .eq('portal_token', token)
        .single()
      if (error) throw error
      setClient(data)
      setPractice(data.practices)
    } catch {
      setError('Invalid or expired link')
    } finally {
      setLoading(false)
    }
  }

  const fetchMessages = async () => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('id, client_id, sender, content, file_url, file_name, is_read, created_at')
        .eq('client_id', client.id)
        .order('created_at', { ascending: true })
      if (error) throw error
      setMessages(data || [])
    } catch (err) { setError(err.message) }
  }

  const sendMessage = async (e) => {
    e.preventDefault()
    if (!newMessage.trim() && !selectedFile) return
    const now = Date.now()
    const recentMessages = messageTimestamps.filter(ts => now - ts < 60 * 1000)
    if (recentMessages.length >= 10) {
      setMessageTimestamps(recentMessages)
      setError('Please wait a moment before sending more messages.')
      return
    }
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
        const filePath = `${client.id}/${Date.now()}.${fileExt}`
        const { error: uploadError } = await supabase.storage.from('message-attachments').upload(filePath, selectedFile)
        if (uploadError) throw uploadError
        const { data: { publicUrl } } = supabase.storage.from('message-attachments').getPublicUrl(filePath)
        fileUrl = publicUrl
        fileName = selectedFile.name
        setUploading(false)
      }
      const { error } = await supabase.from('messages').insert([{
        client_id: client.id, sender: 'client',
        content: newMessage.trim() || '📎 File attached',
        file_url: fileUrl, file_name: fileName, is_read: false
      }])
      if (error) throw error
      setMessageTimestamps([...recentMessages, now])
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
      <div style={{ textAlign: 'center' }}>
        <div style={{
          width: '36px', height: '36px', borderRadius: '50%',
          border: '3px solid var(--border)', borderTopColor: 'var(--accent)',
          animation: 'spin 0.8s linear infinite', margin: '0 auto 16px',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Loading…</p>
      </div>
    </div>
  )

  if (error && !client) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-page)', padding: '16px' }}>
      <div style={{
        background: 'var(--bg-surface)', border: '1px solid var(--border)',
        borderRadius: '16px', padding: '48px 32px', textAlign: 'center', maxWidth: '400px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
      }}>
        <p style={{ fontSize: '24px', marginBottom: '12px' }}>🔒</p>
        <h1 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>Access Denied</h1>
        <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>{error}</p>
      </div>
    </div>
  )

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-page)' }}>
      {/* Header */}
      <div style={{
        background: 'var(--primary)',
        padding: '16px 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <div>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '12px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>
            {practice?.name}
          </p>
          <h1 style={{ color: 'white', fontSize: '16px', fontWeight: 600 }}>{client?.name}</h1>
        </div>
        <span style={{
          background: 'rgba(16,185,129,0.2)', color: '#6EE7B7',
          padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 500,
        }}>
          Secure Portal
        </span>
      </div>

      {error && (
        <div style={{ padding: '10px 24px', background: '#FEF2F2', borderBottom: '1px solid #FECACA', flexShrink: 0 }}>
          <p style={{ color: 'var(--danger)', fontSize: '13px' }}>{error}</p>
        </div>
      )}

      {/* Messages */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: '24px',
        display: 'flex', flexDirection: 'column', gap: '12px',
        maxWidth: '800px', width: '100%', margin: '0 auto', boxSizing: 'border-box',
      }}>
        {messages.length === 0 ? (
          <div style={{ textAlign: 'center', marginTop: '64px' }}>
            <p style={{ fontSize: '18px', marginBottom: '8px' }}>👋</p>
            <p style={{ fontSize: '15px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '4px' }}>
              Welcome, {client?.name}!
            </p>
            <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
              Your CA will send messages here. You can reply below.
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isClient = msg.sender === 'client'
            return (
              <div key={msg.id} style={{ display: 'flex', justifyContent: isClient ? 'flex-end' : 'flex-start' }}>
                {!isClient && (
                  <div style={{
                    width: '32px', height: '32px', borderRadius: '50%',
                    background: 'var(--primary)', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', flexShrink: 0, marginRight: '10px', alignSelf: 'flex-end',
                  }}>
                    <span style={{ color: 'white', fontSize: '12px', fontWeight: 600 }}>
                      {(practice?.name || 'CA').charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
                <div style={{
                  maxWidth: '70%',
                  background: isClient ? 'var(--accent)' : 'var(--bg-surface)',
                  color: isClient ? 'white' : 'var(--text-primary)',
                  border: isClient ? 'none' : '1px solid var(--border)',
                  borderRadius: isClient ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                  padding: '12px 16px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                }}>
                  {!isClient && (
                    <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                      {practice?.name}
                    </p>
                  )}
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
                        color: isClient ? 'rgba(255,255,255,0.85)' : 'var(--accent)',
                        textDecoration: 'underline',
                      }}
                    >
                      📎 {msg.file_name || 'Download attachment'}
                    </a>
                  )}
                  <p style={{
                    fontSize: '11px', marginTop: '6px', textAlign: 'right',
                    color: isClient ? 'rgba(255,255,255,0.6)' : 'var(--text-muted)',
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
        borderTop: '1px solid var(--border)', background: 'var(--bg-surface)',
        padding: '16px 24px', flexShrink: 0,
      }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
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
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', fontSize: '13px', fontFamily: 'inherit' }}
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
                opacity: sending || uploading ? 0.5 : 1, fontSize: '16px', flexShrink: 0,
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
              placeholder="Type your message…"
              disabled={sending || uploading}
              style={{
                flex: 1, border: '1px solid var(--border)', borderRadius: '8px',
                padding: '10px 14px', fontSize: '14px', outline: 'none',
                fontFamily: 'inherit', color: 'var(--text-primary)', background: 'var(--bg-surface)',
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
      </div>
    </div>
  )
}
