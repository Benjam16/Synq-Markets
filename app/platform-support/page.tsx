'use client';

import { motion } from 'framer-motion';
import { Headphones, Mail, MessageSquare, Clock, CheckCircle2, AlertCircle, Send } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

const supportChannels = [
  {
    icon: Mail,
    title: 'Email Support',
    description: 'Get detailed help via email. We typically respond within 24 hours.',
    contact: 'support@propmarket.com',
    responseTime: '24 hours',
    bestFor: 'Detailed questions, account issues, technical problems'
  },
  {
    icon: MessageSquare,
    title: 'Live Chat',
    description: 'Chat with our support team in real-time during business hours.',
    contact: 'Available in-app',
    responseTime: 'Immediate',
    bestFor: 'Quick questions, immediate assistance'
  },
  {
    icon: Headphones,
    title: 'Priority Support',
    description: 'Dedicated support for institutional clients and premium users.',
    contact: 'priority@propmarket.com',
    responseTime: '4 hours',
    bestFor: 'Institutional clients, urgent matters'
  }
];

const commonIssues = [
  {
    category: 'Account Issues',
    issues: [
      'Cannot log in to my account',
      'Forgot my password',
      'Account verification problems',
      'Need to update account information'
    ]
  },
  {
    category: 'Challenge Questions',
    issues: [
      'Understanding challenge rules',
      'Challenge failed unexpectedly',
      'Risk parameter questions',
      'Challenge fee refund requests'
    ]
  },
  {
    category: 'Trading & Technical',
    issues: [
      'Trades not executing',
      'Price data not updating',
      'Platform performance issues',
      'API integration help'
    ]
  },
  {
    category: 'Billing & Payments',
    issues: [
      'Payment processing errors',
      'Challenge fee questions',
      'Refund requests',
      'Billing inquiries'
    ]
  }
];

