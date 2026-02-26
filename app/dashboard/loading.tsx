export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-[#050505]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 pb-8">
        {/* Header */}
        <div className="h-8 w-40 bg-white/5 rounded animate-pulse mb-6" />
        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white/[0.02] border border-[#1A1A1A] rounded-xl p-4 animate-pulse">
              <div className="h-3 w-20 bg-white/5 rounded mb-2" />
              <div className="h-7 w-24 bg-white/5 rounded" />
            </div>
          ))}
        </div>
        {/* Chart placeholder */}
        <div className="bg-white/[0.02] border border-[#1A1A1A] rounded-xl p-4 mb-6 animate-pulse">
          <div className="h-4 w-32 bg-white/5 rounded mb-4" />
          <div className="h-48 bg-white/[0.02] rounded-lg" />
        </div>
        {/* Positions */}
        <div className="bg-white/[0.02] border border-[#1A1A1A] rounded-xl p-4 animate-pulse">
          <div className="h-4 w-36 bg-white/5 rounded mb-4" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 py-3 border-b border-[#1A1A1A]">
              <div className="w-8 h-8 bg-white/5 rounded-lg" />
              <div className="flex-1 h-4 bg-white/5 rounded" />
              <div className="w-16 h-5 bg-white/5 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
