import { useState, useEffect, useCallback, useRef } from 'react'

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

export interface ArbitrageOpportunity {
  market: string
  yesPrice: number
  noPrice: number
  profitPercent: number
  volume: number
  timestamp: string
}

export interface IncomeOpportunity {
  protocol: string
  asset: string
  apy: number
  tvl: number
  risk: 'low' | 'medium' | 'high'
  timestamp: string
}

export interface OpportunitiesData {
  arbitrage: ArbitrageOpportunity[]
  income: IncomeOpportunity[]
}

interface UseOpportunitiesReturn {
  data: OpportunitiesData
  loading: {
    arbitrage: boolean
    income: boolean
  }
  error: {
    arbitrage: string | null
    income: string | null
  }
  lastUpdated: {
    arbitrage: Date | null
    income: Date | null
  }
  refetch: () => Promise<void>
}

const INITIAL_DATA: OpportunitiesData = {
  arbitrage: [],
  income: [
    {
      protocol: 'JEPQ',
      asset: 'JEPQ ETF',
      apy: 10.57,
      tvl: 0,
      risk: 'medium',
      timestamp: new Date().toISOString(),
    },
    {
      protocol: 'Aave',
      asset: 'USDG',
      apy: 6.51,
      tvl: 0,
      risk: 'low',
      timestamp: new Date().toISOString(),
    },
  ],
}

export function useOpportunities(): UseOpportunitiesReturn {
  const [data, setData] = useState<OpportunitiesData>(INITIAL_DATA)
  const [loading, setLoading] = useState({
    arbitrage: false,
    income: false,
  })
  const [error, setError] = useState({
    arbitrage: null as string | null,
    income: null as string | null,
  })
  const [lastUpdated, setLastUpdated] = useState({
    arbitrage: null as Date | null,
    income: null as Date | null,
  })

  // Use refs to track interval and prevent stale closures
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  const fetchArbitrage = useCallback(async () => {
    setLoading(prev => ({ ...prev, arbitrage: true }))
    setError(prev => ({ ...prev, arbitrage: null }))
    
    try {
      const res = await authFetch(`${API_BASE}/opportunities/arbitrage`)
      const result = await res.json()
      
      const items = result.data || result.opportunities
      if (items) {
        // Map backend fields to frontend fields (supports both transformed and raw formats)
        const mapped = items.map((item: Record<string, unknown>) => ({
          market: item.market || item.marketName,
          yesPrice: item.yesPrice,
          noPrice: item.noPrice,
          profitPercent: item.profitPercent,
          volume: item.volume ?? item.volume24h ?? 0,
          timestamp: item.timestamp || item.updatedAt,
        })) as ArbitrageOpportunity[]
        const sorted = mapped.sort((a, b) => b.profitPercent - a.profitPercent)
        setData(prev => ({ ...prev, arbitrage: sorted }))
        setLastUpdated(prev => ({ ...prev, arbitrage: new Date() }))
      } else if (result.error) {
        setError(prev => ({
          ...prev,
          arbitrage: result.error || 'Failed to fetch arbitrage data'
        }))
      }
    } catch (err) {
      setError(prev => ({ 
        ...prev, 
        arbitrage: err instanceof Error ? err.message : 'Connection failed' 
      }))
    } finally {
      setLoading(prev => ({ ...prev, arbitrage: false }))
    }
  }, [])

  const fetchIncome = useCallback(async () => {
    setLoading(prev => ({ ...prev, income: true }))
    setError(prev => ({ ...prev, income: null }))
    
    try {
      const res = await authFetch(`${API_BASE}/opportunities/income`)
      const result = await res.json()
      
      const incItems = result.data || result.opportunities
      if (incItems) {
        // Map backend fields to frontend fields (supports both transformed and raw formats)
        const mapped = incItems.map((item: Record<string, unknown>) => ({
          protocol: item.protocol || item.platform,
          asset: item.asset,
          apy: item.apy,
          tvl: item.tvl || 0,
          risk: item.risk || item.riskLevel,
          timestamp: item.timestamp || item.updatedAt,
        })) as IncomeOpportunity[]
        setData(prev => ({ ...prev, income: mapped }))
        setLastUpdated(prev => ({ ...prev, income: new Date() }))
      } else if (result.error) {
        // Keep static data on error, just log it
        setError(prev => ({
          ...prev,
          income: result.error || 'Failed to fetch income data'
        }))
      }
    } catch (err) {
      // Keep static data on error
      setError(prev => ({ 
        ...prev, 
        income: err instanceof Error ? err.message : 'Connection failed' 
      }))
    } finally {
      setLoading(prev => ({ ...prev, income: false }))
    }
  }, [])

  const refetch = useCallback(async () => {
    await Promise.all([fetchArbitrage(), fetchIncome()])
  }, [fetchArbitrage, fetchIncome])

  // Initial fetch and auto-refresh every 5 minutes
  useEffect(() => {
    fetchArbitrage()
    fetchIncome()

    // Set up auto-refresh interval (5 minutes)
    intervalRef.current = setInterval(() => {
      fetchArbitrage()
      fetchIncome()
    }, 5 * 60 * 1000)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [fetchArbitrage, fetchIncome])

  return {
    data,
    loading,
    error,
    lastUpdated,
    refetch,
  }
}
