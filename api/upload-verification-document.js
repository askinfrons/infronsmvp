import crypto from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

export const config = { api: { bodyParser: false } }

const readMultipart = async (req) => {
  const chunks = []
  for await (const chunk of req) chunks.push(Buffer.from(chunk))
  const body = Buffer.concat(chunks)
  const contentType = req.headers['content-type'] || ''
  const boundary = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i)?.[1] || contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i)?.[2]
  if (!boundary) throw new Error('Invalid upload')
  const marker = Buffer.from(`--${boundary}`)
  const fields = {}
  let cursor = body.indexOf(marker)
  while (cursor >= 0) {
    const start = cursor + marker.length + 2
    const next = body.indexOf(marker, start)
    if (next < 0) break
    const part = body.subarray(start, next - 2)
    const headerEnd = part.indexOf(Buffer.from('\r\n\r\n'))
    if (headerEnd >= 0) {
      const headers = part.subarray(0, headerEnd).toString()
      const content = part.subarray(headerEnd + 4)
      const name = headers.match(/name="([^"]+)"/)?.[1]
      const filename = headers.match(/filename="([^"]*)"/)?.[1]
      if (name) fields[name] = filename ? { filename, content, type: headers.match(/Content-Type:\s*([^\r\n]+)/i)?.[1] || 'application/octet-stream' } : content.toString()
    }
    cursor = body.indexOf(marker, next)
  }
  return fields
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' })
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return res.status(500).json({ message: 'SUPABASE_SERVICE_ROLE_KEY is not configured on the server' })
  try {
    const fields = await readMultipart(req)
    const token = fields.token
    const file = fields.file
    if (!token || !file?.content?.length) return res.status(400).json({ message: 'Portal link and document are required' })
    if (file.content.length > 15 * 1024 * 1024) return res.status(400).json({ message: 'Document must be under 15MB' })
    const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
    const { data: client } = await supabase.from('clients').select('id, practice_id, otp_verified_at').eq('portal_token', token).maybeSingle()
    if (!client) return res.status(404).json({ message: 'Invalid or expired portal link' })
    if (!client.otp_verified_at) return res.status(403).json({ message: 'Complete OTP verification before uploading a document' })
    const safeName = file.filename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-120)
    const path = `${client.id}/${crypto.randomUUID()}-${safeName}`
    const { error: uploadError } = await supabase.storage.from('client-verification-documents').upload(path, file.content, { contentType: file.type, upsert: false })
    if (uploadError) return res.status(400).json({ message: uploadError.message })
    const { error: insertError } = await supabase.from('client_verification_documents').insert({ client_id: client.id, practice_id: client.practice_id, file_name: file.filename, file_path: path, file_size: file.content.length, file_type: file.type })
    if (insertError) { await supabase.storage.from('client-verification-documents').remove([path]); return res.status(400).json({ message: insertError.message }) }
    return res.status(200).json({ ok: true })
  } catch (error) { return res.status(400).json({ message: error.message || 'Unable to upload document' }) }
}

