'use client';

import { motion } from 'framer-motion';
import { FileText, Scale, AlertCircle, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

export default function TermsOfServicePage() {
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
              <FileText className="w-8 h-8 text-[#4FFFC8]" strokeWidth={1.5} />
            </div>
            <div>
              <h1 className="text-5xl font-black tracking-tighter text-white mb-2">
                Terms of Service
              </h1>
              <p className="text-slate-400 text-sm">Last Updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="space-y-12"
        >
          {/* Acceptance */}
          <section>
            <div className="flex items-center gap-3 mb-6">
              <CheckCircle2 className="w-6 h-6 text-[#4FFFC8]" strokeWidth={2} />
              <h2 className="text-3xl font-black text-white tracking-tight">1. Acceptance of Terms</h2>
            </div>
            <div className="bg-slate-900/30 border border-slate-800 rounded-xl p-8">
              <p className="text-slate-300 leading-relaxed">
                By accessing and using Synq ("the Platform", "we", "us", "our"), you accept and agree to be bound by these Terms of Service. If you do not agree to these terms, you must not use the Platform. These terms constitute a legally binding agreement between you and Synq
              </p>
            </div>
          </section>

          {/* Eligibility */}
          <section>
            <div className="flex items-center gap-3 mb-6">
              <Scale className="w-6 h-6 text-[#4FFFC8]" strokeWidth={2} />
              <h2 className="text-3xl font-black text-white tracking-tight">2. Eligibility and Account Requirements</h2>
            </div>
            <div className="bg-slate-900/30 border border-slate-800 rounded-xl p-8 space-y-4">
              <div>
                <h3 className="text-lg font-bold text-white mb-2">Age Requirement</h3>
                <p className="text-slate-300 leading-relaxed">
                  You must be at least 18 years old to use the Platform. By using the Platform, you represent and warrant that you are of legal age in your jurisdiction.
                </p>
              </div>
              <div>
                <h3 className="text-lg font-bold text-white mb-2">Account Responsibility</h3>
                <p className="text-slate-300 leading-relaxed">
                  You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You must immediately notify us of any unauthorized use of your account.
                </p>
              </div>
              <div>
                <h3 className="text-lg font-bold text-white mb-2">One Account Per Person</h3>
                <p className="text-slate-300 leading-relaxed">
                  Each user may maintain only one account. Creating multiple accounts, sharing accounts, or using another person's account is strictly prohibited and may result in immediate termination.
                </p>
              </div>
            </div>
          </section>

          {/* Challenge Terms */}
          <section>
            <div className="flex items-center gap-3 mb-6">
              <AlertCircle className="w-6 h-6 text-[#4FFFC8]" strokeWidth={2} />
              <h2 className="text-3xl font-black text-white tracking-tight">3. Challenge Terms and Conditions</h2>
            </div>
            <div className="bg-slate-900/30 border border-slate-800 rounded-xl p-8 space-y-6">
              <div>
                <h3 className="text-lg font-bold text-white mb-3">Challenge Fees</h3>
                <p className="text-slate-300 leading-relaxed mb-3">
                  Challenge fees are non-refundable. Once paid, fees cannot be returned under any circumstances, including but not limited to:
                </p>
                <ul className="list-disc list-inside text-slate-400 space-y-2 ml-4">
                  <li>Challenge failure or disqualification</li>
                  <li>Technical issues or platform downtime</li>
                  <li>User error or misunderstanding of rules</li>
                  <li>Voluntary withdrawal from a challenge</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-bold text-white mb-3">Challenge Rules</h3>
                <p className="text-slate-300 leading-relaxed mb-3">
                  All challenges are subject to strict rules and risk parameters:
                </p>
                <ul className="list-disc list-inside text-slate-400 space-y-2 ml-4">
                  <li>Daily drawdown limits must not be exceeded</li>
                  <li>Total drawdown limits apply throughout the challenge period</li>
                  <li>Position size restrictions are strictly enforced</li>
                  <li>Minimum trading period requirements must be met</li>
                  <li>All trades must comply with platform rules</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-bold text-white mb-3">Challenge Failure</h3>
                <p className="text-slate-300 leading-relaxed">
                  Challenges may be failed automatically if you breach any risk parameters, violate trading rules, or engage in prohibited activities. Failed challenges cannot be restarted, and fees are not refunded.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-bold text-white mb-3">Challenge Passing</h3>
                <p className="text-slate-300 leading-relaxed">
                  Passing a challenge does not guarantee funding or account access. Additional verification, compliance checks, and terms may apply. Synq reserves the right to deny funding to any user at its sole discretion.
                </p>
              </div>
            </div>
          </section>

          {/* Prohibited Activities */}
          <section>
            <h2 className="text-3xl font-black text-white mb-8 tracking-tight">4. Prohibited Activities</h2>
            <div className="bg-slate-900/30 border border-red-500/20 rounded-xl p-8">
              <p className="text-slate-300 leading-relaxed mb-4">
                The following activities are strictly prohibited and may result in immediate account termination:
              </p>
              <ul className="list-disc list-inside text-slate-400 space-y-2 ml-4">
                <li>Using automated trading systems, bots, or scripts</li>
                <li>Exploiting technical glitches or system vulnerabilities</li>
                <li>Manipulating market data or prices</li>
                <li>Creating multiple accounts or sharing accounts</li>
                <li>Engaging in fraudulent or deceptive practices</li>
                <li>Violating any applicable laws or regulations</li>
                <li>Reverse engineering or attempting to hack the Platform</li>
                <li>Using the Platform for illegal purposes</li>
              </ul>
            </div>
          </section>

          {/* Intellectual Property */}
          <section>
            <h2 className="text-3xl font-black text-white mb-8 tracking-tight">5. Intellectual Property</h2>
            <div className="bg-slate-900/30 border border-slate-800 rounded-xl p-8">
              <p className="text-slate-300 leading-relaxed mb-4">
                All content, features, and functionality of the Platform, including but not limited to text, graphics, logos, icons, images, software, and code, are the exclusive property of Synq and are protected by copyright, trademark, and other intellectual property laws.
              </p>
              <p className="text-slate-300 leading-relaxed">
                You may not reproduce, distribute, modify, create derivative works of, publicly display, or otherwise use any Platform content without our express written permission.
              </p>
            </div>
          </section>

          {/* Limitation of Liability */}
          <section>
            <h2 className="text-3xl font-black text-white mb-8 tracking-tight">6. Limitation of Liability</h2>
            <div className="bg-slate-900/30 border border-slate-800 rounded-xl p-8">
              <p className="text-slate-300 leading-relaxed mb-4">
                TO THE MAXIMUM EXTENT PERMITTED BY LAW, Synq SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO LOSS OF PROFITS, DATA, OR USE, ARISING OUT OF OR RELATING TO YOUR USE OF THE PLATFORM.
              </p>
              <p className="text-slate-300 leading-relaxed">
                Our total liability to you for any claims arising from or related to the Platform shall not exceed the amount you paid to us in the twelve (12) months preceding the claim.
              </p>
            </div>
          </section>

          {/* Termination */}
          <section>
            <h2 className="text-3xl font-black text-white mb-8 tracking-tight">7. Termination</h2>
            <div className="bg-slate-900/30 border border-slate-800 rounded-xl p-8">
              <p className="text-slate-300 leading-relaxed mb-4">
                We reserve the right to suspend or terminate your account and access to the Platform at any time, with or without cause or notice, for any reason including but not limited to:
              </p>
              <ul className="list-disc list-inside text-slate-400 space-y-2 ml-4 mb-4">
                <li>Violation of these Terms of Service</li>
                <li>Fraudulent or illegal activity</li>
                <li>Abuse of the Platform or other users</li>
                <li>Technical or security concerns</li>
              </ul>
              <p className="text-slate-300 leading-relaxed">
                Upon termination, your right to use the Platform will immediately cease, and we may delete your account and all associated data.
              </p>
            </div>
          </section>

          {/* Changes to Terms */}
          <section>
            <h2 className="text-3xl font-black text-white mb-8 tracking-tight">8. Changes to Terms</h2>
            <div className="bg-slate-900/30 border border-slate-800 rounded-xl p-8">
              <p className="text-slate-300 leading-relaxed">
                We reserve the right to modify these Terms of Service at any time. Material changes will be communicated through the Platform or via email. Your continued use of the Platform after such modifications constitutes acceptance of the updated terms. If you do not agree to the modified terms, you must stop using the Platform.
              </p>
            </div>
          </section>

          {/* Governing Law */}
          <section>
            <h2 className="text-3xl font-black text-white mb-8 tracking-tight">9. Governing Law</h2>
            <div className="bg-slate-900/30 border border-slate-800 rounded-xl p-8">
              <p className="text-slate-300 leading-relaxed">
                These Terms of Service shall be governed by and construed in accordance with the laws of the jurisdiction in which Synq is incorporated, without regard to its conflict of law provisions. Any disputes arising from these terms shall be resolved through binding arbitration.
              </p>
            </div>
          </section>

          {/* Contact */}
          <section className="bg-slate-900/30 border border-slate-800 rounded-xl p-8">
            <h2 className="text-2xl font-black text-white mb-4">Questions About Terms?</h2>
            <p className="text-slate-300 leading-relaxed mb-6">
              If you have questions about these Terms of Service, please contact our support team.
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
