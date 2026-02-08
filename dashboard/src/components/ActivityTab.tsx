import { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import clsx from 'clsx'
import { Panel } from './Panel'
import { useActivity } from '../hooks/useActivity'
import type { ActivityEvent, ActivityFilter } from '../types/activity'

// Icon components for each event type
function TradeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
      <circle cx="10" cy="10" r="8" />
    </svg>
  )
}

function SignalIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
      <path d="M10 2L2 18h16L10 2z" />
    </svg>
  )
}

function ArbitrageIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
      <polygon points="10,2 18,18 2,18" />
    </svg>
  )
}

function ScanIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
      <rect x="2" y="2" width="16" height="16" rx="2" />
    </svg>
  )
}

function WarningIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
      <path d="M10 2L2 16h16L10 2zm0 12a1 1 0 110 2 1 1 0 010-2zm0-8v5h2V6h-2z" />
    </svg>
  )
}

function MilestoneIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
      <circle cx="10" cy="10" r="6" />
      <circle cx="10" cy="10" r="3" fill="currentColor" />
    </svg>
  )
}

function PaperTradeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
      <rect x="3" y="3" width="14" height="14" rx="2" />
      <path d="M7 10l2 2 4-4" stroke="currentColor" strokeWidth="2" fill="none" />
    </svg>
  )
}

function YieldIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
      <path d="M10 2v16M2 10h16" stroke="currentColor" strokeWidth="2" />
    </svg>
  )
}

// Get icon component based on event type
function getEventIcon(type: ActivityEvent['type']) {
  switch (type) {
    case 'trade':
      return TradeIcon
    case 'signal':
      return SignalIcon
    case 'arbitrage':
      return ArbitrageIcon
    case 'scan':
      return ScanIcon
    case 'error':
      return WarningIcon
    case 'milestone':
      return MilestoneIcon
    case 'paper_trade':
      return PaperTradeIcon
    case 'yield_alert':
      return YieldIcon
    default:
      return ScanIcon
  }
}

// Get color based on event type and metadata
function getEventColor(event: ActivityEvent): string {
  // Profit-related events
  if (event.metadata?.profit !== undefined) {
    return event.metadata.profit >= 0 ? 'text-hud-success' : 'text-hud-error'
  }
  
  switch (event.type) {
    case 'trade':
    case 'paper_trade':
      return 'text-hud-success'
    case 'signal':
      return 'text-hud-cyan'
    case 'arbitrage':
      return 'text-hud-warning'
    case 'yield_alert':
      return 'text-hud-purple'
    case 'scan':
      return 'text-hud-blue'
    case 'error':
      return 'text-hud-error'
    case 'milestone':
      return 'text-hud-yellow'
    default:
      return 'text-hud-text'
  }
}

// Get background color for icon
function getIconBgColor(event: ActivityEvent): string {
  if (event.metadata?.profit !== undefined) {
    return event.metadata.profit >= 0 ? 'bg-hud-success/10' : 'bg-hud-error/10'
  }
  
  switch (event.type) {
    case 'trade':
    case 'paper_trade':
      return 'bg-hud-success/10'
    case 'signal':
      return 'bg-hud-cyan/10'
    case 'arbitrage':
      return 'bg-hud-warning/10'
    case 'yield_alert':
      return 'bg-hud-purple/10'
    case 'scan':
      return 'bg-hud-blue/10'
    case 'error':
      return 'bg-hud-error/10'
    case 'milestone':
      return 'bg-hud-yellow/10'
    default:
      return 'bg-hud-dim/10'
  }
}

// Format timestamp to time string
function formatTime(timestamp: string): string {
  return new Date(timestamp).toLocaleTimeString('en-US', { 
    hour12: false, 
    hour: '2-digit', 
    minute: '2-digit' 
  })
}

// Format currency
function formatCurrency(amount: number): string {
  if (Math.abs(amount) >= 1000) {
    return `$${(amount / 1000).toFixed(1)}k`
  }
  return `$${amount.toFixed(2)}`
}

