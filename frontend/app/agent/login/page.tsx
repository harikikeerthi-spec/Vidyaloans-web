"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useSiteSettings } from "@/contexts/SiteSettingsContext";
import { authApi } from "@/lib/api";

// Allowed agent roles for accessing agent portal
const AGENT_ROLES = ['agent', 'partner_agent', 'admin', 'super_admin'] as const;

const isAgentRole = (role: string): boolean => {
    return AGENT_ROLES.includes(role as any);
};

function AgentLoginContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { login } = useAuth();
    const { settings: siteSettings } = useSiteSettings();

    const [email, setEmail] = useState("");
    const [otp, setOtp] = useState(["", "", "", "", "", ""]);
    const [step, setStep] = useState<"email" | "otp">("email");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [resendDisabled, setResendDisabled] = useState(false);
    const [countdown, setCountdown] = useState(0);
    const [agencyName, setAgencyName] = useState<string | null>(null);

    const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

    useEffect(() => {
        if (countdown > 0) {
            const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
            return () => clearTimeout(timer);
        } else {
            setResendDisabled(false);
        }
    }, [countdown]);

    const sendOtp = async () => {
        if (!email.trim()) { setError("Please enter your email"); return; }
        setLoading(true);
        setError("");
        try {
            const res = await authApi.requestOtp(email.trim(), "agent") as { success: boolean; otp?: string; userExists: boolean; businessName?: string; message?: string };
            
            if (!res || !res.success) {
                setError(res?.message || "Access Denied: Agent partner privileges required.");
                setLoading(false);
                return;
            }

            if (res.businessName) setAgencyName(res.businessName);
            setStep("otp");
            setResendDisabled(true);
            setCountdown(60);
            setTimeout(() => otpRefs.current[0]?.focus(), 100);
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : "Failed to send OTP");
        } finally {
            setLoading(false);
        }
    };

    const handleOtpChange = (index: number, value: string) => {
        const digit = value.replace(/\D/g, "").slice(-1);
        const newOtp = [...otp];
        newOtp[index] = digit;
        setOtp(newOtp);
        if (digit && index < 5) {
            otpRefs.current[index + 1]?.focus();
        }
    };

    const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
        if (e.key === "Backspace" && !otp[index] && index > 0) {
            otpRefs.current[index - 1]?.focus();
        }
    };

    const handleOtpPaste = (e: React.ClipboardEvent) => {
        e.preventDefault();
        const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
        const newOtp = [...otp];
        pasted.split("").forEach((c, i) => { newOtp[i] = c; });
        setOtp(newOtp);
        otpRefs.current[Math.min(pasted.length, 5)]?.focus();
    };

    const verifyOtp = async () => {
        const code = otp.join("");
        if (code.length !== 6) { setError("Please enter the 6-digit OTP"); return; }
        setLoading(true);
        setError("");
        try {
            const data = await authApi.verifyOtp(email.trim(), code) as {
                success: boolean;
                access_token: string;
                role: string;
                firstName?: string;
                lastName?: string;
            };

            if (data.success === false || !data.access_token) {
                throw new Error((data as any).message || "Invalid OTP. Please enter the right one to login.");
            }

            // Check if user has agent-level access
            if (!isAgentRole(data.role)) {
                throw new Error(
                    "Access Denied: You do not have agent privileges. Please contact the administrator to grant you access to the Agent Portal."
                );
            }

            login(data.access_token, {
                email: email.trim(),
                firstName: data.firstName,
                lastName: data.lastName,
                role: data.role as any,
                refresh_token: (data as any).refresh_token
            });

            const redirectTo = searchParams.get("redirect");
            router.push(redirectTo ? decodeURIComponent(redirectTo) : "/agent");
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : "Invalid OTP");
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (step === "email") sendOtp();
        else verifyOtp();
    };

    return (
        <div className="min-h-screen flex items-center justify-center px-4 relative bg-[#fafafa] overflow-hidden font-sans">
            {/* Background elements */}
            <div className="absolute inset-0 bg-[radial-gradient(at_0%_0%,rgba(102,5,199,0.05)_0px,transparent_50%),radial-gradient(at_100%_0%,rgba(224,195,137,0.06)_0px,transparent_50%),radial-gradient(at_100%_100%,rgba(139,192,232,0.05)_0px,transparent_50%),radial-gradient(at_0%_100%,rgba(102,5,199,0.03)_0px,transparent_50%)] opacity-90 pointer-events-none" />
            
            {/* Soft decorative blur circles */}
            <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-indigo-600/5 blur-[120px] pointer-events-none" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] rounded-full bg-purple-600/5 blur-[120px] pointer-events-none" />

            <div className="relative z-10 w-full max-w-md">
                {/* Logo & Header */}
                <div className="text-center mb-8">
                    <Link href="/" className="inline-flex items-center justify-center mb-6 group">
                        <div className="flex items-center gap-2 group-hover:scale-105 transition-all duration-300">
                            {/* Vidyaloans Logo */}
                            <div className="w-12 h-12 rounded-2xl bg-white border border-[#6605c7]/10 flex items-center justify-center shadow-sm">
                                <img
                                    src={siteSettings?.logoLightUrl || "/images/vidyaloans-logo-transparent.png"}
                                    alt={`${siteSettings?.siteName || "VidyaLoans"} Logo`}
                                    className="w-9 h-9 object-contain"
                                />
                            </div>
                            
                            {/* Handshake connector */}
                            <span className="material-symbols-outlined text-[#6605c7]/50 text-xl font-light">handshake</span>
                            
                            {/* Support Agent (Partner) Icon */}
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-2xl bg-[#6605c7]/10 flex items-center justify-center border border-[#6605c7]/20 transition-all overflow-hidden flex-shrink-0">
                                    {agencyName && step === "otp" ? (
                                        <img src="/agent-logo.png" alt="Partner Logo" className="w-full h-full object-cover" />
                                    ) : (
                                        <span className="material-symbols-outlined text-[#6605c7] text-2xl">support_agent</span>
                                    )}
                                </div>
                                {agencyName && step === "otp" && (
                                    <div className="animate-fade-in flex flex-col justify-center text-left max-w-[120px]">
                                        <span className="text-xs font-black text-gray-900 tracking-tight leading-tight truncate">{agencyName}</span>
                                        <span className="text-[8px] text-[#6605c7] font-black uppercase tracking-widest leading-none mt-0.5">Partner Found</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </Link>
                    <h1 className="text-4xl font-extrabold text-gray-900 font-display tracking-tight mb-2">
                        {step === "email" ? "Agent Access" : "Verify Identity"}
                    </h1>
                    <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider">
                        {step === "email"
                            ? "Please enter your agent email to continue"
                            : `A secure code has been sent to ${email}`}
                    </p>
                </div>

                {/* Login Card */}
                <div className="bg-white/90 backdrop-blur-xl border border-[#6605c7]/10 rounded-[2.5rem] p-10 shadow-2xl shadow-[#6605c7]/5">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3 ml-1">Agent Email</label>
                            <div className="relative">
                                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-xl pointer-events-none">person</span>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    disabled={step === "otp" || loading}
                                    placeholder="agent@vidyaloans.com"
                                    className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-[#6605c7]/5 focus:bg-white transition-all disabled:opacity-60 disabled:cursor-not-allowed font-medium"
                                    required
                                />
                                {step === "otp" && (
                                    <button
                                        type="button"
                                        onClick={() => { setStep("email"); setOtp(["", "", "", "", "", ""]); setError(""); }}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-[#6605c7] hover:underline"
                                    >
                                        Edit
                                    </button>
                                )}
                            </div>
                        </div>

                        {step === "otp" && (
                            <div className="animate-fade-in">
                                <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-4 ml-1">Secure OTP</label>
                                <div className="flex gap-2 justify-between" onPaste={handleOtpPaste}>
                                    {otp.map((digit, i) => (
                                        <input
                                            key={i}
                                            ref={(el) => { otpRefs.current[i] = el; }}
                                            type="text"
                                            inputMode="numeric"
                                            maxLength={1}
                                            value={digit}
                                            onChange={(e) => handleOtpChange(i, e.target.value)}
                                            onKeyDown={(e) => handleOtpKeyDown(i, e)}
                                            className="w-12 h-16 text-center text-2xl font-bold bg-gray-50 border border-gray-100 rounded-2xl text-gray-900 focus:outline-none focus:ring-4 focus:ring-[#6605c7]/5 focus:bg-white transition-all"
                                        />
                                    ))}
                                </div>
                                <div className="flex justify-between items-center mt-6 px-1">
                                    <span className="text-xs text-gray-400">Didn't receive code?</span>
                                    {resendDisabled ? (
                                        <span className="text-xs font-bold text-gray-400">Resend in {countdown}s</span>
                                    ) : (
                                        <button type="button" onClick={sendOtp} className="text-xs text-[#6605c7] hover:underline font-black uppercase tracking-wider">
                                            Resend Now
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}

                        {error && (
                            <div className="p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-sm font-medium flex items-start gap-3 animate-shake">
                                <span className="material-symbols-outlined text-lg">gpp_maybe</span>
                                <span>{error}</span>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-5 bg-[#6605c7] text-white font-black uppercase tracking-widest text-xs rounded-2xl hover:bg-[#6605c7]/90 active:scale-[0.98] transition-all disabled:opacity-60 flex items-center justify-center gap-3 shadow-xl shadow-[#6605c7]/20"
                        >
                            {loading ? (
                                <span className="material-symbols-outlined animate-spin text-xl">progress_activity</span>
                            ) : step === "email" ? (
                                <>Verify Identity <span className="material-symbols-outlined text-lg">arrow_forward</span></>
                            ) : (
                                <>Access Dashboard <span className="material-symbols-outlined text-lg">lock_open</span></>
                            )}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}

export default function AgentLoginPage() {
    return (
        <Suspense fallback={null}>
            <AgentLoginContent />
        </Suspense>
    );
}
