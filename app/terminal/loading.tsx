export default function TerminalLoading() {
  return (
    <div className="min-h-screen bg-[#050505]">
      {/* Header skeleton */}
      <div className="border-b border-[#1A1A1A] bg-[#080808]">
        <div className="max-w-[1800px] mx-auto px-4 sm:px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-[#4FFFC8]/30 animate-pulse" />
              <div className="h-4 w-48 bg-white/5 rounded animate-pulse" />
            </div>
            <div className="h-4 w-32 bg-white/5 rounded animate-pulse" />
          </div>
        </div>
      </div>
      {/* Stats bar skeleton */}
      <div className="border-b border-[#1A1A1A] bg-[#080808]">
        <div className="max-w-[1800px] mx-auto px-4 sm:px-6 py-2 flex items-center gap-4">
          <div className="h-6 w-20 bg-white/5 rounded animate-pulse" />
          <div className="h-6 w-20 bg-white/5 rounded animate-pulse" />
          <div className="flex-1" />
          <div className="h-6 w-32 bg-white/5 rounded animate-pulse" />
        </div>
      </div>
      {/* Tabs skeleton */}
      <div className="border-b border-[#1A1A1A]">
        <div className="max-w-[1800px] mx-auto px-4 sm:px-6 py-2 flex gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-8 w-28 bg-white/[0.03] rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
      {/* Trade feed skeleton */}
      <div className="max-w-[1800px] mx-auto px-4 sm:px-6 py-4 space-y-2">
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 px-4 py-3 bg-white/[0.02] rounded-lg border border-[#1A1A1A] animate-pulse"
            style={{ animationDelay: `${i * 50}ms` }}
          >
            <div className="w-14 h-5 bg-white/5 rounded-full" />
            <div className="w-20 h-5 bg-white/5 rounded" />
            <div className="w-24 h-4 bg-white/5 rounded" />
            <div className="flex-1 h-4 bg-white/5 rounded" />
            <div className="w-16 h-5 bg-white/5 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
