export interface ActivityEvent {
  id: string
  timestamp: string
  category: 'trading' | 'opportunities' | 'system'
  type: 'trade' | 'signal' | 'paper_trade' | 'arbitrage' | 'yield_alert' | 'scan' | 'error' | 'milestone'
  title: string
  description?: string
  metadata?: {
    symbol?: string
    market?: string
    profit?: number
    volume?: number
  }
  importance: 'low' | 'medium' | 'high'
}

export type ActivityFilter = 'all' | 'trading' | 'opportunities' | 'system'
export type TimeGroup = 'today' | 'yesterday' | 'thisWeek' | 'older'

export interface ActivityStats {
  totalEvents: number
  tradingEvents: number
  opportunitiesEvents: number
  systemEvents: number
  profitEvents: number
  lossEvents: number
}
