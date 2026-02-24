'use client';

import { motion } from 'framer-motion';
import { Building2, Handshake, TrendingUp, Users, Shield, Mail, Phone, Globe } from 'lucide-react';
import Link from 'next/link';

export default function InstitutionalRelationsPage() {
  return (
    <div className="min-h-screen bg-[#050505] flex flex-col items-center overflow-x-hidden selection:bg-[#4FFFC8] selection:text-black relative">
      <div className="fixed inset-0 pointer-events-none z-0 opacity-[0.02]" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
      }} />

      <main className="w-full max-w-5xl mx-auto px-6 py-32 relative z-10">
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
              <Building2 className="w-8 h-8 text-[#4FFFC8]" strokeWidth={1.5} />
            </div>
            <div>
              <h1 className="text-5xl font-black tracking-tighter text-white mb-2">
                Institutional Relations
              </h1>
              <p className="text-slate-400 text-sm">Partnership opportunities for institutions and enterprises</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="space-y-12"
        >
          {/* Hero Section */}
          <section className="bg-gradient-to-br from-slate-900/50 to-slate-950/50 border border-[#4FFFC8]/20 rounded-2xl p-12">
            <div className="flex items-center gap-4 mb-6">
              <Handshake className="w-10 h-10 text-[#4FFFC8]" strokeWidth={1.5} />
              <h2 className="text-3xl font-black text-white">Partner With Us</h2>
            </div>
            <p className="text-slate-300 leading-relaxed text-lg mb-6">
              PROP MARKET LTD. offers institutional-grade trading infrastructure, risk management systems, and market access to qualified institutions, funds, and enterprise clients.
            </p>
            <p className="text-slate-400 leading-relaxed">
              Whether you're a hedge fund, family office, proprietary trading firm, or enterprise looking to integrate prediction market capabilities, we provide the tools, liquidity, and expertise to scale your operations.
            </p>
          </section>

          {/* Services */}
          <section>
            <h2 className="text-3xl font-black text-white mb-8 tracking-tight">Institutional Services</h2>
            
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-slate-900/30 border border-slate-800 rounded-xl p-8">
                <div className="flex items-center gap-3 mb-4">
                  <TrendingUp className="w-6 h-6 text-[#4FFFC8]" strokeWidth={2} />
                  <h3 className="text-xl font-bold text-white">Custom Trading Infrastructure</h3>
                </div>
                <p className="text-slate-300 leading-relaxed mb-4">
                  Dedicated trading infrastructure with API access, custom risk parameters, and enterprise-grade security. Scale your operations with our institutional platform.
                </p>
                <ul className="list-disc list-inside text-slate-400 space-y-2 ml-4">
                  <li>Direct API integration</li>
                  <li>Custom risk management systems</li>
                  <li>Dedicated infrastructure</li>
                  <li>Priority support and SLA guarantees</li>
                </ul>
              </div>

              <div className="bg-slate-900/30 border border-slate-800 rounded-xl p-8">
                <div className="flex items-center gap-3 mb-4">
                  <Users className="w-6 h-6 text-[#4FFFC8]" strokeWidth={2} />
                  <h3 className="text-xl font-bold text-white">White-Label Solutions</h3>
                </div>
                <p className="text-slate-300 leading-relaxed mb-4">
                  Launch your own prediction market platform with our white-label technology. Full customization, branding, and operational support included.
                </p>
                <ul className="list-disc list-inside text-slate-400 space-y-2 ml-4">
                  <li>Complete platform customization</li>
                  <li>Your branding and domain</li>
                  <li>Full technical support</li>
                  <li>Revenue sharing options</li>
                </ul>
              </div>

              <div className="bg-slate-900/30 border border-slate-800 rounded-xl p-8">
                <div className="flex items-center gap-3 mb-4">
                  <Shield className="w-6 h-6 text-[#4FFFC8]" strokeWidth={2} />
                  <h3 className="text-xl font-bold text-white">Risk Management Services</h3>
                </div>
                <p className="text-slate-300 leading-relaxed mb-4">
                  Advanced risk monitoring, compliance tools, and reporting systems for institutional clients. Real-time alerts and automated risk controls.
                </p>
                <ul className="list-disc list-inside text-slate-400 space-y-2 ml-4">
                  <li>Real-time risk monitoring</li>
                  <li>Custom compliance frameworks</li>
                  <li>Automated reporting</li>
                  <li>Regulatory support</li>
                </ul>
              </div>

              <div className="bg-slate-900/30 border border-slate-800 rounded-xl p-8">
                <div className="flex items-center gap-3 mb-4">
                  <Globe className="w-6 h-6 text-[#4FFFC8]" strokeWidth={2} />
                  <h3 className="text-xl font-bold text-white">Market Data & Analytics</h3>
                </div>
                <p className="text-slate-300 leading-relaxed mb-4">
                  Access to comprehensive market data, historical analytics, and predictive insights. Feed your proprietary models with institutional-grade data.
                </p>
                <ul className="list-disc list-inside text-slate-400 space-y-2 ml-4">
                  <li>Historical market data</li>
                  <li>Real-time price feeds</li>
                  <li>Advanced analytics tools</li>
                  <li>Custom data exports</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Partnership Benefits */}
          <section>
            <h2 className="text-3xl font-black text-white mb-8 tracking-tight">Partnership Benefits</h2>
            
            <div className="bg-slate-900/30 border border-slate-800 rounded-xl p-8 space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-lg font-bold text-white mb-3">Volume Discounts</h3>
                  <p className="text-slate-300 leading-relaxed">
                    Reduced fees and preferential pricing for high-volume institutional clients. Scale your operations with cost-effective access.
                  </p>
                </div>
                
                <div>
                  <h3 className="text-lg font-bold text-white mb-3">Dedicated Support</h3>
                  <p className="text-slate-300 leading-relaxed">
                    Priority support with dedicated account managers and 24/7 technical assistance. Your success is our priority.
                  </p>
                </div>
                
                <div>
                  <h3 className="text-lg font-bold text-white mb-3">Custom Solutions</h3>
                  <p className="text-slate-300 leading-relaxed">
                    Tailored solutions designed to meet your specific requirements. We work with you to build the perfect setup.
                  </p>
                </div>
                
                <div>
                  <h3 className="text-lg font-bold text-white mb-3">Co-Marketing Opportunities</h3>
                  <p className="text-slate-300 leading-relaxed">
                    Joint marketing initiatives, case studies, and thought leadership opportunities to grow your brand alongside ours.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Eligibility */}
          <section>
            <h2 className="text-3xl font-black text-white mb-8 tracking-tight">Institutional Eligibility</h2>
            
            <div className="bg-slate-900/30 border border-slate-800 rounded-xl p-8">
              <p className="text-slate-300 leading-relaxed mb-4">
                We work with qualified institutional clients including:
              </p>
              <ul className="list-disc list-inside text-slate-400 space-y-2 ml-4 mb-6">
                <li>Hedge funds and investment funds</li>
                <li>Proprietary trading firms</li>
                <li>Family offices and wealth management firms</li>
                <li>Enterprise clients seeking market access</li>
                <li>Technology companies building trading platforms</li>
                <li>Research institutions and academic organizations</li>
              </ul>
              <p className="text-slate-300 leading-relaxed">
                Minimum requirements typically include proof of institutional status, regulatory compliance documentation, and minimum volume commitments. Each partnership is evaluated on a case-by-case basis.
              </p>
            </div>
          </section>

          {/* Contact */}
          <section className="bg-gradient-to-br from-slate-900/50 to-slate-950/50 border border-[#4FFFC8]/30 rounded-2xl p-12">
            <div className="flex items-center gap-4 mb-6">
              <Mail className="w-8 h-8 text-[#4FFFC8]" strokeWidth={2} />
              <h2 className="text-3xl font-black text-white">Get In Touch</h2>
            </div>
            <p className="text-slate-300 leading-relaxed mb-8 text-lg">
              Interested in exploring an institutional partnership? Our team is ready to discuss how we can support your organization's goals.
            </p>
            
            <div className="space-y-4 mb-8">
              <div className="flex items-center gap-4 text-slate-300">
                <Mail className="w-5 h-5 text-[#4FFFC8]" />
                <span>institutional@propmarket.com</span>
              </div>
              <div className="flex items-center gap-4 text-slate-300">
                <Phone className="w-5 h-5 text-[#4FFFC8]" />
                <span>+1 (555) INST-REL</span>
              </div>
            </div>

            <Link 
              href="/platform-support" 
              className="inline-flex items-center gap-2 px-8 py-4 bg-[#4FFFC8] text-black font-bold rounded-lg hover:bg-[#4FFFC8]/90 transition-colors text-lg"
            >
              Schedule a Consultation
            </Link>
          </section>
        </motion.div>
      </main>
    </div>
  );
}
