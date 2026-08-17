import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from './supabaseClient'
import Sidebar, { IC } from './Sidebar'

const MAX_FILE_SIZE = 15 * 1024 * 1024

export default function Documents() {
  const { id } = useParams()
  const navigate = useNavigate()
  const fileInputRef = useRef(null)
  const [client, setClient] = useState(null)
  const [documents, setDocuments] = useState([])
  const [selectedFile, setSelectedFile] = useState(null)
  const [currentUser, setCurrentUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => { checkAuthAndFetch() }, [id])

  const checkAuthAndFetch = async () => {
    try {
      setLoading(true)
      setError('')
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { navigate('/login'); return }
      setCurrentUser(user)
      const clientData = await fetchClient(user.id)
      if (clientData) await fetchDocuments()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const fetchClient = async (userId) => {
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, practice_id, role')
      .eq('id', userId)
      .single()
    if (userError) throw userError

    let query = supabase
      .from('clients')
      .select('id, practice_id, assigned_to, name, company')
      .eq('id', id)
      .eq('practice_id', userData.practice_id)
    if (userData.role === 'staff') query = query.eq('assigned_to', userId)

    const { data, error: clientError } = await query.single()
    if (clientError) throw clientError
    setClient(data)
    return data
  }

  const fetchDocuments = async () => {
    const { data, error: docsError } = await supabase
      .from('client_documents')
      .select('id, client_id, practice_id, uploaded_by, file_name, file_path, file_size, file_type, created_at')
      .eq('client_id', id)
      .order('created_at', { ascending: false })
    if (docsError) throw docsError
    setDocuments(data || [])
  }

  const handleFileSelect = (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (file.size > MAX_FILE_SIZE) {
      setSelectedFile(null)
      setError('File must be under 15MB')
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }
    setError('')
    setSuccess('')
    setSelectedFile(file)
  }

  const uploadDocument = async (event) => {
    event.preventDefault()
    if (!selectedFile || !client || !currentUser) return
    if (selectedFile.size > MAX_FILE_SIZE) {
      setError('File must be under 15MB')
      return
    }

    setUploading(true)
    setError('')
    setSuccess('')
    let filePath = ''

    try {
      const safeName = selectedFile.name.replace(/[^a-zA-Z0-9._-]/g, '-')
      filePath = `${client.id}/${Date.now()}-${safeName}`
      const { error: uploadError } = await supabase.storage
        .from('client-documents')
        .upload(filePath, selectedFile, {
          contentType: selectedFile.type || 'application/octet-stream',
          upsert: false,
        })
      if (uploadError) throw new Error(`Storage upload failed: ${uploadError.message}`)

      const { error: insertError } = await supabase
        .from('client_documents')
        .insert([{
          client_id: client.id,
          practice_id: client.practice_id,
          uploaded_by: currentUser.id,
          file_name: selectedFile.name,
          file_path: filePath,
          file_size: selectedFile.size,
          file_type: selectedFile.type || 'application/octet-stream',
        }])

      if (insertError) {
        await supabase.storage.from('client-documents').remove([filePath])
        throw new Error(`Document record insert failed: ${insertError.message}`)
      }

      setSelectedFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      setSuccess('Document uploaded')
      await fetchDocuments()
    } catch (err) {
      setError(err.message)
    } finally {
      setUploading(false)
    }
  }

  const openDocument = async (doc) => {
    try {
      setError('')
      const { data, error: signedError } = await supabase.storage
        .from('client-documents')
        .createSignedUrl(doc.file_path, 60)
      if (signedError) throw signedError
      window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
    } catch (err) {
      setError(err.message)
    }
  }

  const deleteDocument = async (doc) => {
    if (!confirm(`Delete ${doc.file_name}?`)) return
    try {
      setError('')
      const { error: storageError } = await supabase.storage
        .from('client-documents')
        .remove([doc.file_path])
      if (storageError) throw storageError

      const { error: deleteError } = await supabase
        .from('client_documents')
        .delete()
        .eq('id', doc.id)
      if (deleteError) throw deleteError
      setDocuments(prev => prev.filter(item => item.id !== doc.id))
      setSuccess('Document deleted')
    } catch (err) {
      setError(err.message)
    }
  }

  const formatDate = (ts) => new Date(ts).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 KB'
    if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const textareaStyle = {
    background: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: '10px',
    padding: '14px',
    color: 'var(--text-primary)',
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-page)' }}>
      <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Loading...</p>
    </div>
  )

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-page)' }}>
      <Sidebar client={client} />

      <main style={{ marginLeft: '240px', flex: 1, padding: '32px' }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: '16px', marginBottom: '28px',
        }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: 600, color: 'var(--text-primary)' }}>Documents</h1>
            {client && (
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                {client.name}{client.company ? ` - ${client.company}` : ''}
              </p>
            )}
          </div>
          <span style={{
            padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 600,
            background: '#EEF2FF', color: '#4F46E5', border: '1px solid #C7D2FE',
          }}>
            Client folder
          </span>
        </div>

        {error && (
          <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px' }}>
            <p style={{ color: 'var(--danger)', fontSize: '14px' }}>{error}</p>
          </div>
        )}
        {success && (
          <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px' }}>
            <p style={{ color: '#047857', fontSize: '14px' }}>{success}</p>
          </div>
        )}

        <div style={{ maxWidth: '920px' }}>
          <form onSubmit={uploadDocument} style={{
            ...textareaStyle,
            marginBottom: '22px',
            display: 'grid',
            gridTemplateColumns: '1fr auto',
            gap: '12px',
            alignItems: 'center',
            boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
          }}>
            <label style={{
              display: 'flex', alignItems: 'center', gap: '12px',
              minHeight: '44px', cursor: uploading ? 'not-allowed' : 'pointer',
            }}>
              <span style={{
                width: '36px', height: '36px', borderRadius: '10px',
                background: '#EEF2FF', color: '#4F46E5',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <IC.FileText />
              </span>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {selectedFile ? selectedFile.name : 'Choose a document'}
                </span>
                <span style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  {selectedFile ? formatFileSize(selectedFile.size) : 'PDF, spreadsheet, image, or document up to 15MB'}
                </span>
              </span>
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileSelect}
                disabled={uploading}
                style={{ display: 'none' }}
              />
            </label>
            <button
              type="submit"
              disabled={uploading || !selectedFile}
              style={{
                background: 'var(--accent)', color: '#FFFFFF', border: 'none',
                borderRadius: '9px', padding: '11px 18px', fontSize: '14px',
                fontWeight: 600, cursor: uploading || !selectedFile ? 'not-allowed' : 'pointer',
                opacity: uploading || !selectedFile ? 0.5 : 1, fontFamily: 'inherit',
                whiteSpace: 'nowrap',
              }}
            >
              {uploading ? 'Uploading...' : 'Upload'}
            </button>
          </form>

          {documents.length === 0 ? (
            <div style={{
              background: 'var(--bg-surface)', border: '1px solid var(--border)',
              borderRadius: '12px', padding: '48px 32px', textAlign: 'center',
              boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
            }}>
              <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
                No documents stored for this client yet.
              </p>
            </div>
          ) : (
            <div style={{
              background: 'var(--bg-surface)', border: '1px solid var(--border)',
              borderRadius: '12px', overflow: 'hidden',
              boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
            }}>
              {documents.map((doc, index) => (
                <div key={doc.id} style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr auto',
                  gap: '16px',
                  padding: '16px 18px',
                  borderBottom: index < documents.length - 1 ? '1px solid var(--border)' : 'none',
                  alignItems: 'center',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                    <span style={{
                      width: '38px', height: '38px', borderRadius: '10px',
                      background: '#F8FAFC', border: '1px solid var(--border)',
                      color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      <IC.FileText />
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <p style={{
                        fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {doc.file_name}
                      </p>
                      <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '3px' }}>
                        {formatFileSize(doc.file_size)} - Uploaded {formatDate(doc.created_at)}
                      </p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <button
                      type="button"
                      onClick={() => openDocument(doc)}
                      style={{
                        background: '#EEF2FF', color: '#4F46E5', border: '1px solid #C7D2FE',
                        borderRadius: '8px', padding: '8px 12px', fontSize: '13px',
                        fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                      }}
                    >
                      Open
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteDocument(doc)}
                      style={{
                        background: '#FFFFFF', color: 'var(--danger)', border: '1px solid #FECACA',
                        borderRadius: '8px', padding: '8px 12px', fontSize: '13px',
                        fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
