import { supabase } from './supabaseClient'

export const getVerificationState = async (token) => {
  const { data, error } = await supabase.rpc('get_portal_verification_state', { p_token: token })
  return { data: data?.[0] || null, error }
}

export const sendClientOtp = (token, channel) =>
  fetch('/api/send-client-otp', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, channel }),
  }).then(async response => {
    const body = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(body.message || 'Unable to send verification code')
    return body
  })

export const verifyClientOtp = (token, channel, code) =>
  fetch('/api/verify-client-otp', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, channel, code }),
  }).then(async response => {
    const body = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(body.message || 'Invalid verification code')
    return body
  })

export const uploadVerificationDocument = async (token, file) => {
  const form = new FormData()
  form.append('token', token)
  form.append('file', file)
  const response = await fetch('/api/upload-verification-document', { method: 'POST', body: form })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.message || 'Unable to upload document')
  return body
}

export const reviewVerificationDocument = (documentId, status, reason) =>
  supabase.rpc('set_verification_review', { p_document_id: documentId, p_status: status, p_reason: reason || null })

export const manuallyVerifyClient = (clientId) =>
  supabase.rpc('set_client_verification_override', { p_client_id: clientId })

