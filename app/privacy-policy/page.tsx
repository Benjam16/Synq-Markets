'use client';

import { motion } from 'framer-motion';
import { Lock, Shield, Eye, Database, Mail } from 'lucide-react';
import Link from 'next/link';

export default function PrivacyPolicyPage() {
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
              <Lock className="w-8 h-8 text-[#4FFFC8]" strokeWidth={1.5} />
            </div>
            <div>
              <h1 className="text-5xl font-black tracking-tighter text-white mb-2">
                Privacy Policy
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
          {/* Introduction */}
          <section>
            <div className="flex items-center gap-3 mb-6">
              <Shield className="w-6 h-6 text-[#4FFFC8]" strokeWidth={2} />
              <h2 className="text-3xl font-black text-white tracking-tight">1. Introduction</h2>
            </div>
            <div className="bg-slate-900/30 border border-slate-800 rounded-xl p-8">
              <p className="text-slate-300 leading-relaxed mb-4">
                PROP MARKET LTD. ("we", "us", "our") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our Platform.
              </p>
              <p className="text-slate-300 leading-relaxed">
                By using the Platform, you consent to the data practices described in this policy. If you do not agree with this policy, you must not use the Platform.
              </p>
            </div>
          </section>

          {/* Information We Collect */}
          <section>
            <div className="flex items-center gap-3 mb-6">
              <Database className="w-6 h-6 text-[#4FFFC8]" strokeWidth={2} />
              <h2 className="text-3xl font-black text-white tracking-tight">2. Information We Collect</h2>
            </div>
            <div className="bg-slate-900/30 border border-slate-800 rounded-xl p-8 space-y-6">
              <div>
                <h3 className="text-lg font-bold text-white mb-3">Personal Information</h3>
                <p className="text-slate-300 leading-relaxed mb-3">
                  We collect information that you provide directly to us, including:
                </p>
                <ul className="list-disc list-inside text-slate-400 space-y-2 ml-4">
                  <li>Email address and account credentials</li>
                  <li>Full name and contact information</li>
                  <li>Payment information (processed securely through third-party providers)</li>
                  <li>Profile information and preferences</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-bold text-white mb-3">Trading and Activity Data</h3>
                <p className="text-slate-300 leading-relaxed mb-3">
                  We automatically collect information about your use of the Platform:
                </p>
                <ul className="list-disc list-inside text-slate-400 space-y-2 ml-4">
                  <li>Trading history and positions</li>
                  <li>Challenge participation and performance</li>
                  <li>Platform usage patterns and interactions</li>
                  <li>Device information and IP address</li>
                  <li>Browser type and operating system</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-bold text-white mb-3">Cookies and Tracking</h3>
                <p className="text-slate-300 leading-relaxed">
                  We use cookies, web beacons, and similar tracking technologies to enhance your experience, analyze usage patterns, and improve our services. You can control cookie preferences through your browser settings.
                </p>
              </div>
            </div>
          </section>

          {/* How We Use Information */}
          <section>
            <div className="flex items-center gap-3 mb-6">
              <Eye className="w-6 h-6 text-[#4FFFC8]" strokeWidth={2} />
              <h2 className="text-3xl font-black text-white tracking-tight">3. How We Use Your Information</h2>
            </div>
            <div className="bg-slate-900/30 border border-slate-800 rounded-xl p-8">
              <p className="text-slate-300 leading-relaxed mb-4">
                We use the information we collect to:
              </p>
              <ul className="list-disc list-inside text-slate-400 space-y-2 ml-4">
                <li>Provide, maintain, and improve the Platform</li>
                <li>Process transactions and manage your account</li>
                <li>Monitor challenge performance and enforce rules</li>
                <li>Send you important updates and notifications</li>
                <li>Respond to your inquiries and provide customer support</li>
                <li>Detect and prevent fraud, abuse, and security threats</li>
                <li>Comply with legal obligations and enforce our terms</li>
                <li>Analyze usage patterns to improve user experience</li>
              </ul>
            </div>
          </section>

          {/* Information Sharing */}
          <section>
            <h2 className="text-3xl font-black text-white mb-8 tracking-tight">4. Information Sharing and Disclosure</h2>
            <div className="bg-slate-900/30 border border-slate-800 rounded-xl p-8 space-y-6">
              <div>
                <h3 className="text-lg font-bold text-white mb-3">We Do Not Sell Your Data</h3>
                <p className="text-slate-300 leading-relaxed">
                  We do not sell, rent, or trade your personal information to third parties for their marketing purposes.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-bold text-white mb-3">Service Providers</h3>
                <p className="text-slate-300 leading-relaxed mb-3">
                  We may share information with trusted service providers who assist us in operating the Platform, including:
                </p>
                <ul className="list-disc list-inside text-slate-400 space-y-2 ml-4">
                  <li>Payment processors and financial institutions</li>
                  <li>Cloud hosting and infrastructure providers</li>
                  <li>Analytics and monitoring services</li>
                  <li>Customer support platforms</li>
                </ul>
                <p className="text-slate-300 leading-relaxed mt-3">
                  These providers are contractually obligated to protect your information and use it only for specified purposes.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-bold text-white mb-3">Legal Requirements</h3>
                <p className="text-slate-300 leading-relaxed">
                  We may disclose your information if required by law, court order, or government regulation, or if we believe disclosure is necessary to protect our rights, property, or safety, or that of our users or others.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-bold text-white mb-3">Business Transfers</h3>
                <p className="text-slate-300 leading-relaxed">
                  In the event of a merger, acquisition, or sale of assets, your information may be transferred to the acquiring entity, subject to the same privacy protections.
                </p>
              </div>
            </div>
          </section>

          {/* Data Security */}
          <section>
            <h2 className="text-3xl font-black text-white mb-8 tracking-tight">5. Data Security</h2>
            <div className="bg-slate-900/30 border border-slate-800 rounded-xl p-8">
              <p className="text-slate-300 leading-relaxed mb-4">
                We implement industry-standard security measures to protect your information, including:
              </p>
              <ul className="list-disc list-inside text-slate-400 space-y-2 ml-4 mb-4">
                <li>Encryption of data in transit and at rest</li>
                <li>Secure authentication and access controls</li>
                <li>Regular security audits and vulnerability assessments</li>
                <li>Employee training on data protection</li>
                <li>Incident response and breach notification procedures</li>
              </ul>
              <p className="text-slate-300 leading-relaxed">
                However, no method of transmission over the internet or electronic storage is 100% secure. While we strive to protect your information, we cannot guarantee absolute security.
              </p>
            </div>
          </section>

          {/* Your Rights */}
          <section>
            <h2 className="text-3xl font-black text-white mb-8 tracking-tight">6. Your Privacy Rights</h2>
            <div className="bg-slate-900/30 border border-slate-800 rounded-xl p-8 space-y-4">
              <div>
                <h3 className="text-lg font-bold text-white mb-2">Access and Correction</h3>
                <p className="text-slate-300 leading-relaxed">
                  You have the right to access, update, or correct your personal information through your account settings or by contacting us.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-bold text-white mb-2">Data Deletion</h3>
                <p className="text-slate-300 leading-relaxed">
                  You may request deletion of your account and associated data, subject to legal and operational requirements. Some information may be retained for legal compliance or dispute resolution.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-bold text-white mb-2">Opt-Out</h3>
                <p className="text-slate-300 leading-relaxed">
                  You can opt out of marketing communications by using the unsubscribe link in emails or adjusting your notification preferences in account settings.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-bold text-white mb-2">Data Portability</h3>
                <p className="text-slate-300 leading-relaxed">
                  You may request a copy of your data in a machine-readable format, subject to applicable law.
                </p>
              </div>
            </div>
          </section>

          {/* Data Retention */}
          <section>
            <h2 className="text-3xl font-black text-white mb-8 tracking-tight">7. Data Retention</h2>
            <div className="bg-slate-900/30 border border-slate-800 rounded-xl p-8">
              <p className="text-slate-300 leading-relaxed">
                We retain your information for as long as necessary to provide services, comply with legal obligations, resolve disputes, and enforce our agreements. When information is no longer needed, we securely delete or anonymize it in accordance with our data retention policies.
              </p>
            </div>
          </section>

          {/* Children's Privacy */}
          <section>
            <h2 className="text-3xl font-black text-white mb-8 tracking-tight">8. Children's Privacy</h2>
            <div className="bg-slate-900/30 border border-slate-800 rounded-xl p-8">
              <p className="text-slate-300 leading-relaxed">
                The Platform is not intended for users under the age of 18. We do not knowingly collect personal information from children. If we become aware that we have collected information from a child under 18, we will take steps to delete such information promptly.
              </p>
            </div>
          </section>

          {/* International Users */}
          <section>
            <h2 className="text-3xl font-black text-white mb-8 tracking-tight">9. International Data Transfers</h2>
            <div className="bg-slate-900/30 border border-slate-800 rounded-xl p-8">
              <p className="text-slate-300 leading-relaxed">
                Your information may be transferred to and processed in countries other than your country of residence. These countries may have data protection laws that differ from those in your country. By using the Platform, you consent to such transfers.
              </p>
            </div>
          </section>

          {/* Changes to Policy */}
          <section>
            <h2 className="text-3xl font-black text-white mb-8 tracking-tight">10. Changes to This Policy</h2>
            <div className="bg-slate-900/30 border border-slate-800 rounded-xl p-8">
              <p className="text-slate-300 leading-relaxed">
                We may update this Privacy Policy from time to time. Material changes will be communicated through the Platform or via email. Your continued use of the Platform after such changes constitutes acceptance of the updated policy.
              </p>
            </div>
          </section>

          {/* Contact */}
          <section className="bg-slate-900/30 border border-slate-800 rounded-xl p-8">
            <div className="flex items-center gap-3 mb-4">
              <Mail className="w-6 h-6 text-[#4FFFC8]" strokeWidth={2} />
              <h2 className="text-2xl font-black text-white">Questions About Privacy?</h2>
            </div>
            <p className="text-slate-300 leading-relaxed mb-6">
              If you have questions about this Privacy Policy or wish to exercise your privacy rights, please contact us.
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
