'use client';

import { motion } from 'framer-motion';
import { X, ExternalLink } from 'lucide-react';

export default function InAppWebModal({
  title,
  url,
  onClose,
}: {
  title: string;
  url: string;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.98 }}
        transition={{ duration: 0.2 }}
        className="w-full max-w-6xl h-[82vh] rounded-2xl border border-[#1A1A1A] bg-[#050505] overflow-hidden shadow-2xl flex flex-col"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#1A1A1A] bg-[#0a0a0a]">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm font-semibold text-white truncate">{title}</span>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-slate-500 hover:text-[#4FFFC8] inline-flex items-center gap-1.5"
              title="Open in new tab"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              External
            </a>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 bg-black">
          <iframe
            src={url}
            className="w-full h-full"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            referrerPolicy="no-referrer"
            title={title}
          />
        </div>
      </motion.div>
    </div>
  );
}

