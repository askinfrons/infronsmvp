import { supabase } from './supabaseClient'

export const QUICK_ACTIONS = {
  document_request: 'Document Request',
  profile_update: 'Profile Update Requested',
  general_query: 'Query',
}

export const submitPortalAction = (token, actionType, payload) =>
  supabase.rpc('submit_portal_action', {
    p_token: token,
    p_action_type: actionType,
    p_payload: payload,
  })

export const clearViewedPortalActions = (clientId) =>
  supabase.rpc('clear_viewed_portal_actions', { p_client_id: clientId })

export const resolveProfileUpdate = (messageId, decision) =>
  supabase.rpc('resolve_profile_update', { p_message_id: messageId, p_decision: decision })
