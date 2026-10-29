"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Lock, Mail, Eye, EyeOff, ShieldCheck, ArrowRight, AlertCircle, Sparkles, ArrowLeft } from "lucide-react";

export default function WebmailLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    const cleanEmail = email.trim().toLowerCase();
    const cleanPass = password.trim();

    if (!cleanEmail) {
      setErrorMsg("Please enter your official email address.");
      return;
    }
    if (!cleanPass) {
      setErrorMsg("Please enter your password.");
      return;
    }

    setLoading(true);

    try {
      // Fetch CSRF token
      let csrfToken = "";
      try {
        const csrfRes = await fetch("/api/csrf-token");
        const csrfJson = await csrfRes.json();
        if (csrfJson?.csrfToken) csrfToken = csrfJson.csrfToken;
      } catch (e) { }

      const res = await fetch("/api/webmail/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
        },
        body: JSON.stringify({ email: cleanEmail, password: cleanPass }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.success) {
        throw new Error(data?.message || "Invalid email or password. Access is strictly restricted to higher officials.");
      }

      // Save token and profile to localStorage
      if (typeof window !== "undefined") {
        localStorage.setItem("vidyaloans_webmail_token", data.token);
        localStorage.setItem("vidyaloans_webmail_user", JSON.stringify(data.user));
      }

      // Redirect to Webmail interface
      router.push("/webmail");
    } catch (err: any) {
      console.error("Webmail login error:", err);
      setErrorMsg(err.message || "Failed to authenticate. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-transparent text-slate-900 flex flex-col justify-between relative selection:bg-purple-100 selection:text-purple-900 overflow-hidden font-sans">

      {/* Signature VidyaLoans Multi-Radial Background */}
      <div className="fixed inset-0 -z-10 bg-white pointer-events-none overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(at_0%_0%,rgba(102,5,199,0.38)_0px,transparent_50%),radial-gradient(at_100%_0%,rgba(224,195,137,0.45)_0px,transparent_50%),radial-gradient(at_100%_100%,rgba(139,192,232,0.38)_0px,transparent_50%),radial-gradient(at_0%_100%,rgba(102,5,199,0.28)_0px,transparent_50%)] opacity-95" />
        <div
          className="absolute inset-0 opacity-25 mix-blend-overlay"
          style={{
            backgroundImage:
              'url("https://lh3.googleusercontent.com/aida-public/AB6AXuCSQJcRexkqlKu3kzwZCWIGdx9mSdhvK4Je6lxA9kVrWHQFg-ShCu6j3XLipgBh0waP45VYm3rBVD2Psy-FTMp2qLU946EXQwD2sIGZJLe5tw2ugWPYnnOTMWoTGM95X4u1epiDmYaEV_vVdH7tyv2ZlDuFjSMZlzWulHW3UyesMipUWi30MryHEiz-_Lje83ApXK-FpMUQdIEWe0M_ZFfiu3BcH1_opus8b5qOTiMh8tMBAX7ifzSLR_qpWnWtdB8obUzknDxLtfeP")',
            backgroundSize: "cover",
          }}
        />
        {/* Ambient depth glows */}
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[720px] h-[360px] bg-gradient-to-b from-purple-300/30 via-indigo-200/20 to-transparent rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-1/2 right-[-10%] w-[420px] h-[420px] bg-purple-300/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[420px] h-[420px] bg-indigo-300/15 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Top Header */}
      <header className="relative z-10 w-full max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3 group transition-transform hover:scale-[1.01]">
          <Image
            src="/images/vidyaloans-logo-transparent.png"
            alt="VidyaLoans"
            width={42}
            height={42}
            className="w-10 h-10 object-contain drop-shadow-sm"
            priority
          />
          <div className="flex flex-col">
            <span className="font-extrabold text-xl tracking-tight text-[#1a1626] flex items-center gap-2">
              VidyaLoans
              <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-purple-100 text-[#6605c7] border border-purple-200">
                Official Webmail
              </span>
            </span>
            <span className="text-[10px] font-semibold text-purple-700 uppercase tracking-wider -mt-0.5">
              Executive Communication Gateway
            </span>
          </div>
        </Link>

        <div className="flex items-center gap-3">
          <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-white/80 text-emerald-700 border border-emerald-200/60 shadow-xs backdrop-blur-md">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Encrypted Corporate Mailbox
          </span>

          <Link
            href="/"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold text-slate-700 bg-white/80 hover:bg-white backdrop-blur-md border border-white/80 shadow-xs transition-all hover:shadow-sm"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-slate-600" />
            <span>Back to Home</span>
          </Link>
        </div>
      </header>

      {/* Main Login Card */}
      <main className="relative z-10 w-full max-w-md mx-auto px-6 py-8 my-auto">
        <div className="bg-white/92 backdrop-blur-2xl rounded-3xl p-8 sm:p-9 border border-white/80 shadow-[0_20px_60px_rgba(102,5,199,0.09)] transition-all">

          {/* Badge */}
          {/* <div className="flex items-center justify-center mb-5">
            <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold bg-purple-50 text-[#6605c7] border border-purple-200/80 shadow-xs">
              <ShieldCheck className="w-4 h-4 text-[#6605c7]" />
              <span>Higher Officials Portal</span>
            </div>
          </div> */}

          <div className="text-center mb-7">
            <h1 className="text-2xl font-black tracking-tight text-[#1a1626]">
              Executive Mail Login
            </h1>
            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
              Sign in with your official VidyaLoans mailbox credentials to access and send corporate communications.
            </p>
          </div>

          {/* Error Alert */}
          {errorMsg && (
            <div className="mb-5 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-start gap-2.5 animate-in fade-in duration-200">
              <AlertCircle className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" />
              <span className="leading-snug">{errorMsg}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                Official Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. official@vidyaloans.in"
                  required
                  autoFocus
                  className="w-full pl-10 pr-4 py-3 bg-slate-50/70 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#6605c7] focus:bg-white focus:ring-2 focus:ring-purple-100 transition-all"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Password
                </label>
                <span className="text-[11px] font-semibold text-purple-700">Protected</span>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your confidential password"
                  required
                  className="w-full pl-10 pr-11 py-3 bg-slate-50/70 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#6605c7] focus:bg-white focus:ring-2 focus:ring-purple-100 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-3 py-3.5 px-4 rounded-xl bg-gradient-to-r from-[#6605c7] via-[#7000FF] to-[#4318FF] hover:brightness-105 active:scale-[0.99] text-white font-bold text-sm shadow-md shadow-purple-600/25 flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Authenticating...</span>
                </>
              ) : (
                <>
                  <span>Sign In to Webmail</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Security Notice */}
          <div className="mt-6 pt-5 border-t border-slate-100 text-center">
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Strictly restricted to authorized leadership. All mail sessions are isolated, logged, and monitored for compliance.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 w-full max-w-6xl mx-auto px-6 py-6 text-center text-xs text-slate-500 font-medium">
        &copy; {new Date().getFullYear()} VidyaLoans Higher Officials Webmail System. All rights reserved.
      </footer>
    </div>
  );
}
