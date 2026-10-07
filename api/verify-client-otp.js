import crypto from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' })
  const { token, channel, code } = req.body || {}
  if (!token || !channel || !/^\d{6}$/.test(String(code || ''))) return res.status(400).json({ message: 'Enter the six-digit code' })
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return res.status(500).json({ message: 'SUPABASE_SERVICE_ROLE_KEY is not configured on the server' })
  const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  const { data: client } = await supabase.from('clients').select('id').eq('portal_token', token).maybeSingle()
  if (!client) return res.status(404).json({ message: 'Invalid or expired portal link' })
  const { data: otp } = await supabase.from('client_verification_otps').select('id, code_hash, expires_at, attempts').eq('client_id', client.id).eq('channel', channel).is('consumed_at', null).order('created_at', { ascending: false }).limit(1).maybeSingle()
  if (!otp || new Date(otp.expires_at).getTime() < Date.now()) return res.status(400).json({ message: 'This code has expired. Request a new one.' })
  if (otp.attempts >= 5) return res.status(429).json({ message: 'Too many attempts. Request a new code.' })
  const hash = crypto.createHash('sha256').update(String(code)).digest('hex')
  if (hash !== otp.code_hash) {
    await supabase.from('client_verification_otps').update({ attempts: otp.attempts + 1 }).eq('id', otp.id)
    return res.status(400).json({ message: 'That code is not correct' })
  }
  await supabase.from('client_verification_otps').update({ consumed_at: new Date().toISOString() }).eq('id', otp.id)
  const { data: approvedDocument } = await supabase.from('client_verification_documents').select('id').eq('client_id', client.id).eq('status', 'approved').limit(1).maybeSingle()
  await supabase.from('clients').update({ otp_verified_at: new Date().toISOString(), verification_status: approvedDocument ? 'fully_verified' : 'otp_verified', verification_rejection_reason: null }).eq('id', client.id)
  return res.status(200).json({ ok: true, fullyVerified: !!approvedDocument })
}

