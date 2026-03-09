'use client';

import { motion } from 'framer-motion';
import { Shield, AlertTriangle, TrendingDown, DollarSign, Clock } from 'lucide-react';
import Link from 'next/link';

export default function RiskDisclosurePage() {
  return (
    <div className="min-h-screen bg-[#050505] flex flex-col items-center overflow-x-hidden selection:bg-[#4FFFC8] selection:text-black relative">
      {/* Grain Overlay */}
      <div className="fixed inset-0 pointer-events-none z-0 opacity-[0.02]" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
      }} />

      <main className="w-full max-w-5xl mx-auto px-6 py-32 relative z-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-16"
        >
          <Link href="/" className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-8 text-sm">
            ← Back to Home
          </Link>
          
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 bg-slate-900/50 border border-[#4FFFC8]/20 rounded-xl flex items-center justify-center">
              <Shield className="w-8 h-8 text-[#4FFFC8]" strokeWidth={1.5} />
            </div>
            <div>
              <h1 className="text-5xl font-black tracking-tighter text-white mb-2">
                Risk Disclosure
              </h1>
              <p className="text-slate-400 text-sm">Last Updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
            </div>
          </div>
        </motion.div>

        {/* Content */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="space-y-12"
        >
          {/* Important Notice */}
          <div className="bg-slate-900/30 border border-red-500/20 rounded-2xl p-8">
            <div className="flex items-start gap-4">
              <AlertTriangle className="w-6 h-6 text-red-400 flex-shrink-0 mt-1" strokeWidth={2} />
              <div>
                <h2 className="text-xl font-black text-red-400 mb-3 uppercase tracking-wide">Important Risk Warning</h2>
                <p className="text-slate-300 leading-relaxed">
                  Trading prediction markets involves substantial risk of loss. You should carefully consider whether such trading is suitable for you in light of your circumstances, knowledge, and financial resources. You may lose some or all of your initial investment. Past performance is not indicative of future results.
                </p>
              </div>
            </div>
          </div>

          {/* Risk Categories */}
          <section>
            <h2 className="text-3xl font-black text-white mb-8 tracking-tight">Risk Categories</h2>
            
            <div className="space-y-6">
              <div className="bg-slate-900/30 border border-slate-800 rounded-xl p-6">
                <div className="flex items-center gap-3 mb-4">
                  <TrendingDown className="w-5 h-5 text-red-400" strokeWidth={2} />
                  <h3 className="text-xl font-bold text-white">Market Risk</h3>
                </div>
                <p className="text-slate-300 leading-relaxed mb-4">
                  Prediction market prices are highly volatile and can fluctuate rapidly based on news, events, and market sentiment. There is no guarantee that any position will be profitable, and you may experience significant losses.
                </p>
                <ul className="list-disc list-inside text-slate-400 space-y-2 ml-4">
                  <li>Prices can move against your position at any time</li>
                  <li>Market liquidity may be limited, affecting your ability to exit positions</li>
                  <li>Unexpected events can cause rapid price movements</li>
                </ul>
              </div>

              <div className="bg-slate-900/30 border border-slate-800 rounded-xl p-6">
                <div className="flex items-center gap-3 mb-4">
                  <DollarSign className="w-5 h-5 text-yellow-400" strokeWidth={2} />
                  <h3 className="text-xl font-bold text-white">Capital Risk</h3>
                </div>
                <p className="text-slate-300 leading-relaxed mb-4">
                  You may lose your entire investment or more. Challenge accounts are simulated trading environments, but real capital is at risk when trading on external platforms.
                </p>
                <ul className="list-disc list-inside text-slate-400 space-y-2 ml-4">
                  <li>Challenge fees are non-refundable</li>
                  <li>Failed challenges result in loss of entry fees</li>
                  <li>No guarantee of passing challenges or receiving funding</li>
                </ul>
              </div>

              <div className="bg-slate-900/30 border border-slate-800 rounded-xl p-6">
                <div className="flex items-center gap-3 mb-4">
                  <Clock className="w-5 h-5 text-blue-400" strokeWidth={2} />
                  <h3 className="text-xl font-bold text-white">Operational Risk</h3>
                </div>
                <p className="text-slate-300 leading-relaxed mb-4">
                  Technical issues, system failures, or connectivity problems may affect your ability to trade or monitor positions.
                </p>
                <ul className="list-disc list-inside text-slate-400 space-y-2 ml-4">
                  <li>Platform downtime or maintenance may occur</li>
                  <li>Data feed delays or inaccuracies</li>
                  <li>Third-party platform issues (Polymarket, Kalshi)</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Challenge-Specific Risks */}
          <section>
            <h2 className="text-3xl font-black text-white mb-8 tracking-tight">Challenge-Specific Risks</h2>
            
            <div className="bg-slate-900/30 border border-slate-800 rounded-xl p-8 space-y-6">
              <div>
                <h3 className="text-lg font-bold text-white mb-3">Daily Drawdown Limits</h3>
                <p className="text-slate-300 leading-relaxed">
                  Each challenge tier has strict daily drawdown limits (typically 5%). Exceeding this limit results in immediate challenge failure, regardless of overall performance. This means a single bad trading day can end your challenge.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-bold text-white mb-3">Total Drawdown Limits</h3>
                <p className="text-slate-300 leading-relaxed">
                  Maximum total drawdown limits (typically 10%) apply to your entire challenge period. Once breached, the challenge is permanently failed and cannot be restarted.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-bold text-white mb-3">Position Size Restrictions</h3>
                <p className="text-slate-300 leading-relaxed">
                  Maximum position size limits (typically 20% of equity) are enforced to prevent over-leveraging. Violations result in automatic position closure and potential challenge failure.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-bold text-white mb-3">Minimum Trading Period</h3>
                <p className="text-slate-300 leading-relaxed">
                  Challenges require a minimum trading period (typically 30 days) before you can pass. You must maintain profitable trading throughout this entire period while staying within all risk parameters.
                </p>
              </div>
            </div>
          </section>

          {/* No Guarantees */}
          <section>
            <h2 className="text-3xl font-black text-white mb-8 tracking-tight">No Guarantees</h2>
            
            <div className="bg-slate-900/30 border border-slate-800 rounded-xl p-8">
              <p className="text-slate-300 leading-relaxed mb-4">
                Synq makes no representations or warranties regarding:
              </p>
              <ul className="list-disc list-inside text-slate-400 space-y-2 ml-4">
                <li>The likelihood of passing any challenge</li>
                <li>Future market conditions or price movements</li>
                <li>The availability of funding after passing challenges</li>
                <li>The profitability of any trading strategy</li>
                <li>The accuracy or completeness of market data</li>
              </ul>
            </div>
          </section>

          {/* Suitability */}
          <section>
            <h2 className="text-3xl font-black text-white mb-8 tracking-tight">Suitability Requirements</h2>
            
            <div className="bg-slate-900/30 border border-slate-800 rounded-xl p-8">
              <p className="text-slate-300 leading-relaxed mb-4">
                Trading prediction markets is not suitable for everyone. You should only participate if you:
              </p>
              <ul className="list-disc list-inside text-slate-400 space-y-2 ml-4">
                <li>Understand the risks involved in prediction market trading</li>
                <li>Have sufficient financial resources to absorb potential losses</li>
                <li>Have experience with financial markets and risk management</li>
                <li>Can afford to lose your entire challenge fee</li>
                <li>Are not relying on challenge success for essential income</li>
                <li>Have read and understood all terms, conditions, and risk disclosures</li>
              </ul>
            </div>
          </section>

          {/* Contact */}
          <section className="bg-slate-900/30 border border-slate-800 rounded-xl p-8">
            <h2 className="text-2xl font-black text-white mb-4">Questions About Risk?</h2>
            <p className="text-slate-300 leading-relaxed mb-6">
              If you have questions about the risks involved in trading prediction markets or participating in challenges, please contact our support team before proceeding.
            </p>
            <Link 
              href="/platform-support" 
              className="inline-flex items-center gap-2 px-6 py-3 bg-[#4FFFC8] text-black font-bold rounded-lg hover:bg-[#4FFFC8]/90 transition-colors"
            >
              Contact Support
            </Link>
          </section>
        </motion.div>
      </main>
    </div>
  );
}