// Event row component
function EventRow({ event, index }: { event: ActivityEvent; index: number }) {
  const Icon = getEventIcon(event.type)
  const colorClass = getEventColor(event)
  const bgClass = getIconBgColor(event)
  
  const hasProfit = event.metadata?.profit !== undefined
  const isProfit = hasProfit && (event.metadata?.profit ?? 0) >= 0

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05, duration: 0.2 }}
      className={clsx(
        'flex items-start gap-3 py-2 px-2 border-b border-hud-line/10',
        'hover:bg-hud-line/5 transition-colors cursor-pointer group'
      )}
    >
      {/* Icon */}
      <div className={clsx('shrink-0 w-6 h-6 rounded flex items-center justify-center', bgClass)}>
        <Icon className={clsx('w-3.5 h-3.5', colorClass)} />
      </div>
      
      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-hud-text-dim text-[10px] font-mono">
            {formatTime(event.timestamp)}
          </span>
          <span className="hud-value-sm text-hud-text-bright">
            {event.title}
          </span>
        </div>
        
        <div className="flex items-start justify-between gap-2 mt-0.5">
          <p className="text-[10px] text-hud-text-dim leading-tight flex-1">
            {event.description}
          </p>
          
          {/* Metadata display */}
          {hasProfit && (
            <span className={clsx(
              'text-[10px] font-mono shrink-0',
              isProfit ? 'text-hud-success' : 'text-hud-error'
            )}>
              {isProfit ? '+' : ''}{formatCurrency(event.metadata!.profit!)}
            </span>
          )}
          
          {event.metadata?.symbol && !hasProfit && (
            <span className="text-[10px] font-mono text-hud-cyan shrink-0">
              {event.metadata.symbol}
            </span>
          )}
          
          {event.metadata?.market && !hasProfit && !event.metadata.symbol && (
            <span className="text-[10px] font-mono text-hud-text-dim shrink-0">
              {event.metadata.market}
            </span>
          )}
        </div>
      </div>
      
      {/* Importance indicator */}
      {event.importance === 'high' && (
        <div className="shrink-0 w-1.5 h-1.5 rounded-full bg-hud-warning mt-1.5" />
      )}
    </motion.div>
  )
}

// Time group section
function TimeGroupSection({ 
  title, 
  events, 
  startIndex 
}: { 
  title: string; 
  events: ActivityEvent[]
  startIndex: number
}) {
  if (events.length === 0) return null

  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 px-2 py-1.5 border-b border-hud-line/20">
        <span className="hud-label text-hud-text-dim">{title}</span>
        <span className="text-[9px] text-hud-dim bg-hud-line/20 px-1.5 rounded">
          {events.length}
        </span>
      </div>
      <div className="space-y-0">
        {events.map((event, i) => (
          <EventRow key={event.id} event={event} index={startIndex + i} />
        ))}
      </div>
    </div>
  )
}

// Filter tab button
function FilterTab({ 
  label, 
  count, 
  active, 
  onClick 
}: { 
  label: string
  count: number
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'px-3 py-1.5 text-[10px] uppercase tracking-wider transition-all relative',
        'border border-hud-line/30 hover:border-hud-line/60',
        active 
          ? 'bg-hud-cyan/10 border-hud-cyan/50 text-hud-cyan' 
          : 'text-hud-text-dim hover:text-hud-text'
      )}
    >
      <span>{label}</span>
      {count > 0 && (
        <span className={clsx(
          'ml-1.5 text-[9px] px-1 rounded',
          active ? 'bg-hud-cyan/20' : 'bg-hud-line/20'
        )}>
          {count}
        </span>
      )}
    </button>
  )
}

// Empty state component
function EmptyState({ filter }: { filter: ActivityFilter }) {
  const messages: Record<ActivityFilter, string> = {
    all: 'No activity recorded yet. Events will appear here as the system runs.',
    trading: 'No trading activity yet. Signals and trades will appear here.',
    opportunities: 'No opportunities found yet. Arbitrage and yield alerts will appear here.',
    system: 'No system events yet. Scans and milestones will appear here.',
  }

  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="w-12 h-12 rounded-full bg-hud-line/10 flex items-center justify-center mb-3">
        <ScanIcon className="w-5 h-5 text-hud-dim" />
      </div>
      <p className="text-hud-text-dim text-xs max-w-[200px]">{messages[filter]}</p>
    </div>
  )
}

