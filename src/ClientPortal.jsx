import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from './supabaseClient'
import { markClientMessagesSeen, recordFileDownload, recordPortalOpen } from './activityTracker'
import { submitPortalAction } from './quickActions'
import { sendClientOtp, uploadVerificationDocument, verifyClientOtp } from './verification'

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
  const [quickActionsOpen, setQuickActionsOpen] = useState(false)
  const [activeAction, setActiveAction] = useState(null)
  const [actionForm, setActionForm] = useState({ document: '', due_date: '', name: '', phone: '', email: '', company: '', text: '' })
  const [actionSubmitting, setActionSubmitting] = useState(false)
  const [otpChannel, setOtpChannel] = useState('email')
  const [otpCode, setOtpCode] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [otpSending, setOtpSending] = useState(false)
  const [otpVerifying, setOtpVerifying] = useState(false)
  const [verificationDocumentUploading, setVerificationDocumentUploading] = useState(false)
  const [verificationDocumentSubmitted, setVerificationDocumentSubmitted] = useState(false)
  const [optionalVerificationOpen, setOptionalVerificationOpen] = useState(false)
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
          } else if (payload.eventType === 'UPDATE') {
            setMessages(prev => prev.map(message => (
              message.id === payload.new.id ? payload.new : message
            )))
          }
        }
      ).subscribe()
    channel.on('postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'clients', filter: `id=eq.${client.id}` },
      (payload) => setClient(current => ({ ...current, ...payload.new }))
    )
    return () => supabase.removeChannel(channel)
  }, [client?.id])

  useEffect(() => { scrollToBottom() }, [messages])
  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })

  const fetchClientByToken = async () => {
    try {
      setError('')
      let { data, error } = await supabase
        .from('clients')
        .select('id, practice_id, name, company, email, phone, portal_token, verification_required, verification_status, otp_verified_at, verification_rejection_reason, practices(name)')
        .eq('portal_token', token)
        .single()
      if (error?.message?.includes('column')) {
        const fallback = await supabase.from('clients').select('id, practice_id, name, company, email, phone, portal_token, practices(name)').eq('portal_token', token).single()
        data = fallback.data
        error = fallback.error
      }
      if (error) throw error
      setClient(data)
      setPractice(data.practices)
      recordPortalOpen(token)
      markClientMessagesSeen(data.id)
    } catch {
      setError('Invalid or expired link')
    } finally {
      setLoading(false)
    }
  }

  const fetchMessages = async () => {
    try {
      let { data, error } = await supabase
        .from('messages')
        .select('id, client_id, sender, content, file_url, file_name, is_read, delivered_at, seen_at, file_downloaded_at, created_at')
        .eq('client_id', client.id)
        .order('created_at', { ascending: true })
      if (error?.message?.includes('column')) {
        const fallback = await supabase
          .from('messages')
          .select('id, client_id, sender, content, file_url, file_name, is_read, created_at')
          .eq('client_id', client.id)
          .order('created_at', { ascending: true })
        data = fallback.data
        error = fallback.error
      }
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

  const requiresVerification = (!!client?.verification_required || optionalVerificationOpen) && !client?.otp_verified_at && client?.verification_status !== 'fully_verified'

  const handleSendOtp = async (e) => {
    e?.preventDefault()
    setError('')
    setOtpSending(true)
    try { await sendClientOtp(token, otpChannel); setOtpSent(true) }
    catch (err) { setError(err.message) }
    finally { setOtpSending(false) }
  }

  const handleVerifyOtp = async (e) => {
    e.preventDefault()
    setError('')
    setOtpVerifying(true)
    try {
      const result = await verifyClientOtp(token, otpChannel, otpCode)
      setOptionalVerificationOpen(false)
      setClient(current => ({ ...current, otp_verified_at: new Date().toISOString(), verification_status: result.fullyVerified ? 'fully_verified' : 'otp_verified' }))
      await fetchClientByToken()
      setOtpCode('')
    }
    catch (err) { setError(err.message) }
    finally { setOtpVerifying(false) }
  }

  const handleVerificationDocument = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 15 * 1024 * 1024) { setError('Document must be under 15MB'); return }
    setError('')
    setVerificationDocumentUploading(true)
    try { await uploadVerificationDocument(token, file); setVerificationDocumentSubmitted(true) }
    catch (err) { setError(err.message) }
    finally { setVerificationDocumentUploading(false); e.target.value = '' }
  }

  const openAction = (action) => {
    setError('')
    setActionForm({
      document: '', due_date: '', name: client?.name || '', phone: client?.phone || '',
      email: client?.email || '', company: client?.company || '', text: '',
    })
    setActiveAction(action)
    setQuickActionsOpen(false)
  }

  const submitAction = async (e) => {
    e.preventDefault()
    const payload = activeAction === 'document_request'
      ? { document: actionForm.document.trim(), due_date: actionForm.due_date || null }
      : activeAction === 'general_query'
        ? { text: actionForm.text.trim() }
      : Object.fromEntries(['name', 'phone', 'email', 'company']
          .map(field => [field, actionForm[field].trim()])
          .filter(([field, value]) => value && value !== (client?.[field] || '').trim()))
    if (activeAction === 'document_request' && !payload.document) return setError('Please describe the document you need.')
    if (activeAction === 'general_query' && !payload.text) return setError('Please enter your query.')
    if (activeAction === 'profile_update' && !Object.keys(payload).length) return setError('Please change at least one profile field.')
    if (payload.email && !/^\S+@\S+\.\S+$/.test(payload.email)) return setError('Please enter a valid email address.')
    setActionSubmitting(true)
    try {
      const { error: actionError } = await submitPortalAction(token, activeAction, payload)
      if (actionError) throw actionError
      setActiveAction(null)
      setActionForm({ document: '', due_date: '', name: '', phone: '', email: '', company: '', text: '' })
    } catch (err) { setError(err.message) }
    finally { setActionSubmitting(false) }
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

  if (requiresVerification) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-page)', padding: '20px' }}>
      <div style={{ width: '100%', maxWidth: '440px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '14px', padding: '30px', boxShadow: '0 12px 35px rgba(15,23,42,0.08)' }}>
        <p style={{ color: 'var(--accent)', fontWeight: 700, fontSize: '13px', marginBottom: '8px' }}>INFRONS verification</p>
        <h1 style={{ color: 'var(--text-primary)', fontSize: '22px', marginBottom: '8px' }}>Verify your identity</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: 1.5, marginBottom: '22px' }}>This secure portal needs a one-time email verification before you can access messages and documents.</p>
        {!otpSent ? <form onSubmit={handleSendOtp}>
          <label style={labelStyle}>Verification channel<select value="email" style={fieldStyle}><option>Email {client?.email ? `(${client.email})` : '(not available)'}</option></select></label>
          {!client?.email && <p style={{ color: 'var(--danger)', fontSize: '13px', marginBottom: '12px' }}>No email is saved for this client. Ask the practice to add one or manually verify you.</p>}
          <button type="submit" disabled={otpSending || !client?.email} style={{ width: '100%', border: 'none', borderRadius: '8px', padding: '11px', background: 'var(--accent)', color: 'white', fontWeight: 600, cursor: otpSending || !client?.email ? 'not-allowed' : 'pointer', opacity: otpSending || !client?.email ? 0.5 : 1 }}>{otpSending ? 'Sending code…' : 'Send email code'}</button>
        </form> : <form onSubmit={handleVerifyOtp}>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '12px' }}>Enter the six-digit code sent to your email. It expires in 10 minutes.</p>
          <input autoFocus inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={otpCode} onChange={e => setOtpCode(e.target.value.replace(/\D/g, ''))} placeholder="000000" style={{ ...fieldStyle, fontSize: '24px', letterSpacing: '6px', textAlign: 'center', marginBottom: '12px' }} />
          <button type="submit" disabled={otpVerifying || otpCode.length !== 6} style={{ width: '100%', border: 'none', borderRadius: '8px', padding: '11px', background: 'var(--accent)', color: 'white', fontWeight: 600, cursor: otpVerifying || otpCode.length !== 6 ? 'not-allowed' : 'pointer', opacity: otpVerifying || otpCode.length !== 6 ? 0.5 : 1 }}>{otpVerifying ? 'Checking…' : 'Verify and continue'}</button>
          <button type="button" onClick={() => { setOtpSent(false); setOtpCode('') }} style={{ width: '100%', marginTop: '10px', border: 'none', background: 'none', color: 'var(--accent)', cursor: 'pointer', fontFamily: 'inherit', fontSize: '13px' }}>Send a new code</button>
        </form>}
        {error && <p style={{ color: 'var(--danger)', fontSize: '13px', marginTop: '14px' }}>{error}</p>}
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

      {!client?.verification_required && !client?.otp_verified_at && !optionalVerificationOpen && (
        <div style={{ padding: '9px 24px', background: '#F8FAFC', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}><span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>Want an extra layer of identity protection?</span><button type="button" onClick={() => setOptionalVerificationOpen(true)} style={{ border: 'none', background: 'none', color: 'var(--accent)', fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Verify identity</button></div>
        </div>
      )}

      {client?.otp_verified_at && client?.verification_status !== 'fully_verified' && (
        <div style={{ padding: '12px 24px', background: client.verification_status === 'rejected' ? '#FEF2F2' : '#EFF6FF', borderBottom: `1px solid ${client.verification_status === 'rejected' ? '#FECACA' : '#BFDBFE'}`, flexShrink: 0 }}>
          <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '220px' }}><p style={{ color: client.verification_status === 'rejected' ? '#991B1B' : '#1E40AF', fontSize: '13px', fontWeight: 700 }}>{client.verification_status === 'rejected' ? 'Document review needs attention' : 'OTP verified'}</p><p style={{ color: client.verification_status === 'rejected' ? '#B91C1C' : '#1D4ED8', fontSize: '12px', marginTop: '3px' }}>{client.verification_status === 'rejected' ? (client.verification_rejection_reason || 'Please upload a new identity document.') : 'Upload an ID or PAN document for the CA to complete your verification.'}</p></div>
            {!verificationDocumentSubmitted && <label style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', background: 'white', border: '1px solid #93C5FD', borderRadius: '8px', padding: '8px 11px', color: '#1D4ED8', fontSize: '12px', fontWeight: 700, cursor: verificationDocumentUploading ? 'not-allowed' : 'pointer' }}><input type="file" accept="image/*,.pdf" onChange={handleVerificationDocument} disabled={verificationDocumentUploading} style={{ display: 'none' }} />{verificationDocumentUploading ? 'Uploading…' : 'Upload ID / PAN'}</label>}
            {verificationDocumentSubmitted && <span style={{ color: '#1D4ED8', fontSize: '12px', fontWeight: 700 }}>Document submitted for review</span>}
          </div>
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
                  {msg.message_type && msg.message_type !== 'text' && (
                    <span style={{ display: 'inline-block', marginBottom: '7px', padding: '3px 8px', borderRadius: '999px', background: isClient ? 'rgba(255,255,255,0.18)' : 'rgba(99,102,241,0.1)', color: isClient ? 'white' : 'var(--accent)', fontSize: '11px', fontWeight: 600 }}>
                      {msg.message_type === 'document_request' ? 'Document Request' : msg.message_type === 'profile_update' ? 'Profile Update Requested' : 'Query'}
                    </span>
                  )}
                  <p style={{ fontSize: '14px', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {msg.content}
                  </p>
                  {msg.file_url && (
                    <a
                      href={msg.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => recordFileDownload(msg.id)}
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
            <button
              type="button"
              aria-label="Quick actions"
              title="Quick actions"
              onClick={() => setQuickActionsOpen(value => !value)}
              disabled={sending || uploading}
              style={{ background: quickActionsOpen ? 'rgba(99,102,241,0.1)' : 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 12px', cursor: 'pointer', color: 'var(--accent)', fontSize: '16px', flexShrink: 0 }}
            >
              ✦
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
          {quickActionsOpen && (
            <div style={{ marginTop: '10px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {[['document_request', 'Request document'], ['profile_update', 'Update profile'], ['general_query', 'Send a query']].map(([action, label]) => (
                <button key={action} type="button" onClick={() => openAction(action)} style={{ background: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px 10px', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit' }}>{label}</button>
              ))}
            </div>
          )}
        </div>
      </div>
      {activeAction && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 20, background: 'rgba(15,23,42,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }} onMouseDown={(e) => e.target === e.currentTarget && setActiveAction(null)}>
          <form onSubmit={submitAction} style={{ width: '100%', maxWidth: '460px', background: 'var(--bg-surface)', borderRadius: '12px', padding: '24px', boxShadow: '0 20px 50px rgba(15,23,42,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <h2 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '17px' }}>{activeAction === 'document_request' ? 'Request a document' : activeAction === 'profile_update' ? 'Update your profile' : 'Send a general query'}</h2>
              <button type="button" onClick={() => setActiveAction(null)} style={{ border: 'none', background: 'none', fontSize: '20px', color: 'var(--text-muted)', cursor: 'pointer' }} aria-label="Close">×</button>
            </div>
            {activeAction === 'document_request' && <>
              <label style={labelStyle}>What document do you need?<input autoFocus value={actionForm.document} onChange={e => setActionForm({ ...actionForm, document: e.target.value })} style={fieldStyle} maxLength={160} /></label>
              <label style={labelStyle}>Due by (optional)<input type="date" value={actionForm.due_date} onChange={e => setActionForm({ ...actionForm, due_date: e.target.value })} style={fieldStyle} /></label>
            </>}
            {activeAction === 'general_query' && <label style={labelStyle}>Your query<textarea autoFocus value={actionForm.text} onChange={e => setActionForm({ ...actionForm, text: e.target.value })} style={{ ...fieldStyle, minHeight: '100px', resize: 'vertical' }} maxLength={2000} /></label>}
            {activeAction === 'profile_update' && <>
              <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: '0 0 14px' }}>Changes stay pending until your CA approves them.</p>
              {[['name', 'Name'], ['phone', 'Phone'], ['email', 'Email'], ['company', 'Company name']].map(([field, label]) => <label key={field} style={labelStyle}>{label}<input type={field === 'email' ? 'email' : 'text'} value={actionForm[field]} onChange={e => setActionForm({ ...actionForm, [field]: e.target.value })} style={fieldStyle} /></label>)}
            </>}
            <button type="submit" disabled={actionSubmitting} style={{ width: '100%', marginTop: '8px', border: 'none', borderRadius: '8px', padding: '11px', background: 'var(--accent)', color: 'white', fontWeight: 600, cursor: actionSubmitting ? 'not-allowed' : 'pointer', opacity: actionSubmitting ? 0.6 : 1 }}>{actionSubmitting ? 'Sending…' : 'Submit request'}</button>
          </form>
        </div>
      )}
    </div>
  )
}

const labelStyle = { display: 'block', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 600, marginBottom: '12px' }
const fieldStyle = { display: 'block', width: '100%', boxSizing: 'border-box', marginTop: '6px', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: '8px', fontFamily: 'inherit', fontSize: '14px', color: 'var(--text-primary)', background: 'var(--bg-surface)' }
