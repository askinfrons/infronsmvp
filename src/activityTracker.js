import { supabase } from './supabaseClient'

export const formatRelativeTime = (value) => {
  if (!value) return 'No activity yet'

  const time = new Date(value).getTime()
  if (Number.isNaN(time)) return 'No activity yet'

  const seconds = Math.max(0, Math.floor((Date.now() - time) / 1000))
  if (seconds < 60) return 'just now'

  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`

  const days = Math.floor(hours / 24)
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`

  const months = Math.floor(days / 30)
  if (months < 12) return `${months} month${months === 1 ? '' : 's'} ago`

  const years = Math.floor(days / 365)
  return `${years} year${years === 1 ? '' : 's'} ago`
}

export const recordPortalOpen = async (token) => {
  if (!token) return
  const { error } = await supabase.rpc('record_portal_open', { p_token: token })
  if (error) console.warn('Activity tracker: portal open was not recorded.', error.message)
}

export const markClientMessagesSeen = async (clientId) => {
  if (!clientId) return
  const { error } = await supabase.rpc('mark_client_messages_seen', { p_client_id: clientId })
  if (error) console.warn('Activity tracker: message seen state was not recorded.', error.message)
}

export const recordFileDownload = async (messageId) => {
  if (!messageId) return
  const { error } = await supabase.rpc('record_file_download', { p_message_id: messageId })
  if (error) console.warn('Activity tracker: file download was not recorded.', error.message)
}