// Main Activity Tab component
export function ActivityTab() {
  const {
    groupedEvents,
    filter,
    setFilter,
    loading,
    error,
    lastUpdated,
    isLive,
    refresh,
  } = useActivity()

  const [isRefreshing, setIsRefreshing] = useState(false)

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await refresh()
    setTimeout(() => setIsRefreshing(false), 500)
  }

  const filters: { id: ActivityFilter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'trading', label: 'Trading' },
    { id: 'opportunities', label: 'Opportunities' },
    { id: 'system', label: 'System' },
  ]

  const totalEvents = 
    groupedEvents.today.length + 
    groupedEvents.yesterday.length + 
    groupedEvents.thisWeek.length + 
    groupedEvents.older.length

  let eventIndex = 0

  return (
    <div className="h-full flex flex-col">
      {/* Header with filters */}
      <Panel 
        title="ACTIVITY FEED" 
        titleRight={
          <div className="flex items-center gap-3">
            {/* Live indicator */}
            {isLive && (
              <span className="flex items-center gap-1.5 text-[9px] text-hud-success">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-hud-success opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-hud-success" />
                </span>
                LIVE
              </span>
            )}
            
            {/* Last updated */}
            {lastUpdated && (
              <span className="text-[9px] text-hud-text-dim hidden sm:inline">
                {lastUpdated.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
            
            {/* Refresh button */}
            <button
              onClick={handleRefresh}
              disabled={loading || isRefreshing}
              className={clsx(
                'text-[10px] text-hud-cyan hover:text-hud-text-bright transition-colors',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                (loading || isRefreshing) && 'animate-pulse'
              )}
              title="Refresh activity feed"
            >
              <svg 
                className={clsx('w-4 h-4', isRefreshing && 'animate-spin')} 
                viewBox="0 0 20 20" 
                fill="none" 
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path d="M4 10a6 6 0 0112 0M16 10l-2-2m2 2l-2 2M16 10h-2" />
              </svg>
            </button>
          </div>
        }
        className="mb-3"
      >
        {/* Filter tabs */}
        <div className="flex flex-wrap gap-2 p-2">
          {filters.map(({ id, label }) => (
            <FilterTab
              key={id}
              label={label}
              count={
                id === 'all' 
                  ? totalEvents 
                  : Object.values(groupedEvents).flat().filter(e => e.category === id).length
              }
              active={filter === id}
              onClick={() => setFilter(id)}
            />
          ))}
        </div>
      </Panel>

      {/* Activity feed */}
      <Panel className="flex-1 min-h-0">
        {loading && totalEvents === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="flex flex-col items-center gap-2">
              <div className="w-6 h-6 border-2 border-hud-cyan/30 border-t-hud-cyan rounded-full animate-spin" />
              <span className="text-[10px] text-hud-text-dim">Loading activity...</span>
            </div>
          </div>
        ) : error ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <div className="text-hud-error text-sm mb-2">⚠ Error</div>
              <p className="text-hud-text-dim text-xs">{error}</p>
              <button 
                onClick={handleRefresh}
                className="mt-3 text-[10px] text-hud-cyan hover:text-hud-text-bright"
              >
                [Retry]
              </button>
            </div>
          </div>
        ) : totalEvents === 0 ? (
          <EmptyState filter={filter} />
        ) : (
          <div className="h-full overflow-y-auto p-1">
            <AnimatePresence mode="wait">
              <motion.div
                key={filter}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <TimeGroupSection
                  title="TODAY"
                  events={groupedEvents.today}
                  startIndex={eventIndex}
                />
                {eventIndex += groupedEvents.today.length}
                
                <TimeGroupSection
                  title="YESTERDAY"
                  events={groupedEvents.yesterday}
                  startIndex={eventIndex}
                />
                {eventIndex += groupedEvents.yesterday.length}
                
                <TimeGroupSection
                  title="THIS WEEK"
                  events={groupedEvents.thisWeek}
                  startIndex={eventIndex}
                />
                {eventIndex += groupedEvents.thisWeek.length}
                
                <TimeGroupSection
                  title="OLDER"
                  events={groupedEvents.older}
                  startIndex={eventIndex}
                />
              </motion.div>
            </AnimatePresence>
            
            {/* Footer with event count */}
            <div className="sticky bottom-0 bg-hud-bg-panel border-t border-hud-line/20 px-2 py-1.5 mt-2">
              <span className="text-[9px] text-hud-text-dim">
                Showing {totalEvents} events
                {filter !== 'all' && ` for ${filter}`}
              </span>
            </div>
          </div>
        )}
      </Panel>
    </div>
  )
}
