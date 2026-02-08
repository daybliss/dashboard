import { motion } from 'motion/react'
import clsx from 'clsx'
import { Panel } from './Panel'
import { MetricInline } from './Metric'
import type { ArbitrageOpportunity } from '../hooks/useOpportunities'

interface ArbitrageSectionProps {
  opportunities: ArbitrageOpportunity[]
  loading: boolean
  error: string | null
  lastUpdated: Date | null
  onRefresh: () => void
}

function formatPercent(value: number): string {
  const sign = value >= 0 ? '+' : ''
  return `${sign}${value.toFixed(2)}%`
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

function getProfitColor(percent: number): string {
  if (percent >= 5) return 'text-hud-success'
  if (percent >= 2) return 'text-hud-primary'
  if (percent > 0) return 'text-hud-warning'
  return 'text-hud-error'
}

export function ArbitrageSection({ 
  opportunities, 
  loading, 
  error, 
  lastUpdated, 
  onRefresh 
}: ArbitrageSectionProps) {
  return (
    <Panel 
      title="ARBITRAGE SCANNER" 
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
          No arbitrage opportunities found
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-hud-line/50">
                <th className="hud-label text-left py-2 px-2">Market</th>
                <th className="hud-label text-right py-2 px-2">YES Price</th>
                <th className="hud-label text-right py-2 px-2">NO Price</th>
                <th className="hud-label text-right py-2 px-2">Profit %</th>
                <th className="hud-label text-right py-2 px-2">Volume</th>
              </tr>
            </thead>
            <tbody>
              {loading && opportunities.length === 0 ? (
                // Loading skeleton rows
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-hud-line/20">
                    <td className="py-3 px-2">
                      <div className="h-3 bg-hud-line/30 rounded w-24 animate-pulse" />
                    </td>
                    <td className="py-3 px-2">
                      <div className="h-3 bg-hud-line/30 rounded w-16 ml-auto animate-pulse" />
                    </td>
                    <td className="py-3 px-2">
                      <div className="h-3 bg-hud-line/30 rounded w-16 ml-auto animate-pulse" />
                    </td>
                    <td className="py-3 px-2">
                      <div className="h-3 bg-hud-line/30 rounded w-12 ml-auto animate-pulse" />
                    </td>
                    <td className="py-3 px-2">
                      <div className="h-3 bg-hud-line/30 rounded w-20 ml-auto animate-pulse" />
                    </td>
                  </tr>
                ))
              ) : (
                opportunities.map((opp, i) => (
                  <motion.tr
                    key={opp.market}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="border-b border-hud-line/20 hover:bg-hud-line/10"
                  >
                    <td className="py-2 px-2">
                      <span className="hud-value-md text-hud-text-bright">{opp.market}</span>
                    </td>
                    <td className="py-2 px-2 text-right">
                      <span className="hud-value-md">${opp.yesPrice.toFixed(3)}</span>
                    </td>
                    <td className="py-2 px-2 text-right">
                      <span className="hud-value-md">${opp.noPrice.toFixed(3)}</span>
                    </td>
                    <td className="py-2 px-2 text-right">
                      <span className={clsx('hud-value-md font-medium', getProfitColor(opp.profitPercent))}>
                        {formatPercent(opp.profitPercent)}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-right">
                      <span className="hud-value-md text-hud-text-dim">
                        {formatCurrency(opp.volume)}
                      </span>
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
      
      {opportunities.length > 0 && (
        <div className="mt-3 pt-2 border-t border-hud-line/30">
          <MetricInline 
            label="OPPORTUNITIES FOUND" 
            value={opportunities.length.toString()}
            color="default"
          />
        </div>
      )}
    </Panel>
  )
}
