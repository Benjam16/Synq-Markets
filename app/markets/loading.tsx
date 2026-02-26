export default function MarketsLoading() {
  return (
    <div className="min-h-screen bg-[#050505]">
      {/* Header skeleton */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 pb-4">
        <div className="h-8 w-48 bg-white/5 rounded animate-pulse mb-4" />
        <div className="flex gap-2">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="h-9 w-24 bg-white/[0.03] rounded-full animate-pulse" />
          ))}
        </div>
      </div>
      {/* Market cards skeleton */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 9 }).map((_, i) => (
            <div
              key={i}
              className="bg-white/[0.02] border border-[#1A1A1A] rounded-xl p-4 animate-pulse"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-white/5 rounded-xl" />
                <div className="flex-1">
                  <div className="h-4 w-3/4 bg-white/5 rounded mb-2" />
                  <div className="h-3 w-1/2 bg-white/5 rounded" />
                </div>
              </div>
              <div className="flex items-center justify-between mt-4">
                <div className="h-8 w-20 bg-[#4FFFC8]/10 rounded-lg" />
                <div className="h-8 w-20 bg-red-500/10 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
