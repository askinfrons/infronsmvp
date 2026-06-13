import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'
import Sidebar from './Sidebar'

export default function Notes() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [client, setClient] = useState(null)
  const [notes, setNotes] = useState([])
  const [newNote, setNewNote] = useState('')
  const [editingNote, setEditingNote] = useState(null)
  const [editContent, setEditContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [currentUser, setCurrentUser] = useState(null)

  useEffect(() => { checkAuthAndFetch() }, [id])

  const checkAuthAndFetch = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { navigate('/login'); return }
    setCurrentUser(user)
    await fetchClient()
    await fetchNotes()
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

  const fetchNotes = async () => {
    try {
      setError('')
      const { data, error } = await supabase
        .from('notes')
        .select('id, client_id, user_id, content, created_at, users (full_name)')
        .eq('client_id', id)
        .order('created_at', { ascending: false })
      if (error) throw error
      setNotes(data || [])
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  const addNote = async (e) => {
    e.preventDefault()
    if (!newNote.trim()) return
    setSaving(true)
    try {
      const { error } = await supabase.from('notes').insert([{ client_id: id, user_id: currentUser.id, content: newNote.trim() }])
      if (error) throw error
      setNewNote('')
      await fetchNotes()
    } catch (err) { setError(err.message) }
    finally { setSaving(false) }
  }

  const updateNote = async (noteId) => {
    if (!editContent.trim()) return
    setSaving(true)
    try {
      const { error } = await supabase.from('notes').update({ content: editContent.trim() }).eq('id', noteId)
      if (error) throw error
      setEditingNote(null); setEditContent('')
      await fetchNotes()
    } catch (err) { setError(err.message) }
    finally { setSaving(false) }
  }

  const deleteNote = async (noteId) => {
    if (!confirm('Delete this note?')) return
    try {
      const { error } = await supabase.from('notes').delete().eq('id', noteId)
      if (error) throw error
      await fetchNotes()
    } catch (err) { setError(err.message) }
  }

  const formatDate = (ts) => new Date(ts).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
  })

  const textareaStyle = {
    width: '100%', border: '1px solid var(--border)', borderRadius: '8px',
    padding: '10px 14px', fontSize: '14px', outline: 'none',
    fontFamily: 'inherit', color: 'var(--text-primary)',
    background: 'var(--bg-surface)', resize: 'none', lineHeight: 1.5,
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-page)' }}>
      <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Loading...</p>
    </div>
  )

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-page)' }}>
      {/* Sidebar */}
      <Sidebar client={client} />

      {/* Main */}
      <main style={{ marginLeft: '240px', flex: 1, padding: '32px' }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: '28px',
        }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: 600, color: 'var(--text-primary)' }}>Notes</h1>
            {client && (
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                {client.name}{client.company ? ` · ${client.company}` : ''}
              </p>
            )}
          </div>
          <span style={{
            padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 600,
            background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA',
          }}>
            Private notes — not visible to client
          </span>
        </div>

        {error && (
          <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', padding: '12px 16px', marginBottom: '20px' }}>
            <p style={{ color: 'var(--danger)', fontSize: '14px' }}>{error}</p>
          </div>
        )}

        <div style={{ maxWidth: '800px' }}>
          {/* Add note */}
          <div style={{
            background: 'var(--bg-surface)', border: '1px solid var(--border)',
            borderRadius: '12px', padding: '20px', marginBottom: '24px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
          }}>
            <form onSubmit={addNote}>
              <textarea
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Add a note…"
                rows={3}
                disabled={saving}
                style={textareaStyle}
                onFocus={(e) => {
                  e.target.style.borderColor = 'var(--accent)'
                  e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.1)'
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'var(--border)'
                  e.target.style.boxShadow = 'none'
                }}
              />
              <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="submit"
                  disabled={saving || !newNote.trim()}
                  style={{
                    background: 'var(--accent)', color: 'white',
                    border: 'none', borderRadius: '8px',
                    padding: '10px 20px', fontSize: '14px', fontWeight: 500,
                    cursor: saving || !newNote.trim() ? 'not-allowed' : 'pointer',
                    opacity: saving || !newNote.trim() ? 0.5 : 1,
                    fontFamily: 'inherit',
                  }}
                  onMouseEnter={(e) => { if (!e.currentTarget.disabled) e.currentTarget.style.background = '#4f46e5' }}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--accent)')}
                >
                  {saving ? 'Saving…' : 'Add Note'}
                </button>
              </div>
            </form>
          </div>

          {/* Notes list */}
          {notes.length === 0 ? (
            <div style={{
              background: 'var(--bg-surface)', border: '1px solid var(--border)',
              borderRadius: '12px', padding: '48px 32px', textAlign: 'center',
              boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
            }}>
              <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>No notes yet. Add one above.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {notes.map((note) => (
                <div
                  key={note.id}
                  style={{
                    background: 'var(--bg-surface)', border: '1px solid var(--border)',
                    borderRadius: '12px', padding: '20px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                  }}
                >
                  {editingNote === note.id ? (
                    <div>
                      <textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        rows={3}
                        style={textareaStyle}
                        onFocus={(e) => {
                          e.target.style.borderColor = 'var(--accent)'
                          e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.1)'
                        }}
                        onBlur={(e) => {
                          e.target.style.borderColor = 'var(--border)'
                          e.target.style.boxShadow = 'none'
                        }}
                      />
                      <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                        <button
                          onClick={() => updateNote(note.id)}
                          disabled={saving}
                          style={{
                            background: 'var(--accent)', color: 'white', border: 'none',
                            borderRadius: '8px', padding: '8px 16px', fontSize: '13px',
                            fontWeight: 500, cursor: saving ? 'not-allowed' : 'pointer',
                            opacity: saving ? 0.5 : 1, fontFamily: 'inherit',
                          }}
                          onMouseEnter={(e) => !saving && (e.target.style.background = '#4f46e5')}
                          onMouseLeave={(e) => (e.target.style.background = 'var(--accent)')}
                        >
                          Save
                        </button>
                        <button
                          onClick={() => { setEditingNote(null); setEditContent('') }}
                          style={{
                            background: 'var(--bg-surface)', color: 'var(--text-primary)',
                            border: '1px solid var(--border)', borderRadius: '8px',
                            padding: '8px 16px', fontSize: '13px', fontWeight: 500,
                            cursor: 'pointer', fontFamily: 'inherit',
                          }}
                          onMouseEnter={(e) => (e.target.style.background = 'var(--bg-subtle)')}
                          onMouseLeave={(e) => (e.target.style.background = 'var(--bg-surface)')}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <p style={{ fontSize: '14px', color: 'var(--text-primary)', lineHeight: 1.6, whiteSpace: 'pre-wrap', marginBottom: '16px' }}>
                        {note.content}
                      </p>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{
                            width: '24px', height: '24px', borderRadius: '50%',
                            background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>
                            <span style={{ color: 'white', fontSize: '11px', fontWeight: 600 }}>
                              {(note.users?.full_name || 'U').charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>
                            {note.users?.full_name || 'Unknown'}
                          </span>
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>·</span>
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{formatDate(note.created_at)}</span>
                        </div>
                        {note.user_id === currentUser?.id && (
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                              onClick={() => { setEditingNote(note.id); setEditContent(note.content) }}
                              style={{
                                background: 'none', border: 'none', cursor: 'pointer',
                                fontSize: '13px', color: 'var(--accent)', fontFamily: 'inherit',
                                padding: '4px 8px', borderRadius: '6px',
                              }}
                              onMouseEnter={(e) => (e.target.style.background = 'rgba(99,102,241,0.08)')}
                              onMouseLeave={(e) => (e.target.style.background = 'none')}
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => deleteNote(note.id)}
                              style={{
                                background: 'none', border: 'none', cursor: 'pointer',
                                fontSize: '13px', color: 'var(--danger)', fontFamily: 'inherit',
                                padding: '4px 8px', borderRadius: '6px',
                              }}
                              onMouseEnter={(e) => (e.target.style.background = '#FEF2F2')}
                              onMouseLeave={(e) => (e.target.style.background = 'none')}
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
