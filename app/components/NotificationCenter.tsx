'use client';

import { useState, useEffect, useRef } from 'react';
import { Bell, X, Check, CheckCheck, AlertTriangle, TrendingUp, Target, Globe, Shield } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { useAuth } from './AuthProvider';

interface Notification {
  id: number;
  type: 'risk' | 'trade' | 'system' | 'market' | 'challenge';
  title: string;
  message: string;
  data?: any;
  read: boolean;
  createdAt: string;
}

export function NotificationCenter() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const wallet = user?.address ?? '';

  const loadNotifications = async () => {
    if (!wallet) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/notifications?limit=20&wallet=${encodeURIComponent(wallet)}`);
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (error) {
      console.error('Failed to load notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!wallet) return;
    loadNotifications();
    const interval = setInterval(loadNotifications, 10000);
    return () => clearInterval(interval);
  }, [wallet]);

  useEffect(() => {
    if (isOpen && wallet) loadNotifications();
  }, [isOpen, wallet]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Mark as read
  const markAsRead = async (notificationId: number) => {
    if (!wallet) return;
    try {
      const res = await fetch(`/api/notifications?wallet=${encodeURIComponent(wallet)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationIds: [notificationId] }),
      });

      if (res.ok) {
        setNotifications(prev =>
          prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  // Mark all as read
  const markAllAsRead = async () => {
    if (!wallet) return;
    try {
      const res = await fetch(`/api/notifications?wallet=${encodeURIComponent(wallet)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAllRead: true }),
      });

      if (res.ok) {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
        setUnreadCount(0);
        toast.success('All notifications marked as read');
      }
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  // Get icon for notification type
  const getIcon = (type: string) => {
    switch (type) {
      case 'risk':
        return <AlertTriangle className="w-4 h-4 text-[#ef4444]" />;
      case 'trade':
        return <TrendingUp className="w-4 h-4 text-[#10b981]" />;
      case 'challenge':
        return <Target className="w-4 h-4 text-[#4FFFC8]" />;
      case 'market':
        return <Globe className="w-4 h-4 text-[#3b82f6]" />;
      default:
        return <Bell className="w-4 h-4 text-slate-400" />;
    }
  };

  // Format time
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Icon */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg hover:bg-white/5 transition-colors"
      >
        <Bell className="w-5 h-5 text-slate-400" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 w-5 h-5 bg-[#ef4444] text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="absolute right-0 top-full mt-2 w-96 bg-[#050505] border border-white/10 rounded-2xl shadow-2xl z-50 max-h-[600px] flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/5">
              <h3 className="text-sm font-bold text-white">Notifications</h3>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="text-xs text-slate-400 hover:text-white transition-colors"
                  >
                    Mark all read
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1 rounded hover:bg-white/5 transition-colors"
                >
                  <X className="w-4 h-4 text-slate-400" />
                </button>
              </div>
            </div>

            {/* Notifications List */}
            <div className="overflow-y-auto flex-1">
              {loading ? (
                <div className="p-8 text-center text-slate-400">Loading...</div>
              ) : notifications.length === 0 ? (
                <div className="p-8 text-center text-slate-400">
                  <Bell className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No notifications</p>
                </div>
              ) : (
                <div className="divide-y divide-white/5">
                  {notifications.map((notification) => (
                    <motion.div
                      key={notification.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={`p-4 hover:bg-white/5 transition-colors cursor-pointer ${
                        !notification.read ? 'bg-white/5' : ''
                      }`}
                      onClick={() => !notification.read && markAsRead(notification.id)}
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5">{getIcon(notification.type)}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <p className={`text-sm font-semibold ${!notification.read ? 'text-white' : 'text-slate-300'}`}>
                                {notification.title}
                              </p>
                              <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                                {notification.message}
                              </p>
                              <p className="text-[10px] text-slate-500 mt-1">
                                {formatTime(notification.createdAt)}
                              </p>
                            </div>
                            {!notification.read && (
                              <div className="w-2 h-2 bg-[#4FFFC8] rounded-full flex-shrink-0 mt-1" />
                            )}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
