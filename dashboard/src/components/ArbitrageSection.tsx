import { motion } from 'motion/react'
import clsx from 'clsx'
import { useState, useCallback } from 'react'
import { Panel } from './Panel'
import { MetricInline } from './Metric'
import type { ArbitrageOpportunity, PaperTrade } from '../hooks/useOpportunities'

type ButtonState = 'idle' | 'loading' | 'success' | 'error'

interface ArbitrageSectionProps {
  opportunities: ArbitrageOpportunity[]
  loading: boolean
  error: string | null
  lastUpdated: Date | null
  onRefresh: () => void
  onExecutePaperTrade?: (opp: ArbitrageOpportunity) => Promise<{ success: boolean; trade?: PaperTrade; error?: string }>
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

// Paper Trade Button Component
interface PaperTradeButtonProps {
  opportunity: ArbitrageOpportunity
  onExecute: (opp: ArbitrageOpportunity) => Promise<{ success: boolean; trade?: PaperTrade; error?: string }>
}

function PaperTradeButton({ opportunity, onExecute }: PaperTradeButtonProps) {
  const [state, setState] = useState<ButtonState>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const handleClick = useCallback(async () => {
    if (state === 'loading' || state === 'success') return
    
    setState('loading')
    setErrorMsg(null)
    
    try {
      const result = await onExecute(opportunity)
      if (result.success) {
        setState('success')
        // Reset to idle after 2 seconds
        setTimeout(() => setState('idle'), 2000)
      } else {
        setState('error')
        setErrorMsg(result.error || 'Failed')
        // Reset to idle after 3 seconds
        setTimeout(() => {
          setState('idle')
          setErrorMsg(null)
        }, 3000)
      }
    } catch {
      setState('error')
      setErrorMsg('Error')
      setTimeout(() => {
        setState('idle')
        setErrorMsg(null)
      }, 3000)
    }
  }, [opportunity, onExecute, state])

  const buttonContent = () => {
    switch (state) {
      case 'loading':
        return (
          <span className="flex items-center gap-1">
            <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span className="text-[9px]">...</span>
          </span>
        )
      case 'success':
        return (
          <span className="flex items-center gap-1 text-hud-success">
            <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            <span className="text-[9px]">DONE</span>
          </span>
        )
      case 'error':
        return (
          <span className="text-hud-error text-[9px]">
            {errorMsg || 'ERR'}
          </span>
        )
      default:
        return (
          <span className="flex flex-col items-end">
            <span className="text-[9px] text-hud-cyan">PAPER TRADE</span>
            <span className="text-[8px] text-hud-text-dim">$5 → +${((1 - (opportunity.yesPrice + opportunity.noPrice)) * 5).toFixed(2)}</span>
          </span>
        )
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={state === 'loading' || state === 'success'}
      className={clsx(
        'px-2 py-1 border transition-all duration-200 text-right min-w-[80px]',
        state === 'success' && 'border-hud-success/50 bg-hud-success/10',
        state === 'error' && 'border-hud-error/50 bg-hud-error/10',
        state === 'idle' && 'border-hud-cyan/30 hover:border-hud-cyan hover:bg-hud-cyan/10',
        state === 'loading' && 'border-hud-cyan/30 opacity-70',
        (state === 'loading' || state === 'success') && 'cursor-not-allowed'
      )}
    >
      {buttonContent()}
    </button>
  )
}

export function ArbitrageSection({ 
  opportunities, 
  loading, 
  error, 
  lastUpdated, 
  onRefresh,
  onExecutePaperTrade,
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
                {onExecutePaperTrade && (
                  <th className="hud-label text-right py-2 px-2">Action</th>
                )}
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
                    {onExecutePaperTrade && (
                      <td className="py-3 px-2">
                        <div className="h-6 bg-hud-line/30 rounded w-20 ml-auto animate-pulse" />
                      </td>
                    )}
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
                    {onExecutePaperTrade && (
                      <td className="py-2 px-2 text-right">
                        <PaperTradeButton
                          opportunity={opp}
                          onExecute={onExecutePaperTrade}
                        />
                      </td>
                    )}
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
