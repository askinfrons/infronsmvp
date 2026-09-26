export const CAPACITY_TIERS = [
  { id: '0-50', label: '0-50 clients', limit: 50, plan: 'Starter' },
  { id: '51-100', label: '51-100 clients', limit: 100, plan: 'Pro' },
  { id: '101-150', label: '101-150 clients', limit: 150, plan: 'Pro' },
  { id: '151-200', label: '151-200 clients', limit: 200, plan: 'Pro' },
  { id: '201-300', label: '201-300 clients', limit: 300, plan: 'Pro' },
  { id: '300+', label: '300+ clients', limit: null, plan: 'Business' },
]

export const DEFAULT_CAPACITY_TIER = CAPACITY_TIERS[0]

export const getCapacityTier = (tierId, limit) => {
  const tier = CAPACITY_TIERS.find(item => item.id === tierId)
  if (tier) return tier
  if (limit) return CAPACITY_TIERS.find(item => item.limit === limit) || DEFAULT_CAPACITY_TIER
  return DEFAULT_CAPACITY_TIER
}

export const getCapacityStatus = (clientCount, tierId, limit) => {
  const tier = getCapacityTier(tierId, limit)
  if (!tier.limit) {
    return { tier, percent: 0, label: `${clientCount} clients`, tone: 'business' }
  }

  const percent = Math.min(100, Math.round((clientCount / tier.limit) * 100))
  if (clientCount >= tier.limit) return { tier, percent, label: 'Capacity reached', tone: 'danger' }
  if (percent >= 80) return { tier, percent, label: 'Near capacity', tone: 'warning' }
  return { tier, percent, label: 'Healthy capacity', tone: 'healthy' }
}
