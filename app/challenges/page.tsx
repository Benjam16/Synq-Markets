'use client';

import { useEffect, useState, useRef } from 'react';
import { motion, useMotionValue, useTransform, AnimatePresence } from 'framer-motion';
import { Check, ArrowRight, TrendingUp, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast, Toaster } from 'react-hot-toast';
import { Tier } from '@/lib/types';
import { useAuth } from '../components/AuthProvider';

const rules = [
  '5% Maximum Daily Drawdown',
  '10% Maximum Total Drawdown',
  '20% Maximum Position Size per Event',
  '30-Day Minimum Trading Period',
  'Real-time Risk Monitoring',
];

// Tier-specific data
const getTierMetadata = (tierName: string) => {
  const metadata: Record<string, {
    perks: string[];
    verticalLabel: string;
    protocolId: string;
    version: string;
    progressPercent: number;
  }> = {
    'The Scout': {
      perks: ['Standard Terminal', 'Email Support'],
      verticalLabel: 'RETAIL SPEC',
      protocolId: 'PRP-LQD-001',
      version: 'v.4.2',
      progressPercent: 1, // $5k of $500k = 1%
    },
    'The Analyst': {
      perks: ['Pro Terminal', 'Live News Feed'],
      verticalLabel: 'PRO TRADER',
      protocolId: 'PRP-LQD-002',
      version: 'v.4.2',
      progressPercent: 5, // $25k of $500k = 5%
    },
    'The Strategist': {
      perks: ['Arbitrage Tools', 'Priority Payouts', 'MOST POPULAR'],
      verticalLabel: 'INSTITUTIONAL GRADE',
      protocolId: 'PRP-LQD-003',
      version: 'v.4.2',
      progressPercent: 20, // $100k of $500k = 20%
    },
    'The Whale': {
      perks: ['Whale Tracker', '24/7 Priority Support', 'Direct API Access'],
      verticalLabel: 'CAPITAL ELITE',
      protocolId: 'PRP-LQD-004',
      version: 'v.4.2',
      progressPercent: 50, // $250k of $500k = 50%
    },
    'VIP/Elite': {
      perks: ['Custom Risk Parameters', 'Institutional Liquidity', 'Dedicated Support'],
      verticalLabel: 'INSTITUTIONAL',
      protocolId: 'PRP-LQD-005',
      version: 'v.4.2',
      progressPercent: 100,
    },
  };
  return metadata[tierName] || metadata['The Scout'];
};

// Generate sparkline path data
const generateSparkline = (points: number = 20, width: number = 200) => {
  const height = 2;
  const stepX = width / (points - 1);
  let path = `M 0 ${height / 2}`;
  
  for (let i = 1; i < points; i++) {
    const x = i * stepX;
    const y = height / 2 + (Math.random() - 0.5) * height * 0.8;
    path += ` L ${x} ${y}`;
  }
  
  return path;
};

