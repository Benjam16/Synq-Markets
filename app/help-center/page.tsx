'use client';

import { motion } from 'framer-motion';
import { HelpCircle, Book, MessageCircle, Search, ChevronRight, FileText, Video, Mail } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

const faqCategories = [
  {
    title: 'Getting Started',
    icon: Book,
    questions: [
      {
        q: 'How do I create an account?',
        a: 'Click "Get Started" or "Login" in the top navigation, then select "Sign up" to create your account. You\'ll need a valid email address and will be asked to create a secure password.'
      },
      {
        q: 'What is a challenge?',
        a: 'A challenge is a simulated trading evaluation that tests your skills in prediction markets. You start with a virtual account balance and must meet specific profit targets while staying within risk parameters like daily drawdown limits.'
      },
      {
        q: 'How do I purchase a challenge?',
        a: 'Navigate to the Challenges page, select your desired tier (Scout, Analyst, Strategist, or Whale), and click "Purchase Challenge". You\'ll be prompted to pay the challenge fee, after which your evaluation period begins immediately.'
      }
    ]
  },
  {
    title: 'Trading & Challenges',
    icon: FileText,
    questions: [
      {
        q: 'What are the risk parameters?',
        a: 'Each challenge has three key risk parameters: Maximum Daily Drawdown (typically 5%), Maximum Total Drawdown (typically 10%), and Maximum Position Size (typically 20% of equity). Exceeding any of these will result in challenge failure.'
      },
      {
        q: 'How long do challenges last?',
        a: 'Challenges have a minimum trading period of 30 days. You must maintain profitable trading throughout this entire period while staying within all risk parameters to pass.'
      },
      {
        q: 'Can I restart a failed challenge?',
        a: 'No, failed challenges cannot be restarted. If you fail a challenge, you must purchase a new one to continue. Challenge fees are non-refundable.'
      },
      {
        q: 'What happens when I pass a challenge?',
        a: 'Upon passing a challenge, you become eligible for funding consideration. Additional verification and compliance checks may be required. Passing does not guarantee funding, which is subject to our discretion and additional terms.'
      }
    ]
  },
  {
    title: 'Account & Billing',
    icon: MessageCircle,
    questions: [
      {
        q: 'Are challenge fees refundable?',
        a: 'No, challenge fees are non-refundable under any circumstances, including challenge failure, technical issues, or voluntary withdrawal.'
      },
      {
        q: 'How do I update my account information?',
        a: 'You can update your account information, including email and password, through your account settings in the Dashboard or Accounts page.'
      },
      {
        q: 'What payment methods do you accept?',
        a: 'We accept major credit cards and other payment methods through our secure payment processor. All transactions are encrypted and processed securely.'
      }
    ]
  }
];

