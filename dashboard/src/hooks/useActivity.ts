import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import type { ActivityEvent, ActivityFilter, TimeGroup } from '../types/activity'

const API_BASE = '/api'

function getApiToken(): string {
  return localStorage.getItem('mahoraga_api_token') || 
    (window as unknown as { VITE_MAHORAGA_API_TOKEN?: string }).VITE_MAHORAGA_API_TOKEN || ''
}

function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = getApiToken()
  const headers = new Headers(options.headers)
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json')
  }
  return fetch(url, { ...options, headers })
}

// Generate realistic mock data for demo
function generateMockEvents(): ActivityEvent[] {
  const now = Date.now()
  const events: ActivityEvent[] = []

  // Today - Trading events
  events.push({
    id: `evt-${now}-1`,
    timestamp: new Date(now - 15 * 60 * 1000).toISOString(), // 15 min ago
    category: 'trading',
    type: 'signal',
    title: 'Signal Generated',
    description: 'High confidence BUY signal detected',
    metadata: { symbol: 'AVGO', market: 'NASDAQ' },
    importance: 'high',
  })
  events.push({
    id: `evt-${now}-2`,
    timestamp: new Date(now - 45 * 60 * 1000).toISOString(), // 45 min ago
    category: 'trading',
    type: 'signal',
    title: 'Signal Generated',
    description: 'Momentum building on semiconductor sector',
    metadata: { symbol: 'NVDA', market: 'NASDAQ' },
    importance: 'medium',
  })
  events.push({
    id: `evt-${now}-3`,
    timestamp: new Date(now - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
    category: 'trading',
    type: 'signal',
    title: 'Signal Generated',
    description: 'Cloud infrastructure play emerging',
    metadata: { symbol: 'MSFT', market: 'NASDAQ' },
    importance: 'medium',
  })

  // Today - Opportunities events
  events.push({
    id: `evt-${now}-4`,
    timestamp: new Date(now - 30 * 60 * 1000).toISOString(), // 30 min ago
    category: 'opportunities',
    type: 'paper_trade',
    title: 'Paper Trade Executed',
    description: 'Will BTC hit $100k? YES+NO arbitrage position opened',
    metadata: { market: 'BTC 100k', profit: 0.23, volume: 100 },
    importance: 'medium',
  })
  events.push({
    id: `evt-${now}-5`,
    timestamp: new Date(now - 1.5 * 60 * 60 * 1000).toISOString(), // 1.5 hours ago
    category: 'opportunities',
    type: 'arbitrage',
    title: 'Arbitrage Opportunity Found',
    description: 'US x Russia military clash - mispricing detected',
    metadata: { market: 'US-Russia Conflict', profit: 2.5, volume: 500 },
    importance: 'high',
  })
  events.push({
    id: `evt-${now}-6`,
    timestamp: new Date(now - 3 * 60 * 60 * 1000).toISOString(), // 3 hours ago
    category: 'opportunities',
    type: 'yield_alert',
    title: 'Yield Alert',
    description: 'JEPQ dividend capture opportunity',
    metadata: { symbol: 'JEPQ', profit: 10.57 },
    importance: 'low',
  })

  // Today - System events
  events.push({
    id: `evt-${now}-7`,
    timestamp: new Date(now - 5 * 60 * 1000).toISOString(), // 5 min ago
    category: 'system',
    type: 'scan',
    title: 'Market Scan Complete',
    description: 'Full market sweep finished - 50 markets analyzed',
    metadata: { volume: 50 },
    importance: 'low',
  })
  events.push({
    id: `evt-${now}-8`,
    timestamp: new Date(now - 4 * 60 * 60 * 1000).toISOString(), // 4 hours ago
    category: 'system',
    type: 'milestone',
    title: 'P&L Milestone Reached',
    description: 'Portfolio crossed $100k equity threshold',
    metadata: { profit: 100000 },
    importance: 'high',
  })

  // Yesterday
  events.push({
    id: `evt-${now}-9`,
    timestamp: new Date(now - 20 * 60 * 60 * 1000).toISOString(), // ~20 hours ago (yesterday)
    category: 'trading',
    type: 'trade',
    title: 'Stock Trade Executed',
    description: 'AVGO position opened at $185.50',
    metadata: { symbol: 'AVGO', profit: 1250, volume: 50 },
    importance: 'high',
  })
  events.push({
    id: `evt-${now}-10`,
    timestamp: new Date(now - 22 * 60 * 60 * 1000).toISOString(),
    category: 'opportunities',
    type: 'arbitrage',
    title: 'Arbitrage Opportunity Found',
    description: 'Political event mispricing on prediction markets',
    metadata: { market: 'Election 2024', profit: 1.8, volume: 300 },
    importance: 'medium',
  })
  events.push({
    id: `evt-${now}-11`,
    timestamp: new Date(now - 24 * 60 * 60 * 1000).toISOString(),
    category: 'system',
    type: 'scan',
    title: 'Overnight Scan Complete',
    description: '3 arbitrage opportunities found during after-hours',
    metadata: { volume: 3 },
    importance: 'medium',
  })
  events.push({
    id: `evt-${now}-12`,
    timestamp: new Date(now - 26 * 60 * 60 * 1000).toISOString(),
    category: 'system',
    type: 'error',
    title: 'API Connection Warning',
    description: 'Brief connectivity issue with Alpaca API - resolved',
    metadata: {},
    importance: 'medium',
  })

  // This week
  events.push({
    id: `evt-${now}-13`,
    timestamp: new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago
    category: 'trading',
    type: 'trade',
    title: 'Position Closed',
    description: 'NVDA take profit triggered at 15% gain',
    metadata: { symbol: 'NVDA', profit: 3200, volume: 100 },
    importance: 'high',
  })
  events.push({
    id: `evt-${now}-14`,
    timestamp: new Date(now - 4 * 24 * 60 * 60 * 1000).toISOString(),
    category: 'trading',
    type: 'trade',
    title: 'Stop Loss Triggered',
    description: 'TSLA position closed at -5%',
    metadata: { symbol: 'TSLA', profit: -850, volume: 30 },
    importance: 'high',
  })
  events.push({
    id: `evt-${now}-15`,
    timestamp: new Date(now - 5 * 24 * 60 * 60 * 1000).toISOString(),
    category: 'system',
    type: 'milestone',
    title: 'Weekly Performance Target',
    description: 'Achieved 5% weekly return target',
    metadata: { profit: 5000 },
    importance: 'high',
  })

  // Older
  events.push({
    id: `evt-${now}-16`,
    timestamp: new Date(now - 10 * 24 * 60 * 60 * 1000).toISOString(), // 10 days ago
    category: 'opportunities',
    type: 'paper_trade',
    title: 'Paper Trade Settled',
    description: 'Election arbitrage position closed with profit',
    metadata: { market: 'Election Market', profit: 45.5, volume: 200 },
    importance: 'medium',
  })
  events.push({
    id: `evt-${now}-17`,
    timestamp: new Date(now - 14 * 24 * 60 * 60 * 1000).toISOString(), // 2 weeks ago
    category: 'system',
    type: 'milestone',
    title: 'System Launch',
    description: 'MAHORAGA v2 deployed with autonomous trading',
    metadata: {},
    importance: 'high',
  })

  return events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
}

// Group events by time period
function groupEventsByTime(events: ActivityEvent[]): Record<TimeGroup, ActivityEvent[]> {
  const now = Date.now()
  const groups: Record<TimeGroup, ActivityEvent[]> = {
    today: [],
    yesterday: [],
    thisWeek: [],
    older: [],
  }

  events.forEach(event => {
    const eventTime = new Date(event.timestamp).getTime()
    const diffMs = now - eventTime
    const diffDays = diffMs / (24 * 60 * 60 * 1000)

    if (diffDays < 1) {
      groups.today.push(event)
    } else if (diffDays < 2) {
      groups.yesterday.push(event)
    } else if (diffDays < 7) {
      groups.thisWeek.push(event)
    } else {
      groups.older.push(event)
    }
  })

  return groups
}

interface UseActivityReturn {
  events: ActivityEvent[]
  filteredEvents: ActivityEvent[]
  groupedEvents: Record<TimeGroup, ActivityEvent[]>
  filter: ActivityFilter
  setFilter: (filter: ActivityFilter) => void
  loading: boolean
  error: string | null
  lastUpdated: Date | null
  isLive: boolean
  refresh: () => Promise<void>
}

export function useActivity(): UseActivityReturn {
  const [events, setEvents] = useState<ActivityEvent[]>([])
  const [filter, setFilter] = useState<ActivityFilter>('all')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [isLive, setIsLive] = useState(true)
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  // Filter events based on selected category
  const filteredEvents = useMemo(() => {
    if (filter === 'all') return events
    return events.filter(event => event.category === filter)
  }, [events, filter])

  // Group filtered events by time
  const groupedEvents = useMemo(() => {
    return groupEventsByTime(filteredEvents)
  }, [filteredEvents])

  // Fetch activity data
  const fetchActivity = useCallback(async () => {
    setLoading(true)
    setError(null)
    
    try {
      // Try to fetch from API first
      const res = await authFetch(`${API_BASE}/activity`)
      
      if (res.ok) {
        const result = await res.json()
        if (result.ok && result.data) {
          setEvents(result.data)
          setLastUpdated(new Date())
          setIsLive(true)
          setLoading(false)
          return
        }
      }
      
      // Fall back to mock data if API not available
      // In production, this would be removed
      const mockEvents = generateMockEvents()
      setEvents(mockEvents)
      setLastUpdated(new Date())
      setIsLive(true)
    } catch (err) {
      // Fall back to mock data on error
      const mockEvents = generateMockEvents()
      setEvents(mockEvents)
      setLastUpdated(new Date())
      setIsLive(false)
    } finally {
      setLoading(false)
    }
  }, [])

  // Manual refresh
  const refresh = useCallback(async () => {
    await fetchActivity()
  }, [fetchActivity])

  // Initial fetch and auto-refresh every 30 seconds
  useEffect(() => {
    fetchActivity()

    intervalRef.current = setInterval(() => {
      fetchActivity()
    }, 30 * 1000)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [fetchActivity])

  return {
    events,
    filteredEvents,
    groupedEvents,
    filter,
    setFilter,
    loading,
    error,
    lastUpdated,
    isLive,
    refresh,
  }
}
