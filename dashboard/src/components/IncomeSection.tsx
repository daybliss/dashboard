import { motion } from 'motion/react'
import clsx from 'clsx'
import { Panel } from './Panel'
import { Metric, MetricInline } from './Metric'
import type { IncomeOpportunity } from '../hooks/useOpportunities'

interface IncomeSectionProps {
  opportunities: IncomeOpportunity[]
  loading: boolean
  error: string | null
  lastUpdated: Date | null
  onRefresh: () => void
}

function formatPercent(value: number): string {
  return `${value.toFixed(2)}%`
}

function formatCurrency(amount: number): string {
  if (amount >= 1000000) {
    return `$${(amount / 1000000).toFixed(2)}M`
  }
  if (amount >= 1000) {
    return `$${(amount / 1000).toFixed(1)}k`
  }
  return `$${amount.toFixed(2)}`
}

function getRiskColor(risk: 'low' | 'medium' | 'high'): string {
  switch (risk) {
    case 'low': return 'text-hud-success'
    case 'medium': return 'text-hud-warning'
    case 'high': return 'text-hud-error'
    default: return 'text-hud-text-dim'
  }
}

function getRiskBgColor(risk: 'low' | 'medium' | 'high'): string {
  switch (risk) {
    case 'low': return 'bg-hud-success/10 border-hud-success/30'
    case 'medium': return 'bg-hud-warning/10 border-hud-warning/30'
    case 'high': return 'bg-hud-error/10 border-hud-error/30'
    default: return 'bg-hud-line/10 border-hud-line/30'
  }
}

export function IncomeSection({ 
  opportunities, 
  loading, 
  error, 
  lastUpdated, 
  onRefresh 
}: IncomeSectionProps) {
  return (
    <Panel 
      title="PASSIVE INCOME" 
      titleRight={
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="hud-label text-hud-text-dim">
              UPDATED {lastUpdated.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button
            onClick={onRefresh}
            disabled={loading}
            className={clsx(
              'hud-label hover:text-hud-primary transition-colors disabled:opacity-50',
              loading && 'animate-pulse'
            )}
          >
            [REFRESH]
          </button>
        </div>
      }
      className="h-full"
    >
      {error ? (
        <div className="text-hud-error text-sm py-8 text-center">
          {error}
        </div>
      ) : opportunities.length === 0 && !loading ? (
        <div className="text-hud-text-dim text-sm py-8 text-center">
          No income opportunities found
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {loading && opportunities.length === 0 ? (
            // Loading skeleton cards
            Array.from({ length: 2 }).map((_, i) => (
              <div 
                key={i} 
                className="hud-panel p-4 border border-hud-line/30"
              >
                <div className="h-4 bg-hud-line/30 rounded w-20 mb-4 animate-pulse" />
                <div className="h-8 bg-hud-line/30 rounded w-32 mb-2 animate-pulse" />
                <div className="h-3 bg-hud-line/30 rounded w-24 animate-pulse" />
              </div>
            ))
          ) : (
            opportunities.map((opp, i) => (
              <motion.div
                key={`${opp.protocol}-${opp.asset}`}
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.1 }}
                className={clsx(
                  'hud-panel p-4 border transition-all hover:border-hud-primary/50',
                  getRiskBgColor(opp.risk)
                )}
              >
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <span className="hud-label block mb-1">PROTOCOL</span>
                    <span className="hud-value-md text-hud-text-bright">{opp.protocol}</span>
                  </div>
                  <span className={clsx('hud-label px-2 py-1 rounded border', getRiskBgColor(opp.risk), getRiskColor(opp.risk))}>
                    {opp.risk.toUpperCase()} RISK
                  </span>
                </div>
                
                <div className="mb-3">
                  <Metric 
                    label="APY" 
                    value={formatPercent(opp.apy)} 
                    size="xl" 
                    color="success"
                  />
                </div>
                
                <div className="pt-3 border-t border-hud-line/30 space-y-2">
                  <MetricInline 
                    label="ASSET" 
                    value={opp.asset}
                    color="default"
                  />
                  {opp.tvl > 0 && (
                    <MetricInline 
                      label="TVL" 
                      value={formatCurrency(opp.tvl)}
                      color="default"
                    />
                  )}
                </div>
              </motion.div>
            ))
          )}
        </div>
      )}
    </Panel>
  )
}
