"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { authApi } from "@/lib/api";

function AdminLoginContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { login } = useAuth();

    const [email, setEmail] = useState("");
    const [otp, setOtp] = useState(["", "", "", "", "", ""]);
    const [step, setStep] = useState<"email" | "otp">("email");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [resendDisabled, setResendDisabled] = useState(false);
    const [countdown, setCountdown] = useState(0);

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
            const res = await authApi.sendOtp(email.trim(), "admin") as { success: boolean; message?: string; otp?: string; userExists: boolean };
            if (res && res.success === false) {
                setError(res.message || "Access Denied: You do not have administrator access.");
                setLoading(false);
                return;
            }
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

            if (data.role !== 'admin' && data.role !== 'super_admin') {
                throw new Error("Access Denied: Administrator privileges required.");
            }

            login(data.access_token, {
                email: email.trim(),
                firstName: data.firstName,
                lastName: data.lastName,
                role: data.role as any,
                refresh_token: (data as any).refresh_token
            });

            const redirectTo = searchParams.get("redirect");
            router.push(redirectTo ? decodeURIComponent(redirectTo) : "/admin");
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
        <div className="min-h-screen flex items-center justify-center px-4 relative">
            <div className="relative z-10 w-full max-w-md">
                {/* Logo & Header */}
                <div className="text-center mb-8">
                    <Link href="/" className="inline-flex items-center gap-2 mb-6">
                        <div className="w-12 h-12 rounded-2xl bg-[#6605c7]/10 flex items-center justify-center border border-[#6605c7]/20">
                            <span className="material-symbols-outlined text-[#6605c7] text-3xl">admin_panel_settings</span>
                        </div>
                        <span className="font-bold text-3xl font-display text-gray-900">Admin Portal</span>
                    </Link>
                    <h1 className="text-3xl font-bold text-gray-900 font-display mb-2">
                        {step === "email" ? "Restricted Access" : "Verify Identity"}
                    </h1>
                    <p className="text-gray-600 text-sm">
                        {step === "email"
                            ? "Please enter your administrator email to continue"
                            : `A secure code has been sent to ${email}`}
                    </p>
                </div>

                {/* Login Card */}
                <div className="bg-white/80 backdrop-blur-2xl border border-white/50 rounded-[2.5rem] p-10 shadow-2xl shadow-purple-500/10 border-t-4 border-t-[#6605c7]">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3 ml-1">Admin Email</label>
                            <div className="relative">
                                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-xl pointer-events-none">mark_as_unread</span>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    disabled={step === "otp" || loading}
                                    placeholder="admin@vidyaloan.com"
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
                            className="w-full py-5 bg-[#6605c7] text-white font-black uppercase tracking-widest text-xs rounded-2xl hover:bg-[#5504a5] active:scale-[0.98] transition-all disabled:opacity-60 flex items-center justify-center gap-3 shadow-xl shadow-purple-500/20"
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

export default function AdminLoginPage() {
    return (
        <Suspense fallback={null}>
            <AdminLoginContent />
        </Suspense>
    );
}
