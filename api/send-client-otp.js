import crypto from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

const adminClient = () => createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' })
  const { token, channel } = req.body || {}
  if (!token || channel !== 'email') return res.status(400).json({ message: 'Email verification is currently supported' })
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return res.status(500).json({ message: 'SUPABASE_SERVICE_ROLE_KEY is not configured on the server' })
  const supabase = adminClient()
  const { data: client, error: clientError } = await supabase.from('clients').select('id, name, email, phone').eq('portal_token', token).maybeSingle()
  if (clientError || !client) return res.status(404).json({ message: 'Invalid or expired portal link' })
  const destination = channel === 'email' ? client.email : client.phone
  if (!destination) return res.status(400).json({ message: `No ${channel} is saved for this client` })

  const { data: latestOtp } = await supabase.from('client_verification_otps').select('created_at').eq('client_id', client.id).order('created_at', { ascending: false }).limit(1).maybeSingle()
  if (latestOtp && Date.now() - new Date(latestOtp.created_at).getTime() < 60 * 1000) return res.status(429).json({ message: 'Please wait a minute before requesting another code.' })

  const code = String(crypto.randomInt(100000, 1000000))
  const codeHash = crypto.createHash('sha256').update(code).digest('hex')
  await supabase.from('client_verification_otps').update({ consumed_at: new Date().toISOString() }).eq('client_id', client.id).is('consumed_at', null)
  const { error: otpError } = await supabase.from('client_verification_otps').insert({ client_id: client.id, channel, code_hash: codeHash, expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString() })
  if (otpError) return res.status(500).json({ message: otpError.message })

  if (channel === 'email') {
    if (!process.env.RESEND_API_KEY) return res.status(500).json({ message: 'Email delivery is not configured on the server' })
    const { error } = await new Resend(process.env.RESEND_API_KEY).emails.send({
      from: 'INFRONS <onboarding@resend.dev>', to: destination,
      subject: 'Your INFRONS verification code',
      html: `<p>Hi ${client.name || 'there'},</p><p>Your INFRONS verification code is <strong style="font-size:24px;letter-spacing:4px">${code}</strong>.</p><p>This code expires in 10 minutes.</p>`,
    })
    if (error) return res.status(400).json({ message: error.message || 'Unable to send email' })
  } else {
    return res.status(400).json({ message: 'Phone verification is not enabled yet. Please use email verification or ask the practice to verify you manually.' })
  }
  return res.status(200).json({ ok: true, destination: channel === 'email' ? destination.replace(/(.{2}).+(@.*)/, '$1•••$2') : `${destination.slice(0, 3)}••••${destination.slice(-2)}` })
}
