"use client";

interface DrawdownBarProps {
  currentDrawdown: number; // e.g., -3.5 means -3.5%
  maxDrawdown: number; // e.g., 10 means 10% total
  dailyMaxDrawdown: number; // e.g., 5 means 5% daily
  startBalance: number;
  currentEquity: number;
}

export default function DrawdownBar({
  currentDrawdown,
  maxDrawdown,
  dailyMaxDrawdown,
  startBalance,
  currentEquity,
}: DrawdownBarProps) {
  // Calculate total drawdown from start
  const totalDrawdownPct = ((currentEquity - startBalance) / startBalance) * 100;
  const totalDrawdownUsed = Math.abs(Math.min(0, totalDrawdownPct)) / maxDrawdown;
  const dailyDrawdownUsed = Math.abs(Math.min(0, currentDrawdown)) / dailyMaxDrawdown;

  // Determine color based on drawdown level
  const getColor = (used: number) => {
    if (used >= 0.9) return "bg-[#ef4444] pulse-subtle";
    if (used >= 0.7) return "bg-[#f59e0b]";
    if (used >= 0.5) return "bg-[#eab308]";
    if (used >= 0.3) return "bg-[#84cc16]";
    return "bg-[#10b981]";
  };

  const getTextColor = (used: number) => {
    if (used >= 0.9) return "text-[#fca5a5]";
    if (used >= 0.7) return "text-[#fbbf24]";
    if (used >= 0.5) return "text-[#fde047]";
    if (used >= 0.3) return "text-[#bef264]";
    return "text-[#34d399]";
  };

  const totalUsed = Math.min(1, totalDrawdownUsed);
  const dailyUsed = Math.min(1, dailyDrawdownUsed);

  const HealthBar = ({ 
    label, 
    value, 
    used, 
    max, 
    currentPct 
  }: { 
    label: string; 
    value: string; 
    used: number; 
    max: number; 
    currentPct: number;
  }) => {
    const fillWidth = Math.min(100, used * 100);
    const failZoneStart = 99; // Last 1% is the fail zone
    const fiftyPercentMark = 50;

    return (
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-[#94a3b8]">{label}</span>
          <span className={`text-sm font-bold ${getTextColor(used)}`}>
            {value} / {max}%
          </span>
        </div>
        <div className="relative h-4 bg-white/5 rounded-full overflow-hidden">
          {/* Fail Zone - Last 1% */}
          <div 
            className="absolute right-0 top-0 bottom-0 bg-red-500/20"
            style={{ width: '1%' }}
          />
          
          {/* 50% Marker */}
          <div 
            className="absolute top-0 bottom-0 w-px bg-white/20"
            style={{ left: '50%' }}
          />
          
          {/* Progress Fill */}
          <div
            className={`h-full transition-all duration-300 ${getColor(used)}`}
            style={{ width: `${fillWidth}%` }}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Total Drawdown Bar */}
      <HealthBar
        label="Total Drawdown"
        value={totalDrawdownPct.toFixed(2)}
        used={totalUsed}
        max={maxDrawdown}
        currentPct={totalDrawdownPct}
      />

      {/* Daily Drawdown Bar */}
      <HealthBar
        label="Daily Drawdown"
        value={currentDrawdown.toFixed(2)}
        used={dailyUsed}
        max={dailyMaxDrawdown}
        currentPct={currentDrawdown}
      />
    </div>
  );
}

