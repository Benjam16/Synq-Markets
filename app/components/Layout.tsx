"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, Briefcase, AlertTriangle, TrendingUp, LogOut, Home, Menu, X, User, Trophy, Archive, BarChart3, Shield, Target, Monitor } from "lucide-react";
import { useAuth } from "./AuthProvider";
import { useState, useEffect, useCallback } from "react";
import { NotificationCenter } from "./NotificationCenter";

export default function Layout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  
  // Track navigation by watching pathname changes
  useEffect(() => {
    setIsNavigating(true);
    const timer = setTimeout(() => setIsNavigating(false), 300); // Hide after 300ms
    return () => clearTimeout(timer);
  }, [pathname]);

  // Background prefetch: warm up caches and prefetch heavy routes
  useEffect(() => {
    const prefetchTimer = setTimeout(() => {
      fetch('/api/markets/trending?limit=9', { priority: 'low' as any }).catch(() => {});
      // Prefetch heavy page bundles in background
      router.prefetch('/markets');
      router.prefetch('/terminal');
      router.prefetch('/dashboard');
    }, 1500);
    return () => clearTimeout(prefetchTimer);
  }, [router]);

  // Check admin status
  useEffect(() => {
    if (user) {
      // Include email in query for fallback check (case-insensitive)
      const email = user.email || '';
      fetch(`/api/admin/check?email=${encodeURIComponent(email)}`)
        .then((res) => res.json())
        .then((data) => {
          console.log('[Layout] Admin check result:', data);
          const isAdminUser = data.isAdmin === true;
          setIsAdmin(isAdminUser);
          
          // If admin check passes, log it for debugging
          if (isAdminUser) {
            console.log('[Layout] ✅ Admin access granted:', data);
          }
        })
        .catch((error) => {
          console.error('[Layout] Admin check error:', error);
          setIsAdmin(false);
        });
    } else {
      setIsAdmin(false);
    }
  }, [user]);

  // Primary navigation (Center) - Core trading links
  const primaryNavItems = [
    { href: "/markets", label: "Markets", icon: BarChart3 },
    { href: "/terminal", label: "Terminal", icon: Monitor },
    { href: "/leaderboard", label: "Leaderboard", icon: Trophy },
  ];

  // Secondary navigation (Right) - Management links
  const secondaryNavItems = [];

  // All nav items for mobile menu
  const allNavItems = [
    { href: "/", label: "Home", icon: Home },
    ...primaryNavItems,
    ...secondaryNavItems,
    ...(isAdmin ? [{ href: "/admin", label: "Admin", icon: AlertTriangle, isAdmin: true }] : []),
  ];

  const handleSignOut = useCallback(async () => {
    await signOut();
    router.push("/");
  }, [signOut, router]);


  // Don't show sidebar on landing/login pages
  if (pathname === '/' || pathname === '/login') {
    return <>{children}</>;
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#050505]">
      {/* Navigation Loading Indicator */}
      {isNavigating && (
        <div className="fixed top-0 left-0 right-0 h-0.5 bg-[#121212] z-[100]">
          <div className="h-full bg-[#4FFFC8] animate-pulse" style={{ width: '30%', transition: 'width 0.3s ease' }} />
        </div>
      )}
      {/* Top Navigation Bar - Predexon Style */}
      <header className="hidden lg:block fixed top-0 left-0 right-0 z-50 h-16 bg-[#050505]/95 backdrop-blur-md border-b border-[#1A1A1A]">
        <div className="w-full h-full px-6">
          <div className="relative flex items-center justify-between h-full">
            {/* Left: Logo and Brand Name */}
            <div className="flex-shrink-0 z-10">
              <Link href="/" className="flex items-center gap-3 group">
                <div className="w-9 h-9 bg-[#4FFFC8] rounded-full flex items-center justify-center group-hover:scale-105 transition-transform shadow-[0_0_20px_rgba(79,255,200,0.3)]">
                  <TrendingUp className="w-5 h-5 text-black" strokeWidth={1.5} />
                </div>
                <div className="text-xl font-bold text-white tracking-tight">Prop Market</div>
              </Link>
            </div>

            {/* Center: All Navigation Links - Absolutely centered in viewport */}
            <div className="hidden lg:flex absolute inset-0 items-center justify-center pointer-events-none">
              <div className="flex items-center gap-2 xl:gap-3 pointer-events-auto">
                {/* Primary Navigation Links */}
                {primaryNavItems.map((item) => {
                  const isActive = pathname === item.href;
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      prefetch={true}
                      className="relative flex items-center gap-1 transition-all group whitespace-nowrap"
                    >
                      <Icon className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={1.5} />
                      <span className={`text-[10px] font-bold uppercase tracking-[0.08em] transition-colors ${
                        isActive ? "text-white" : "text-slate-500 group-hover:text-white"
                      }`}>
                        {item.label}
                      </span>
                      {isActive && (
                        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#4FFFC8]" />
                      )}
                    </Link>
                  );
                })}
                
                {/* Separator */}
                <div className="w-px h-4 bg-[#1A1A1A] mx-1" />
                
                {/* Secondary Navigation Links */}
                {secondaryNavItems.map((item) => {
                  const isActive = pathname === item.href;
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      prefetch={true}
                      className="relative flex items-center gap-1 transition-all group whitespace-nowrap"
                    >
                      <Icon className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={1.5} />
                      <span className={`text-[10px] font-bold uppercase tracking-[0.08em] transition-colors ${
                        isActive ? "text-white" : "text-slate-500 group-hover:text-white"
                      }`}>
                        {item.label}
                      </span>
                      {isActive && (
                        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#4FFFC8]" />
                      )}
                    </Link>
                  );
                })}
                
                {/* Admin Link - Special Styling */}
                {isAdmin && (
                  <Link
                    href="/admin"
                    prefetch={true}
                    className={`relative flex items-center gap-1.5 px-3 py-1 rounded-md border border-white/10 transition-all group whitespace-nowrap ${
                      pathname === "/admin" ? "text-white" : "text-slate-500 group-hover:text-white"
                    }`}
                  >
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={1.5} />
                    <span className="text-[11px] font-bold uppercase tracking-[0.15em]">Admin</span>
                    {pathname === "/admin" && (
                      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#4FFFC8]" />
                    )}
                  </Link>
                )}
              </div>
            </div>

            {/* Right: User Profile */}
            <div className="flex-shrink-0 flex items-center gap-6 z-10">

              {/* User Section */}
              {user ? (
                <div className="flex items-center gap-3">
                  {/* Notification Center */}
                  <NotificationCenter />
                  
                  <Link
                    href="/portal"
                    className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-[#0f0f0f]/80 backdrop-blur-md rounded-full border border-[#1A1A1A] hover:border-[#4FFFC8]/30 hover:bg-[#0f0f0f] transition-all cursor-pointer group"
                  >
                    <div className="w-6 h-6 bg-[#4FFFC8]/20 rounded-full flex items-center justify-center border border-[#4FFFC8]/30 group-hover:bg-[#4FFFC8]/30 transition-colors">
                      <User className="w-3 h-3 text-[#4FFFC8]" strokeWidth={1.5} />
                    </div>
                    <div className="text-xs text-slate-400 group-hover:text-white max-w-[120px] truncate transition-colors">{user.email}</div>
                  </Link>
                  <button
                    onClick={handleSignOut}
                    className="p-2 text-slate-500 hover:text-white rounded-lg transition-colors"
                    title="Sign Out"
                  >
                    <LogOut className="w-4 h-4" strokeWidth={1.5} />
                  </button>
                </div>
              ) : (
                <Link
                  href="/login"
                  className="px-6 py-2.5 bg-[#4FFFC8] hover:bg-[#3debb8] text-black font-bold rounded-full transition-all text-sm shadow-[0_0_20px_rgba(79,255,200,0.3)]"
                >
                  Sign In
                </Link>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content - Full Width with Header Buffer */}
      <main className="flex-1 w-full bg-[#050505] pt-16" style={{ paddingTop: '64px' }}>
        {children}
      </main>
        
      {/* Mobile Menu Button */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-[80] h-16 bg-[#050505]/95 backdrop-blur-md border-b border-[#1A1A1A] px-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <div className="w-9 h-9 bg-[#4FFFC8] rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(79,255,200,0.3)]">
            <TrendingUp className="w-5 h-5 text-black" strokeWidth={1.5} />
          </div>
          <div className="text-xl font-semibold text-white tracking-tight">Prop Market</div>
        </Link>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 text-slate-500 hover:text-white rounded-lg transition-colors"
        >
          {mobileMenuOpen ? <X className="w-6 h-6" strokeWidth={1.5} /> : <Menu className="w-6 h-6" strokeWidth={1.5} />}
        </button>
      </div>

      {/* Mobile Sidebar */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-[75] bg-[#050505]/98 backdrop-blur-xl mt-16">
          <div className="pt-8 px-4">
            <nav className="space-y-1">
              {allNavItems.map((item) => {
                const isActive = pathname === item.href;
                const Icon = item.icon;
                const isAdminLink = 'isAdmin' in item && item.isAdmin;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    prefetch={true}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 rounded-full px-4 py-3 text-sm font-medium transition-all ${
                      isActive
                        ? "bg-[#4FFFC8]/10 text-[#4FFFC8] border border-[#4FFFC8]/20"
                        : "text-slate-400 hover:bg-[#0f0f0f] hover:text-white"
                    } ${isAdminLink ? "border border-[#1A1A1A]" : ""}`}
                  >
                    <Icon className="w-5 h-5" strokeWidth={1.5} />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
            {user && (
              <div className="mt-8 pt-8 border-t border-white/5">
                <Link
                  href="/portal"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block p-4 bg-[#0f0f0f]/80 backdrop-blur-md rounded-2xl mb-4 border border-[#1A1A1A] hover:border-[#4FFFC8]/30 hover:bg-[#0f0f0f] transition-all"
                >
                  <div className="text-xs text-slate-500 mb-1">Signed in as</div>
                  <div className="text-sm font-medium text-white truncate">{user.email}</div>
                  <div className="text-xs text-[#4FFFC8] mt-1">Tap to manage account →</div>
                </Link>
                <button
                  onClick={() => {
                    handleSignOut();
                    setMobileMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium text-slate-400 hover:bg-slate-900/50 hover:text-white"
                >
                  <LogOut className="w-5 h-5" strokeWidth={1.5} />
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