export default function HelpCenterPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedQuestion, setExpandedQuestion] = useState<number | null>(null);

  const allQuestions = faqCategories.flatMap((category, catIdx) =>
    category.questions.map((item, qIdx) => ({
      ...item,
      category: category.title,
      id: catIdx * 100 + qIdx
    }))
  );

  const filteredQuestions = searchQuery
    ? allQuestions.filter(q => 
        q.q.toLowerCase().includes(searchQuery.toLowerCase()) ||
        q.a.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : allQuestions;

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
          
          <div className="flex items-center gap-4 mb-8">
            <div className="w-16 h-16 bg-slate-900/50 border border-[#4FFFC8]/20 rounded-xl flex items-center justify-center">
              <HelpCircle className="w-8 h-8 text-[#4FFFC8]" strokeWidth={1.5} />
            </div>
            <div>
              <h1 className="text-5xl font-black tracking-tighter text-white mb-2">
                Help Center
              </h1>
              <p className="text-slate-400 text-sm">Find answers to common questions and get support</p>
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative mb-12">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search for help..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-4 bg-slate-900/50 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-[#4FFFC8]/50 transition-colors"
            />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="space-y-12"
        >
          {/* Quick Links */}
          <section>
            <h2 className="text-2xl font-black text-white mb-6 tracking-tight">Quick Links</h2>
            <div className="grid md:grid-cols-3 gap-4">
              <Link href="/risk-disclosure" className="bg-slate-900/30 border border-slate-800 rounded-xl p-6 hover:border-[#4FFFC8]/30 transition-colors group">
                <FileText className="w-6 h-6 text-[#4FFFC8] mb-3" />
                <h3 className="text-lg font-bold text-white mb-2 group-hover:text-[#4FFFC8] transition-colors">Risk Disclosure</h3>
                <p className="text-slate-400 text-sm">Understand the risks involved in trading</p>
              </Link>
              
              <Link href="/terms-of-service" className="bg-slate-900/30 border border-slate-800 rounded-xl p-6 hover:border-[#4FFFC8]/30 transition-colors group">
                <FileText className="w-6 h-6 text-[#4FFFC8] mb-3" />
                <h3 className="text-lg font-bold text-white mb-2 group-hover:text-[#4FFFC8] transition-colors">Terms of Service</h3>
                <p className="text-slate-400 text-sm">Read our terms and conditions</p>
              </Link>
              
              <Link href="/platform-support" className="bg-slate-900/30 border border-slate-800 rounded-xl p-6 hover:border-[#4FFFC8]/30 transition-colors group">
                <Mail className="w-6 h-6 text-[#4FFFC8] mb-3" />
                <h3 className="text-lg font-bold text-white mb-2 group-hover:text-[#4FFFC8] transition-colors">Contact Support</h3>
                <p className="text-slate-400 text-sm">Get direct help from our team</p>
              </Link>
            </div>
          </section>

          {/* FAQ Categories */}
          {!searchQuery && (
            <div className="space-y-12">
              {faqCategories.map((category, catIdx) => (
                <section key={catIdx}>
                  <div className="flex items-center gap-3 mb-6">
                    <category.icon className="w-6 h-6 text-[#4FFFC8]" strokeWidth={2} />
                    <h2 className="text-3xl font-black text-white tracking-tight">{category.title}</h2>
                  </div>
                  <div className="space-y-4">
                    {category.questions.map((item, qIdx) => {
                      const questionId = catIdx * 100 + qIdx;
                      const isExpanded = expandedQuestion === questionId;
                      return (
                        <div
                          key={qIdx}
                          className="bg-slate-900/30 border border-slate-800 rounded-xl overflow-hidden"
                        >
                          <button
                            onClick={() => setExpandedQuestion(isExpanded ? null : questionId)}
                            className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-slate-900/50 transition-colors"
                          >
                            <span className="text-white font-bold pr-4">{item.q}</span>
                            <ChevronRight
                              className={`w-5 h-5 text-slate-400 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                            />
                          </button>
                          {isExpanded && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              className="px-6 py-4 border-t border-slate-800"
                            >
                              <p className="text-slate-300 leading-relaxed">{item.a}</p>
                            </motion.div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          )}

          {/* Search Results */}
          {searchQuery && (
            <section>
              <h2 className="text-2xl font-black text-white mb-6 tracking-tight">
                Search Results {filteredQuestions.length > 0 && `(${filteredQuestions.length})`}
              </h2>
              {filteredQuestions.length > 0 ? (
                <div className="space-y-4">
                  {filteredQuestions.map((item) => {
                    const questionId = item.id;
                    const isExpanded = expandedQuestion === questionId;
                    return (
                      <div
                        key={questionId}
                        className="bg-slate-900/30 border border-slate-800 rounded-xl overflow-hidden"
                      >
                        <div className="px-6 py-3 bg-slate-900/50 border-b border-slate-800">
                          <span className="text-xs text-[#4FFFC8] font-bold uppercase tracking-wide">{item.category}</span>
                        </div>
                        <button
                          onClick={() => setExpandedQuestion(isExpanded ? null : questionId)}
                          className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-slate-900/50 transition-colors"
                        >
                          <span className="text-white font-bold pr-4">{item.q}</span>
                          <ChevronRight
                            className={`w-5 h-5 text-slate-400 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                          />
                        </button>
                        {isExpanded && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="px-6 py-4 border-t border-slate-800"
                          >
                            <p className="text-slate-300 leading-relaxed">{item.a}</p>
                          </motion.div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="bg-slate-900/30 border border-slate-800 rounded-xl p-8 text-center">
                  <p className="text-slate-400 mb-4">No results found for "{searchQuery}"</p>
                  <p className="text-slate-500 text-sm">Try different keywords or contact support for assistance.</p>
                </div>
              )}
            </section>
          )}

          {/* Still Need Help */}
          <section className="bg-slate-900/30 border border-slate-800 rounded-xl p-8">
            <div className="flex items-center gap-3 mb-4">
              <MessageCircle className="w-6 h-6 text-[#4FFFC8]" strokeWidth={2} />
              <h2 className="text-2xl font-black text-white">Still Need Help?</h2>
            </div>
            <p className="text-slate-300 leading-relaxed mb-6">
              Can't find what you're looking for? Our support team is here to help you 24/7.
            </p>
            <Link 
              href="/platform-support" 
              className="inline-flex items-center gap-2 px-6 py-3 bg-[#4FFFC8] text-black font-bold rounded-lg hover:bg-[#4FFFC8]/90 transition-colors"
            >
              Contact Support
              <ChevronRight className="w-4 h-4" />
            </Link>
          </section>
        </motion.div>
      </main>
    </div>
  );
}
