import { ArbitrageSection } from './ArbitrageSection'
import { IncomeSection } from './IncomeSection'
import { Panel } from './Panel'
import { MetricInline } from './Metric'
import { useOpportunities } from '../hooks/useOpportunities'
import clsx from 'clsx'

export function OpportunitiesTab() {
  const { 
    data, 
    loading, 
    error, 
    lastUpdated, 
    refetch,
    executePaperTrade,
    paperTrades,
    paperPnl,
    loadingPaperTrades,
    refreshPaperTrades,
  } = useOpportunities()

  const openTrades = paperTrades.filter(t => t.status === 'open')
  const hasPaperTrades = paperTrades.length > 0

  return (
    <div className="grid grid-cols-1 gap-4 h-full">
      {/* Paper Trades Summary Panel */}
      {hasPaperTrades && (
        <div className="shrink-0">
          <Panel 
            title="PAPER TRADES"
            titleRight={
              <button
                onClick={refreshPaperTrades}
                disabled={loadingPaperTrades}
                className={clsx(
                  'hud-label hover:text-hud-cyan transition-colors disabled:opacity-50',
                  loadingPaperTrades && 'animate-pulse'
                )}
              >
                [REFRESH]
              </button>
            }
          >
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-2">
              <MetricInline
                label="ACTIVE TRADES"
                value={paperPnl?.openTrades ?? openTrades.length}
                color="default"
              />
              <MetricInline
                label="TOTAL P&L"
                value={paperPnl ? `$${paperPnl.totalPnl.toFixed(2)}` : '$0.00'}
                color={paperPnl && paperPnl.totalPnl >= 0 ? 'success' : 'error'}
              />
              <MetricInline
                label="WIN RATE"
                value={paperPnl ? `${paperPnl.winRate.toFixed(0)}%` : '0%'}
                color="default"
              />
              <MetricInline
                label="TOTAL TRADES"
                value={paperPnl?.totalTrades ?? paperTrades.length}
                color="default"
              />
            </div>
            {openTrades.length > 0 && (
              <div className="mt-2 pt-2 border-t border-hud-line/30 px-2">
                <div className="flex flex-wrap gap-2">
                  <span className="hud-label text-hud-text-dim">OPEN POSITIONS:</span>
                  {openTrades.slice(0, 3).map(trade => (
                    <span 
                      key={trade.id} 
                      className="text-[10px] px-2 py-0.5 bg-hud-cyan/10 border border-hud-cyan/30 text-hud-cyan"
                    >
                      {trade.marketName}
                    </span>
                  ))}
                  {openTrades.length > 3 && (
                    <span className="text-[10px] text-hud-text-dim">
                      +{openTrades.length - 3} more
                    </span>
                  )}
                </div>
              </div>
            )}
            <div className="mt-2 px-2 pb-1">
              <a 
                href="/paper-trades" 
                className="text-[10px] text-hud-cyan hover:text-hud-text-bright transition-colors hud-label"
              >
                [VIEW ALL TRADES →]
              </a>
            </div>
          </Panel>
        </div>
      )}

      {/* Top panel: Arbitrage Scanner */}
      <div className="flex-1 min-h-[300px]">
        <ArbitrageSection
          opportunities={data.arbitrage}
          loading={loading.arbitrage}
          error={error.arbitrage}
          lastUpdated={lastUpdated.arbitrage}
          onRefresh={refetch}
          onExecutePaperTrade={executePaperTrade}
          paperTrades={paperTrades}
        />
      </div>
      
      {/* Bottom panel: Passive Income Display */}
      <div className="flex-1 min-h-[200px]">
        <IncomeSection 
          opportunities={data.income}
          loading={loading.income}
          error={error.income}
          lastUpdated={lastUpdated.income}
          onRefresh={refetch}
        />
      </div>
    </div>
  )
}
