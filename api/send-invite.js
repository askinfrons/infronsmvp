import { Resend } from 'resend'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ message: 'Method not allowed' })
  }

  const resendApiKey = process.env.RESEND_API_KEY
  if (!resendApiKey) {
    return res.status(500).json({ message: 'RESEND_API_KEY is not configured on the server' })
  }

  const resend = new Resend(resendApiKey)
  const { to, name, inviteLink, inviterName } = req.body || {}
  if (!to || !inviteLink) {
    return res.status(400).json({ message: 'Invite email and link are required' })
  }

  const safeName = name || 'there'
  const safeInviter = inviterName || 'your practice'

  const { error } = await resend.emails.send({
    from: 'INFRONS <onboarding@resend.dev>',
    to,
    subject: `You've been invited to join ${safeInviter} on INFRONS`,
    html: `
      <div style="font-family: Inter, Arial, sans-serif; padding: 24px; color: #111827;">
        <h2 style="margin: 0 0 12px;">Join your team on INFRONS</h2>
        <p>Hi ${safeName},</p>
        <p>${safeInviter} invited you to join their INFRONS workspace.</p>
        <p>
          <a href="${inviteLink}" style="display: inline-block; padding: 11px 18px; background: #6366f1; color: white; text-decoration: none; border-radius: 8px; font-weight: 600;">
            Accept invitation
          </a>
        </p>
        <p style="font-size: 13px; color: #6B7280;">If the button does not work, copy this link: ${inviteLink}</p>
      </div>
    `,
  })

  if (error) {
    return res.status(400).json({ message: error.message || 'Failed to send invite' })
  }

  return res.status(200).json({ ok: true })
}
