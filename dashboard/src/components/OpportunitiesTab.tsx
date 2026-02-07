import { ArbitrageSection } from './ArbitrageSection'
import { IncomeSection } from './IncomeSection'
import { useOpportunities } from '../hooks/useOpportunities'

export function OpportunitiesTab() {
  const { 
    data, 
    loading, 
    error, 
    lastUpdated, 
    refetch 
  } = useOpportunities()

  return (
    <div className="grid grid-cols-1 gap-4 h-full">
      {/* Top panel: Arbitrage Scanner */}
      <div className="flex-1 min-h-[300px]">
        <ArbitrageSection 
          opportunities={data.arbitrage}
          loading={loading.arbitrage}
          error={error.arbitrage}
          lastUpdated={lastUpdated.arbitrage}
          onRefresh={refetch}
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
