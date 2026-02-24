"use client";

interface NewsItem {
  id: string;
  title: string;
  source: string;
  timestamp: string;
  url?: string;
}

interface NewsFeedProps {
  marketId?: string;
  news?: NewsItem[];
}

export default function NewsFeed({ marketId, news = [] }: NewsFeedProps) {
  // Mock news data - in production, this would come from an API
  const mockNews: NewsItem[] = news.length > 0 ? news : [
    {
      id: "1",
      title: "Fed signals potential rate cuts in Q2",
      source: "Bloomberg",
      timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    },
    {
      id: "2",
      title: "Latest polls show tightening race",
      source: "Reuters",
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: "3",
      title: "CPI data release scheduled for next week",
      source: "WSJ",
      timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    },
  ];

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  return (
    <div className="bg-[#0f172a] rounded-lg border border-[#1e293b] p-4">
      <h3 className="text-lg font-bold text-[#e2e8f0] mb-3">Market Intelligence</h3>
      <div className="space-y-3 max-h-64 overflow-y-auto">
        {mockNews.map((item) => (
          <div
            key={item.id}
            className="p-3 bg-[#1e293b] rounded-lg border border-[#334155] hover:border-[#3b82f6] transition-colors cursor-pointer"
            onClick={() => item.url && window.open(item.url, "_blank")}
          >
            <div className="text-sm font-semibold text-[#e2e8f0] mb-1 line-clamp-2">
              {item.title}
            </div>
            <div className="flex items-center justify-between text-xs text-[#64748b]">
              <span>{item.source}</span>
              <span>{formatTime(item.timestamp)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