export default function PlatformSupportPage() {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    category: '',
    subject: '',
    message: ''
  });
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // In a real app, this would send to an API
    console.log('Support request:', formData);
    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      setFormData({ name: '', email: '', category: '', subject: '', message: '' });
    }, 3000);
  };

  return (
    <div className="min-h-screen bg-[#050505] flex flex-col items-center overflow-x-hidden selection:bg-[#4FFFC8] selection:text-black relative">
      <div className="fixed inset-0 pointer-events-none z-0 opacity-[0.02]" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
      }} />

      <main className="w-full max-w-6xl mx-auto px-6 py-32 relative z-10">
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
              <Headphones className="w-8 h-8 text-[#4FFFC8]" strokeWidth={1.5} />
            </div>
            <div>
              <h1 className="text-5xl font-black tracking-tighter text-white mb-2">
                Platform Support
              </h1>
              <p className="text-slate-400 text-sm">We're here to help 24/7</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="space-y-12"
        >
          {/* Support Channels */}
          <section>
            <h2 className="text-3xl font-black text-white mb-8 tracking-tight">Contact Support</h2>
            <div className="grid md:grid-cols-3 gap-6">
              {supportChannels.map((channel, idx) => (
                <div key={idx} className="bg-slate-900/30 border border-slate-800 rounded-xl p-8">
                  <channel.icon className="w-8 h-8 text-[#4FFFC8] mb-4" strokeWidth={1.5} />
                  <h3 className="text-xl font-bold text-white mb-2">{channel.title}</h3>
                  <p className="text-slate-400 text-sm mb-4">{channel.description}</p>
                  <div className="space-y-2 mb-4">
                    <div className="flex items-center gap-2 text-slate-300 text-sm">
                      <Mail className="w-4 h-4 text-[#4FFFC8]" />
                      <span>{channel.contact}</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-300 text-sm">
                      <Clock className="w-4 h-4 text-[#4FFFC8]" />
                      <span>Response: {channel.responseTime}</span>
                    </div>
                  </div>
                  <p className="text-slate-500 text-xs italic">{channel.bestFor}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Common Issues */}
          <section>
            <h2 className="text-3xl font-black text-white mb-8 tracking-tight">Common Issues</h2>
            <div className="grid md:grid-cols-2 gap-6">
              {commonIssues.map((category, idx) => (
                <div key={idx} className="bg-slate-900/30 border border-slate-800 rounded-xl p-6">
                  <h3 className="text-lg font-bold text-white mb-4">{category.category}</h3>
                  <ul className="space-y-2">
                    {category.issues.map((issue, issueIdx) => (
                      <li key={issueIdx} className="text-slate-400 text-sm flex items-start gap-2">
                        <span className="text-[#4FFFC8] mt-1">•</span>
                        <span>{issue}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>

          {/* Support Form */}
          <section>
            <h2 className="text-3xl font-black text-white mb-8 tracking-tight">Send Us a Message</h2>
            {submitted ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-green-500/10 border border-green-500/30 rounded-xl p-8 text-center"
              >
                <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-white mb-2">Message Sent!</h3>
                <p className="text-slate-300">We'll get back to you as soon as possible.</p>
              </motion.div>
            ) : (
              <form onSubmit={handleSubmit} className="bg-slate-900/30 border border-slate-800 rounded-xl p-8 space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-bold text-white mb-2">Name *</label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-900/50 border border-slate-800 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-[#4FFFC8]/50 transition-colors"
                      placeholder="Your name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-white mb-2">Email *</label>
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-900/50 border border-slate-800 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-[#4FFFC8]/50 transition-colors"
                      placeholder="your@email.com"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-white mb-2">Category *</label>
                  <select
                    required
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-900/50 border border-slate-800 rounded-lg text-white focus:outline-none focus:border-[#4FFFC8]/50 transition-colors"
                  >
                    <option value="">Select a category</option>
                    <option value="account">Account Issues</option>
                    <option value="challenge">Challenge Questions</option>
                    <option value="trading">Trading & Technical</option>
                    <option value="billing">Billing & Payments</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-bold text-white mb-2">Subject *</label>
                  <input
                    type="text"
                    required
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-900/50 border border-slate-800 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-[#4FFFC8]/50 transition-colors"
                    placeholder="Brief description of your issue"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-white mb-2">Message *</label>
                  <textarea
                    required
                    rows={6}
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-900/50 border border-slate-800 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-[#4FFFC8]/50 transition-colors resize-none"
                    placeholder="Please provide as much detail as possible about your issue..."
                  />
                </div>

                <button
                  type="submit"
                  className="w-full px-6 py-4 bg-[#4FFFC8] text-black font-bold rounded-lg hover:bg-[#4FFFC8]/90 transition-colors flex items-center justify-center gap-2"
                >
                  <Send className="w-5 h-5" />
                  Send Message
                </button>
              </form>
            )}
          </section>

          {/* Helpful Links */}
          <section>
            <h2 className="text-3xl font-black text-white mb-8 tracking-tight">Helpful Resources</h2>
            <div className="grid md:grid-cols-3 gap-4">
              <Link href="/help-center" className="bg-slate-900/30 border border-slate-800 rounded-xl p-6 hover:border-[#4FFFC8]/30 transition-colors group">
                <h3 className="text-lg font-bold text-white mb-2 group-hover:text-[#4FFFC8] transition-colors">Help Center</h3>
                <p className="text-slate-400 text-sm">Browse our FAQ and documentation</p>
              </Link>
              
              <Link href="/risk-disclosure" className="bg-slate-900/30 border border-slate-800 rounded-xl p-6 hover:border-[#4FFFC8]/30 transition-colors group">
                <h3 className="text-lg font-bold text-white mb-2 group-hover:text-[#4FFFC8] transition-colors">Risk Disclosure</h3>
                <p className="text-slate-400 text-sm">Understand trading risks</p>
              </Link>
              
              <Link href="/institutional-relations" className="bg-slate-900/30 border border-slate-800 rounded-xl p-6 hover:border-[#4FFFC8]/30 transition-colors group">
                <h3 className="text-lg font-bold text-white mb-2 group-hover:text-[#4FFFC8] transition-colors">Institutional Relations</h3>
                <p className="text-slate-400 text-sm">Partnership opportunities</p>
              </Link>
            </div>
          </section>

          {/* Response Times */}
          <section className="bg-slate-900/30 border border-slate-800 rounded-xl p-8">
            <div className="flex items-center gap-3 mb-4">
              <Clock className="w-6 h-6 text-[#4FFFC8]" strokeWidth={2} />
              <h2 className="text-2xl font-black text-white">Response Times</h2>
            </div>
            <div className="space-y-3 text-slate-300">
              <div className="flex justify-between items-center">
                <span>General Inquiries</span>
                <span className="text-[#4FFFC8] font-bold">24 hours</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Technical Issues</span>
                <span className="text-[#4FFFC8] font-bold">12 hours</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Account Issues</span>
                <span className="text-[#4FFFC8] font-bold">6 hours</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Priority Support</span>
                <span className="text-[#4FFFC8] font-bold">4 hours</span>
              </div>
            </div>
          </section>
        </motion.div>
      </main>
    </div>
  );
}
