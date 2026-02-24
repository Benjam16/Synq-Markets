"use client";

import { useEffect, useState } from "react";
import { useAuth } from "../components/AuthProvider";
import { ProtectedRoute } from "../components/ProtectedRoute";
import { motion } from "framer-motion";
import { 
  ArrowLeft,
  Copy,
  CheckCircle2,
  Loader2
} from "lucide-react";
import { toast } from "react-hot-toast";
import Link from "next/link";

function PortalContent() {
  const { user } = useAuth();
  const [dbUserId, setDbUserId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  
  // Profile state
  const [fullName, setFullName] = useState("");
  const [paypalEmail, setPaypalEmail] = useState("");
  const [currentEmail, setCurrentEmail] = useState("");
  
  // Password state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  
  // Support state
  const [supportSubject, setSupportSubject] = useState("");
  const [supportMessage, setSupportMessage] = useState("");
  const [sendingSupport, setSendingSupport] = useState(false);

  // Get user data
  useEffect(() => {
    const loadUserData = async () => {
      if (!user?.email) {
        setLoading(false);
        return;
      }

      // Set email immediately from auth user (fallback)
      setCurrentEmail(user.email);

      try {
        // Get database user ID
        const getUserRes = await fetch(`/api/user?email=${encodeURIComponent(user.email)}`);
        if (getUserRes.ok) {
          const { user: dbUser } = await getUserRes.json();
          if (dbUser) {
            setDbUserId(dbUser.id);
            setFullName(dbUser.full_name || "");
            setPaypalEmail(dbUser.paypal_email || "");
            // Use database email if available, otherwise use auth email
            setCurrentEmail(dbUser.email || user.email);
          }
        } else {
          // If user doesn't exist in DB, try to create them
          console.log("[Portal] User not found in database, attempting to create...");
          const createRes = await fetch('/api/user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              supabaseUserId: user.id,
              email: user.email,
              fullName: user.user_metadata?.full_name || user.email.split('@')[0],
            }),
          });
          
          if (createRes.ok) {
            const { userId } = await createRes.json();
            setDbUserId(userId);
          }
        }
      } catch (error) {
        console.error("Failed to load user data:", error);
        // Even on error, we have the email from auth
        setCurrentEmail(user.email);
      } finally {
        setLoading(false);
      }
    };

    loadUserData();
  }, [user]);

  const handleCopyUserId = () => {
    if (dbUserId) {
      navigator.clipboard.writeText(String(dbUserId));
      setCopied(true);
      toast.success("User ID copied to clipboard", {
        style: {
          background: "#10b981",
          color: "#ffffff",
          border: "1px solid #059669",
        },
      });
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dbUserId) return;

    setSaving(true);
    try {
      const res = await fetch("/api/portal/update-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: dbUserId,
          fullName,
          paypalEmail,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        toast.success("Profile updated successfully", {
          style: {
            background: "#10b981",
            color: "#ffffff",
            border: "1px solid #059669",
          },
        });
      } else {
        toast.error(data.error || "Failed to update profile", {
          style: {
            background: "#ef4444",
            color: "#ffffff",
            border: "1px solid #dc2626",
          },
        });
      }
    } catch (error) {
      console.error("Error updating profile:", error);
      toast.error("Failed to update profile", {
        style: {
          background: "#ef4444",
          color: "#ffffff",
          border: "1px solid #dc2626",
        },
      });
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match", {
        style: {
          background: "#ef4444",
          color: "#ffffff",
          border: "1px solid #dc2626",
        },
      });
      return;
    }

    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters", {
        style: {
          background: "#ef4444",
          color: "#ffffff",
          border: "1px solid #dc2626",
        },
      });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/portal/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newPassword,
          userEmail: currentEmail,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        toast.success("Password changed successfully", {
          style: {
            background: "#10b981",
            color: "#ffffff",
            border: "1px solid #059669",
          },
        });
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        toast.error(data.error || "Failed to change password", {
          style: {
            background: "#ef4444",
            color: "#ffffff",
            border: "1px solid #dc2626",
          },
        });
      }
    } catch (error) {
      console.error("Error changing password:", error);
      toast.error("Failed to change password", {
        style: {
          background: "#ef4444",
          color: "#ffffff",
          border: "1px solid #dc2626",
        },
      });
    } finally {
      setSaving(false);
    }
  };

  const handleContactSupport = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!supportSubject || !supportMessage) {
      toast.error("Please fill in all fields", {
        style: {
          background: "#ef4444",
          color: "#ffffff",
          border: "1px solid #dc2626",
        },
      });
      return;
    }

    setSendingSupport(true);
    try {
      const res = await fetch("/api/portal/contact-support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: dbUserId,
          email: currentEmail,
          subject: supportSubject,
          message: supportMessage,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        toast.success("Support request sent successfully", {
          style: {
            background: "#10b981",
            color: "#ffffff",
            border: "1px solid #059669",
          },
        });
        setSupportSubject("");
        setSupportMessage("");
      } else {
        toast.error(data.error || "Failed to send support request", {
          style: {
            background: "#ef4444",
            color: "#ffffff",
            border: "1px solid #dc2626",
          },
        });
      }
    } catch (error) {
      console.error("Error sending support request:", error);
      toast.error("Failed to send support request", {
        style: {
          background: "#ef4444",
          color: "#ffffff",
          border: "1px solid #dc2626",
        },
      });
    } finally {
      setSendingSupport(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="text-slate-500 text-sm">Loading portal...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505]">
      <div className="h-16" />
      <div className="max-w-7xl mx-auto px-6 py-12">
        {/* Header - Full Width */}
        <div className="mb-8">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-slate-500 hover:text-white transition-colors mb-4 text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Dashboard</span>
          </Link>
          <h1 className="text-2xl font-black text-white tracking-[-0.05em] uppercase mb-2">
            Client Portal
          </h1>
          <p className="text-slate-500 text-sm">
            Manage your account settings and contact support
          </p>
        </div>

        {/* 2-Column Bento Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column - Identity & Security */}
          <div className="flex flex-col gap-8">
            {/* Card 1: Profile Information */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-[#050505]/40 backdrop-blur-3xl border border-white/5 rounded-2xl p-6 hover:border-white/10 transition-colors flex flex-col"
            >
              <div className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mb-6">
                Profile Information
              </div>

              <form onSubmit={handleUpdateProfile} className="flex flex-col flex-1">
                <div className="space-y-4 flex-1">
                  <div>
                    <label className="block text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2">
                      Full Name
                    </label>
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full px-4 py-3 bg-white/[0.03] border border-white/10 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:border-[#4FFFC8] focus:shadow-[0_0_0_3px_rgba(79,255,200,0.1)] transition-all"
                      placeholder="Enter your full name"
                    />
                  </div>

                  <div>
                    <label className="block text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2">
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={currentEmail}
                      disabled
                      className="w-full px-4 py-3 bg-white/[0.02] border border-white/5 rounded-xl text-slate-500 cursor-not-allowed"
                    />
                    <p className="text-xs text-slate-500 mt-2">
                      Email cannot be changed. Contact support if you need to update it.
                    </p>
                  </div>

                  <div>
                    <label className="block text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2">
                      PayPal Email (for payouts)
                    </label>
                    <input
                      type="email"
                      value={paypalEmail}
                      onChange={(e) => setPaypalEmail(e.target.value)}
                      className="w-full px-4 py-3 bg-white/[0.03] border border-white/10 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:border-[#4FFFC8] focus:shadow-[0_0_0_3px_rgba(79,255,200,0.1)] transition-all"
                      placeholder="your-paypal@email.com"
                    />
                    <p className="text-xs text-slate-500 mt-2">
                      This email will be used for payout processing
                    </p>
                  </div>
                </div>

                <div className="flex justify-end mt-6">
                  <button
                    type="submit"
                    disabled={saving}
                    className="border border-[#4FFFC8]/20 text-[#4FFFC8] bg-[#4FFFC8]/5 px-6 py-3 rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-[#4FFFC8] hover:text-black transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin" />
                        <span>SAVING...</span>
                      </>
                    ) : (
                      <span>SAVE CHANGES</span>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>

            {/* Card 2: Security */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-[#050505]/40 backdrop-blur-3xl border border-white/5 rounded-2xl p-6 hover:border-white/10 transition-colors flex flex-col"
            >
              <div className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mb-6">
                Security
              </div>

              <form onSubmit={handleChangePassword} className="flex flex-col flex-1">
                <div className="space-y-4 flex-1">
                  <div>
                    <label className="block text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2">
                      Current Password
                    </label>
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="w-full px-4 py-3 bg-white/[0.03] border border-white/10 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:border-[#4FFFC8] focus:shadow-[0_0_0_3px_rgba(79,255,200,0.1)] transition-all"
                      placeholder="Enter current password"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2">
                      New Password
                    </label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full px-4 py-3 bg-white/[0.03] border border-white/10 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:border-[#4FFFC8] focus:shadow-[0_0_0_3px_rgba(79,255,200,0.1)] transition-all"
                      placeholder="Enter new password (min 6 characters)"
                      required
                      minLength={6}
                    />
                  </div>

                  <div>
                    <label className="block text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2">
                      Confirm New Password
                    </label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full px-4 py-3 bg-white/[0.03] border border-white/10 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:border-[#4FFFC8] focus:shadow-[0_0_0_3px_rgba(79,255,200,0.1)] transition-all"
                      placeholder="Confirm new password"
                      required
                      minLength={6}
                    />
                  </div>
                </div>

                <div className="flex justify-end mt-6">
                  <button
                    type="submit"
                    disabled={saving}
                    className="border border-[#4FFFC8]/20 text-[#4FFFC8] bg-[#4FFFC8]/5 px-6 py-3 rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-[#4FFFC8] hover:text-black transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin" />
                        <span>UPDATING...</span>
                      </>
                    ) : (
                      <span>UPDATE PASSWORD</span>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>

          {/* Right Column - Support & Metadata */}
          <div className="flex flex-col gap-8">
            {/* Card 3: Technical Metadata */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-[#050505]/40 backdrop-blur-3xl border border-white/5 rounded-2xl p-6 hover:border-white/10 transition-colors"
            >
              <div className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mb-6">
                Technical Metadata
              </div>
              <div className="space-y-4">
                <div>
                  <div className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2">
                    Email
                  </div>
                  <div className="text-sm text-white break-all font-mono">
                    {currentEmail || (user?.email || "Not available")}
                  </div>
                </div>
                <div>
                  <div className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2">
                    User ID
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-sm text-white font-mono">
                      {dbUserId ? String(dbUserId) : (loading ? "Loading..." : "Not assigned")}
                    </div>
                    {dbUserId && (
                      <button
                        onClick={handleCopyUserId}
                        className="p-1.5 text-slate-500 hover:text-[#4FFFC8] transition-colors"
                        title="Copy User ID"
                      >
                        {copied ? (
                          <CheckCircle2 className="w-4 h-4 text-[#4FFFC8]" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Card 4: Contact Support */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-[#050505]/40 backdrop-blur-3xl border border-white/5 rounded-2xl p-6 hover:border-white/10 transition-colors flex flex-col"
            >
              <div className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mb-6">
                Contact Support
              </div>

              <form onSubmit={handleContactSupport} className="flex flex-col flex-1">
                <div className="space-y-4 flex-1">
                  <div>
                    <label className="block text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2">
                      Subject
                    </label>
                    <input
                      type="text"
                      value={supportSubject}
                      onChange={(e) => setSupportSubject(e.target.value)}
                      className="w-full px-4 py-3 bg-white/[0.03] border border-white/10 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:border-[#4FFFC8] focus:shadow-[0_0_0_3px_rgba(79,255,200,0.1)] transition-all"
                      placeholder="What can we help you with?"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2">
                      Message
                    </label>
                    <textarea
                      value={supportMessage}
                      onChange={(e) => setSupportMessage(e.target.value)}
                      style={{ height: '180px' }}
                      className="w-full px-4 py-3 bg-white/[0.03] border border-white/10 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:border-[#4FFFC8] focus:shadow-[0_0_0_3px_rgba(79,255,200,0.1)] transition-all resize-none"
                      placeholder="Please provide details about your issue or question..."
                      required
                    />
                  </div>
                </div>

                <div className="flex justify-end mt-6">
                  <button
                    type="submit"
                    disabled={sendingSupport}
                    className="border border-[#4FFFC8]/20 text-[#4FFFC8] bg-[#4FFFC8]/5 px-6 py-3 rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-[#4FFFC8] hover:text-black transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {sendingSupport ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin" />
                        <span>SENDING...</span>
                      </>
                    ) : (
                      <span>SEND MESSAGE</span>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PortalPage() {
  return (
    <ProtectedRoute>
      <PortalContent />
    </ProtectedRoute>
  );
}
