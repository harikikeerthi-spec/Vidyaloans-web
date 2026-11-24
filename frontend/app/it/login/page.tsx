"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useSiteSettings } from "@/contexts/SiteSettingsContext";
import { itApi } from "@/lib/api";

export default function ITLoginPage() {
    const router = useRouter();
    const { login } = useAuth();
    const { settings: siteSettings } = useSiteSettings();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        const cleanEmail = email.trim().toLowerCase();
        if (!cleanEmail) {
            setError("Please enter your registered email address.");
            return;
        }
        if (!password) {
            setError("Please enter your account password.");
            return;
        }

        setLoading(true);
        try {
            const res: any = await itApi.login(cleanEmail, password);
            if (res && res.success && res.access_token) {
                // Register session in AuthContext
                login(res.access_token, {
                    ...res.user,
                    refresh_token: res.refresh_token,
                });

                // Set dedicated IT access token in localStorage, sessionStorage, and cookies for persistent access
                if (typeof window !== "undefined") {
                    localStorage.setItem("itAccessToken", res.access_token);
                    sessionStorage.setItem("itAccessToken", res.access_token);
                    localStorage.setItem("staffAccessToken", res.access_token);
                    sessionStorage.setItem("staffAccessToken", res.access_token);

                    if (res.refresh_token) {
                        localStorage.setItem("itRefreshToken", res.refresh_token);
                        sessionStorage.setItem("itRefreshToken", res.refresh_token);
                        localStorage.setItem("staffRefreshToken", res.refresh_token);
                        sessionStorage.setItem("staffRefreshToken", res.refresh_token);
                    }
                    localStorage.setItem("itUserEmail", cleanEmail);
                    if (res.user?.id) {
                        localStorage.setItem("itUserId", res.user.id);
                    }
                    localStorage.setItem("itAuthUser", JSON.stringify(res.user));
                    document.cookie = `itAccessToken=${res.access_token}; path=/; max-age=2592000; SameSite=Lax`;
                    document.cookie = `staffAccessToken=${res.access_token}; path=/; max-age=2592000; SameSite=Lax`;
                    if (res.refresh_token) {
                        document.cookie = `itRefreshToken=${res.refresh_token}; path=/; max-age=604800; SameSite=Lax`;
                        document.cookie = `staffRefreshToken=${res.refresh_token}; path=/; max-age=604800; SameSite=Lax`;
                    }
                }

                // Redirect to IT dashboard
                router.replace("/it");
            } else {
                setError(res?.message || "Invalid credentials. Please verify your email and password.");
            }
        } catch (err: any) {
            console.error("IT Login Error:", err);
            setError(err?.message || "Invalid credentials or unauthorized IT access. Please check your details.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#f8f9ff] text-slate-900 flex flex-col justify-center items-center p-4 relative overflow-hidden font-sans bg-mesh-gradient">
            {/* Background ambient glowing gradients matching user dashboard */}
            <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-[#6605c7]/12 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute top-[20%] right-[-10%] w-[450px] h-[450px] bg-amber-400/12 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-[-10%] left-[20%] w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none" />

            <div className="w-full max-w-md relative z-10">
                {/* Brand Header */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#6605c7] to-[#8b5cf6] shadow-xl shadow-purple-500/25 mb-4 border border-white/40">
                        <span className="material-symbols-outlined text-white text-3xl">terminal</span>
                    </div>
                    <div>
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#6605c7]/10 border border-[#6605c7]/20 text-[#6605c7] text-xs font-bold tracking-wide uppercase mb-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                            IT Operations Command Portal
                        </div>
                    </div>
                    <h1 className="text-2xl font-black tracking-tight text-slate-900">
                        {siteSettings?.siteName || "VidyaLoans"} <span className="text-[#6605c7]">IT Access</span>
                    </h1>
                    <p className="text-slate-500 text-xs mt-1 font-medium">
                        Sign in with your IT department email and administrator-assigned password
                    </p>
                </div>

                {/* Login Card matching user dashboard glass style */}
                <div className="bg-white/90 backdrop-blur-2xl border border-white/80 rounded-3xl p-6 sm:p-8 shadow-[0_20px_50px_rgba(102,5,199,0.08)]">
                    {error && (
                        <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-3">
                            <span className="material-symbols-outlined text-rose-500 text-lg flex-shrink-0 mt-0.5">error</span>
                            <div className="text-xs text-rose-700 leading-relaxed font-semibold">
                                {error}
                            </div>
                        </div>
                    )}

                    <form onSubmit={handleLogin} className="space-y-5">
                        {/* Email Field */}
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                                IT Account Email
                            </label>
                            <div className="relative">
                                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-lg">
                                    mail
                                </span>
                                <input
                                    type="email"
                                    required
                                    autoComplete="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="it.admin@vidyaloans.com"
                                    className="w-full bg-slate-50/80 border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-[#6605c7] focus:ring-1 focus:ring-[#6605c7] transition-all font-medium"
                                />
                            </div>
                        </div>

                        {/* Password Field */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                                    Password
                                </label>
                            </div>
                            <div className="relative">
                                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-lg">
                                    lock
                                </span>
                                <input
                                    type={showPassword ? "text" : "password"}
                                    required
                                    autoComplete="current-password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••••••"
                                    className="w-full bg-slate-50/80 border border-slate-200 rounded-xl pl-10 pr-11 py-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-[#6605c7] focus:ring-1 focus:ring-[#6605c7] transition-all"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-1 cursor-pointer"
                                    title={showPassword ? "Hide password" : "Show password"}
                                >
                                    <span className="material-symbols-outlined text-lg">
                                        {showPassword ? "visibility_off" : "visibility"}
                                    </span>
                                </button>
                            </div>
                        </div>

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-[#6605c7] to-[#8b5cf6] hover:from-[#5504a6] hover:to-[#7c3aed] text-white font-bold text-sm shadow-lg shadow-purple-600/25 hover:shadow-purple-600/35 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed mt-2"
                        >
                            {loading ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                    <span>Verifying Credentials...</span>
                                </>
                            ) : (
                                <>
                                    <span>Sign In to IT Dashboard</span>
                                    <span className="material-symbols-outlined text-lg">arrow_forward</span>
                                </>
                            )}
                        </button>
                    </form>

                    {/* Notice */}
                    <div className="mt-6 pt-6 border-t border-slate-100 text-center">
                        <p className="text-[11px] text-slate-400 leading-relaxed font-medium">
                            Access restricted to authorized technical operations personnel. All authentication attempts and dashboard actions are logged and audited.
                        </p>
                    </div>
                </div>

                {/* Back to Home */}
                <div className="text-center mt-6">
                    <Link
                        href="/"
                        className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-[#6605c7] font-semibold transition-colors"
                    >
                        <span className="material-symbols-outlined text-sm">west</span>
                        <span>Back to Main Website</span>
                    </Link>
                </div>
            </div>
        </div>
    );
}