export default function ChallengesPage() {
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<number | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const cardRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    const loadTiers = async () => {
      // Set fallback tiers immediately (with IDs that match common database IDs)
      // Note: These IDs are placeholders - the API should return real IDs from the database
      const fallbackTiers: Tier[] = [
        { id: 1, name: 'The Scout', accountSize: 5000, fee: 49, target: 'New traders, "micro-betting" experimenters.' },
        { id: 2, name: 'The Analyst', accountSize: 25000, fee: 199, target: 'Serious retail traders looking for a side income.' },
        { id: 3, name: 'The Strategist', accountSize: 100000, fee: 549, target: 'Pro-level traders; top 2% of the market.' },
        { id: 4, name: 'The Whale', accountSize: 250000, fee: 1099, target: 'Institutional-grade traders focused on high liquidity.' },
      ];
      
      try {
        const res = await fetch('/api/dashboard?userId=1');
        if (res.ok) {
          const data = await res.json();
          if (data.tiers && data.tiers.length > 0) {
            setTiers(data.tiers);
          } else {
            setTiers(fallbackTiers);
          }
        } else {
          setTiers(fallbackTiers);
        }
      } catch (error) {
        console.error('Failed to load tiers:', error);
        setTiers(fallbackTiers);
      } finally {
        setLoading(false);
      }
    };
    loadTiers();
  }, []);

  const handlePurchase = async (tier: Tier) => {
    if (!user) {
      router.push('/login');
      return;
    }

    setPurchasing(tier.id || 0);

    try {
      // Get or create user in database
      let dbUserId: number;
      const getUserRes = await fetch(`/api/user?email=${encodeURIComponent(user.email || '')}`);
      
      if (getUserRes.ok) {
        const { user: dbUser } = await getUserRes.json();
        dbUserId = dbUser.id;
      } else {
        const createRes = await fetch('/api/user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            supabaseUserId: user.id,
            email: user.email,
            fullName: user.user_metadata?.full_name || user.email?.split('@')[0],
          }),
        });
        
        if (!createRes.ok) {
          const errorData = await createRes.json().catch(() => ({ error: 'Unknown error' }));
          console.error('[Challenges] Failed to create user:', {
            status: createRes.status,
            statusText: createRes.statusText,
            error: errorData,
            email: user.email,
            fullError: errorData,
          });
          
          // Show more detailed error to user
          const errorMessage = errorData.error || `Failed to create user (${createRes.status})`;
          const errorCode = errorData.code || 'UNKNOWN';
          const errorDetails = errorData.details || '';
          
          console.error('[Challenges] Error details:', {
            message: errorMessage,
            code: errorCode,
            details: errorDetails,
          });
          
          throw new Error(`${errorMessage}${errorDetails ? `: ${errorDetails}` : ''}`);
        }
        
        const createData = await createRes.json();
        if (!createData.userId) {
          throw new Error('User creation succeeded but no userId returned');
        }
        dbUserId = createData.userId;
      }

      // Purchase challenge
      console.log('[Challenges] Purchasing challenge:', {
        userId: dbUserId,
        tierId: tier.id,
        tier: tier,
        allTiers: tiers,
      });
      
      if (!dbUserId) {
        throw new Error('User ID is missing. Please try again.');
      }
      
      if (!tier.id) {
        console.error('[Challenges] Tier missing ID:', tier);
        // Try to find tier by name in database tiers
        const dbTier = tiers.find(t => t.name === tier.name && t.id);
        if (dbTier && dbTier.id) {
          console.log('[Challenges] Found tier ID by name:', dbTier.id);
          tier.id = dbTier.id;
        } else {
          throw new Error('Tier ID is missing. Please refresh the page to load tiers from the database.');
        }
      }
      
      const purchaseRes = await fetch('/api/purchase-challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: dbUserId,
          tierId: tier.id,
        }),
      });

      if (!purchaseRes.ok) {
        const error = await purchaseRes.json();
        throw new Error(error.error || 'Failed to purchase challenge');
      }

      toast.success('Challenge purchased successfully! Redirecting to dashboard...');
      setTimeout(() => {
        router.push('/dashboard');
      }, 1500);
    } catch (error: any) {
      toast.error(error.message || 'Failed to purchase challenge');
      setPurchasing(null);
    }
  };

  // Mouse tracking for spotlight effect
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (cardRef.current) {
        const rect = cardRef.current.getBoundingClientRect();
        setMousePosition({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        });
      }
    };

    if (cardRef.current) {
      cardRef.current.addEventListener('mousemove', handleMouseMove);
      return () => {
        if (cardRef.current) {
          cardRef.current.removeEventListener('mousemove', handleMouseMove);
        }
      };
    }
  }, [activeIndex]);

  const nextCard = () => {
    console.log('[Challenges] Next card clicked, current index:', activeIndex);
    setActiveIndex((prev) => {
      const next = (prev + 1) % tiers.length;
      console.log('[Challenges] Moving to index:', next);
      return next;
    });
  };

  const prevCard = () => {
    console.log('[Challenges] Prev card clicked, current index:', activeIndex);
    setActiveIndex((prev) => {
      const next = (prev - 1 + tiers.length) % tiers.length;
      console.log('[Challenges] Moving to index:', next);
      return next;
    });
  };

  // Get background gradient color based on active tier
  const getBackgroundGradient = () => {
    const tier = tiers[activeIndex];
    if (!tier) return 'rgba(0,0,0,0)';
    if (tier.name === 'The Strategist') return 'rgba(199, 229, 57, 0.1)';
    if (tier.name === 'The Scout') return 'rgba(30, 58, 138, 0.1)';
    return 'rgba(0,0,0,0)';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#4FFFC8] animate-spin" />
      </div>
    );
  }

  if (tiers.length === 0) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <p className="text-slate-400">No tiers available</p>
      </div>
    );
  }

  return (
    <>
      {/* Navigation Arrows - OUTSIDE container to avoid overflow clipping */}
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          console.log('[Challenges] Prev button clicked');
          prevCard();
        }}
        className="fixed left-4 z-[99999] w-20 h-20 bg-[#4FFFC8] border-4 border-[#4FFFC8] rounded-full flex items-center justify-center text-black shadow-2xl shadow-[#4FFFC8]/50 cursor-pointer hover:scale-110 active:scale-95 transition-transform"
        style={{ 
          top: '50%', 
          transform: 'translateY(-50%)',
          position: 'fixed',
          zIndex: 99999,
        }}
        aria-label="Previous tier"
      >
        <ChevronLeft className="w-8 h-8 text-black" strokeWidth={3} />
      </button>
      
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          console.log('[Challenges] Next button clicked');
          nextCard();
        }}
        className="fixed right-4 z-[99999] w-20 h-20 bg-[#4FFFC8] border-4 border-[#4FFFC8] rounded-full flex items-center justify-center text-black shadow-2xl shadow-[#4FFFC8]/50 cursor-pointer hover:scale-110 active:scale-95 transition-transform"
        style={{ 
          top: '50%', 
          transform: 'translateY(-50%)',
          position: 'fixed',
          zIndex: 99999,
        }}
        aria-label="Next tier"
      >
        <ChevronRight className="w-8 h-8 text-black" strokeWidth={3} />
      </button>

      <div className="min-h-screen bg-[#050505] relative overflow-hidden">
      <Toaster 
        position="top-right"
        toastOptions={{
          style: {
            background: '#0F172A',
            color: '#e2e8f0',
            border: '1px solid #1e293b',
          },
        }}
      />
      
      {/* Dynamic Background Gradient */}
      <motion.div 
        className="fixed inset-0 pointer-events-none transition-all duration-1000"
        style={{
          background: `radial-gradient(circle at center, ${getBackgroundGradient()}, transparent 70%)`,
        }}
        animate={{
          opacity: [0.3, 0.5, 0.3],
        }}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
      
      {/* Stage Container */}
      <main className="pt-32 flex flex-col items-center justify-center min-h-[80vh] w-full relative overflow-hidden">
        {/* Title */}
        <h1 className="text-4xl font-black tracking-tighter text-white mb-20">
          Choose Your Tier
        </h1>

        {/* Carousel Stage */}
        <div className="relative w-full flex items-center justify-center" style={{ height: '580px' }}>
          <div className="relative flex items-center justify-center" style={{ width: '420px', height: '580px' }}>
            {tiers.map((tier, idx) => {
              const isActive = idx === activeIndex;
              const offset = idx - activeIndex;
              
              // Calculate position - center the active card, offset others
              const x = offset * 470; // Spacing between cards (420px card + 50px gap)
              const scale = isActive ? 1 : 0.75;
              const opacity = isActive ? 1 : 0.3;
              
              return (
                <motion.div
                  key={tier.name}
                  initial={false}
                  animate={{
                    x: x,
                    scale: isActive ? 1 : 0.9,
                    opacity: isActive ? 1 : 0.2,
                    filter: isActive ? 'blur(0px)' : 'blur(8px)',
                  }}
                  transition={{
                    x: { type: 'spring', stiffness: 400, damping: 40 },
                    scale: { type: 'spring', stiffness: 400, damping: 40 },
                    opacity: { duration: 0.3 },
                  }}
                  className="absolute"
                  style={{ width: '420px' }}
                >
                  {/* Atmospheric Glow - Pulsing Behind Active Card */}
                  {isActive && (
                    <motion.div
                      className="absolute inset-0 -z-10 flex items-center justify-center pointer-events-none"
                      animate={{
                        opacity: [0.02, 0.05, 0.02],
                      }}
                      transition={{
                        duration: 3,
                        repeat: Infinity,
                        ease: 'easeInOut',
                      }}
                    >
                      <div className="w-[500px] h-[500px] bg-[#4FFFC8] rounded-full blur-3xl" />
                    </motion.div>
                  )}

                  <motion.div
                    ref={isActive ? cardRef : null}
                    initial={false}
                    animate={isActive ? {
                      scale: 1,
                      opacity: 1,
                      y: [0, -8, 0],
                    } : {
                      scale: 0.9,
                      opacity: 0.2,
                      y: 0,
                    }}
                    transition={isActive ? {
                      scale: { type: 'spring', stiffness: 400, damping: 40 },
                      opacity: { duration: 0.3 },
                      y: { duration: 6, repeat: Infinity, ease: 'easeInOut' },
                    } : {
                      scale: { type: 'spring', stiffness: 400, damping: 40 },
                      opacity: { duration: 0.3 },
                    }}
                    className={`relative w-[420px] h-[580px] flex flex-col justify-between p-10 bg-[#050505]/80 backdrop-blur-2xl border border-white/[0.03] border-t-white/20 border-l-white/10 rounded-[2rem] transition-all ${
                      isActive ? 'border-t-[#4FFFC8]' : ''
                    }`}
                    onClick={() => !isActive && setActiveIndex(idx)}
                  >
                    {/* Vertical Branding Label - Far Left, Ghost Watermark */}
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 -rotate-90 origin-center pointer-events-none z-0">
                      <div className="text-[10px] tracking-[0.5em] opacity-[0.03] font-black text-white whitespace-nowrap">
                        {getTierMetadata(tier.name).verticalLabel}
                      </div>
                    </div>

                    {/* Protocol Tag - Top Left Corner */}
                    <div className="absolute top-4 left-4 pointer-events-none z-10">
                      <div className="text-[7px] font-mono text-slate-700">
                        TRD-ALPHA-{String(idx + 1).padStart(2, '0')}
                      </div>
                    </div>

                    {/* Security Level - Top Right Corner */}
                    <div className="absolute top-4 right-4 pointer-events-none z-10">
                      <div className="text-[7px] font-mono text-slate-700">
                        LVL {idx + 1}
                      </div>
                    </div>

                    {/* Spotlight Effect - Only on Active Card */}
                    {isActive && (
                      <motion.div
                        className="absolute inset-0 rounded-[2.5rem] opacity-20 pointer-events-none"
                        style={{
                          background: `radial-gradient(600px circle at ${mousePosition.x}px ${mousePosition.y}px, rgba(199, 229, 57, 0.15), transparent 40%)`,
                        }}
                      />
                    )}

                    {/* Watermark - Massive Low-Opacity Account Size */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="text-[250px] font-black font-mono text-white tracking-tighter opacity-[0.02] leading-none">
                        {tier.accountSize.toLocaleString()}
                      </div>
                    </div>

                    {/* Sparkline - Clean Thin Line Spanning Card Width */}
                    <div className="absolute top-[260px] left-10 right-10 h-[2px] pointer-events-none opacity-[0.05]">
                      <svg width="100%" height="2" viewBox="0 0 400 2" preserveAspectRatio="none" className="text-[#4FFFC8]">
                        <path
                          d={generateSparkline(50, 400)}
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </div>

                    {/* Top Section: Hero Data */}
                    <div className="w-full text-center relative z-10">
                      {/* Technical Metadata */}
                      <div className="flex items-center justify-center gap-4 mb-2">
                        <div className="text-[9px] font-mono text-slate-500">
                          {getTierMetadata(tier.name).protocolId}
                        </div>
                        <div className="text-[9px] font-mono text-slate-500">
                          {getTierMetadata(tier.name).version}
                        </div>
                      </div>
                      
                      <div className="text-[9px] font-black uppercase tracking-[0.4em] text-slate-500 mb-4">
                        {tier.name.toUpperCase()}
                      </div>
                      
                      {/* Account Size with Progress Bar */}
                      <div className="mb-6">
                        {isActive && tier.accountSize ? (
                          <ValueTicker
                            value={tier.accountSize}
                            prefix="$"
                            className="text-6xl font-black text-white tracking-[-0.08em] mb-3 leading-tight"
                          />
                        ) : (
                          <div className="text-6xl font-black text-white tracking-[-0.08em] mb-3 leading-tight">
                            ${tier.accountSize?.toLocaleString() || '0'}
                          </div>
                        )}
                        {/* Progress Bar */}
                        <div className="w-32 h-1 bg-white/5 rounded-full mx-auto overflow-hidden">
                          <div 
                            className="h-full bg-[#4FFFC8]/30 rounded-full transition-all duration-500"
                            style={{ width: `${getTierMetadata(tier.name).progressPercent}%` }}
                          />
                        </div>
                        <div className="text-[7px] text-slate-600 mt-1">
                          {getTierMetadata(tier.name).progressPercent}% of platform cap
                        </div>
                      </div>
                      
                      {/* Entry Fee - Prominent */}
                      <div className="mb-0 relative">
                        <div className="text-[9px] font-black uppercase tracking-[0.4em] text-slate-500 mb-2">ENTRY FEE</div>
                        {isActive && tier.fee ? (
                          <ValueTicker
                            value={tier.fee}
                            prefix="$"
                            className="text-3xl font-mono font-black text-white"
                          />
                        ) : (
                          <div className="text-3xl font-mono font-black text-white">
                            ${tier.fee || '0'}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Middle Section: Technical Specs - Only on Active Card */}
                    {isActive && (
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="w-full relative z-10"
                      >
                        <div className="border-t border-white/5 mb-6"></div>
                        <div className="grid grid-cols-3 gap-0">
                          <div className="text-center px-4 border-r border-white/5">
                            <div className="text-[9px] font-black uppercase tracking-[0.4em] text-slate-500 mb-2">LEVERAGE</div>
                            <div className="text-xl font-mono font-black text-white">20% POS</div>
                          </div>
                          <div className="text-center px-4 border-r border-white/5">
                            <div className="text-[9px] font-black uppercase tracking-[0.4em] text-slate-500 mb-2">DRAWDOWN</div>
                            <AnimatedNumber value={10.0} suffix="%" />
                          </div>
                          <div className="text-center px-4">
                            <div className="text-[9px] font-black uppercase tracking-[0.4em] text-slate-500 mb-2">RISK CAP</div>
                            <AnimatedNumber value={5.0} suffix="%" />
                          </div>
                        </div>
                        <div className="border-t border-white/5 mt-6"></div>
                      </motion.div>
                    )}

                    {/* Bottom Section: Action - Only on Active Card */}
                    {isActive && (
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="w-full relative z-10 flex flex-col"
                      >
                        {/* Unique Perks - Horizontal Row Above Button */}
                        <div className="mb-4">
                          <div className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-500 text-center">
                            {getTierMetadata(tier.name).perks
                              .filter(p => p !== 'MOST POPULAR')
                              .map((perk, idx) => (
                                <span key={idx}>
                                  {idx > 0 && ' • '}
                                  {perk.toUpperCase()}
                                </span>
                              ))}
                            {getTierMetadata(tier.name).perks.includes('MOST POPULAR') && (
                              <span className="text-[#4FFFC8]"> • MOST POPULAR</span>
                            )}
                          </div>
                        </div>

                        {/* Button Pinned to Bottom */}
                        <div className="mt-auto">
                          {user ? (
                            <>
                              <motion.button
                                onClick={() => handlePurchase(tier)}
                                disabled={purchasing === (tier.id || 0)}
                                whileHover={{ filter: 'brightness(1.1)' }}
                                whileTap={{ scale: 0.98 }}
                                className="w-full py-5 bg-[#4FFFC8] text-black rounded-full font-black uppercase tracking-widest text-[10px] hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed mb-3"
                              >
                                {purchasing === (tier.id || 0) ? (
                                  <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    Processing...
                                  </>
                                ) : (
                                  'PURCHASE CHALLENGE'
                                )}
                              </motion.button>
                              <div className="text-[9px] text-slate-600 text-center">
                                INSTANT CREDENTIAL DELIVERY
                              </div>
                            </>
                          ) : (
                            <>
                              <motion.div
                                whileHover={{ filter: 'brightness(1.1)' }}
                                whileTap={{ scale: 0.98 }}
                              >
                                <Link
                                  href="/login"
                                  className="w-full py-5 bg-[#4FFFC8] text-black rounded-full font-black uppercase tracking-widest text-[10px] hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center mb-3"
                                >
                                  SIGN UP TO START
                                </Link>
                              </motion.div>
                              <div className="text-[9px] text-slate-600 text-center">
                                INSTANT CREDENTIAL DELIVERY
                              </div>
                            </>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </motion.div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </main>
    </div>
    </>
  );
}

// Animated Number Component
function AnimatedNumber({ value, suffix = '' }: { value: number; suffix?: string }) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    setDisplayValue(0); // Reset when value changes
    const duration = 1000; // 1 second
    const steps = 60;
    const increment = value / steps;
    const stepDuration = duration / steps;

    let current = 0;
    const timer = setInterval(() => {
      current += increment;
      if (current >= value) {
        setDisplayValue(value);
        clearInterval(timer);
      } else {
        setDisplayValue(current);
      }
    }, stepDuration);

    return () => clearInterval(timer);
  }, [value]);

  return (
    <div className="text-xl font-mono font-black text-white">
      {displayValue.toFixed(2)}{suffix}
    </div>
  );
}

// Value Ticker Component for Account Size and Entry Fee
function ValueTicker({ value, prefix = '', suffix = '', className = '' }: { value: number; prefix?: string; suffix?: string; className?: string }) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    if (!value || value <= 0) {
      setDisplayValue(0);
      return;
    }

    setDisplayValue(0); // Reset when value changes
    const duration = 1200; // 1.2 seconds
    const steps = 80;
    const increment = value / steps;
    const stepDuration = duration / steps;

    let current = 0;
    const timer = setInterval(() => {
      current += increment;
      if (current >= value) {
        setDisplayValue(value);
        clearInterval(timer);
      } else {
        setDisplayValue(current);
      }
    }, stepDuration);

    return () => clearInterval(timer);
  }, [value]);

  if (!value || value <= 0) {
    return <div className={className}>{prefix}0{suffix}</div>;
  }

  return (
    <div className={className}>
      {prefix}{Math.floor(displayValue).toLocaleString()}{suffix}
    </div>
  );
}
