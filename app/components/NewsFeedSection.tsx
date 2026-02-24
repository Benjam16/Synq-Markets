'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ExternalLink, Clock } from 'lucide-react';

interface NewsItem {
  title: string;
  description?: string;
  source: string;
  url: string;
  publishedAt: string;
  imageUrl?: string;
}

export default function NewsFeedSection() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchNews = async () => {
      try {
        const res = await fetch('/api/news?limit=6');
        if (res.ok) {
          const data = await res.json();
          setNews(data.articles || []);
        } else {
          // Fallback to empty array if API fails
          setNews([]);
        }
      } catch (error) {
        console.error('Failed to fetch news:', error);
        setNews([]);
      } finally {
        setLoading(false);
      }
    };

    fetchNews();
    // Refresh every 5 minutes
    const interval = setInterval(fetchNews, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  return (
    <section className="py-24 bg-[#0f172a] border-t border-slate-800">
      <div className="max-w-7xl mx-auto px-8">
        <h2 className="text-3xl font-bold text-[#e2e8f0] mb-16">Market Intelligence</h2>
        
        {loading ? (
          <div className="grid gap-8 grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-48 bg-[#1e293b] rounded-lg animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid gap-8 grid-cols-3">
            {news.map((item, idx) => (
              <motion.a
                key={idx}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block p-6 bg-transparent rounded-lg border-b border-slate-800 hover:shadow-lg hover:-translate-y-1 transition-all duration-200 group"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
              >
                <div className="flex items-start justify-between mb-3">
                  <span className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold">{item.source}</span>
                  <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-[#3b82f6] transition-colors opacity-0 group-hover:opacity-100" />
                </div>
                <h3 className="text-lg font-semibold text-[#e2e8f0] mb-4 leading-relaxed group-hover:text-[#3b82f6] transition-colors">
                  {item.title}
                </h3>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <Clock className="w-3 h-3" />
                  <span>{formatTime(item.publishedAt)}</span>
                </div>
              </motion.a>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

