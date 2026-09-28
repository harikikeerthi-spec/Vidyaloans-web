"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { authApi } from "@/lib/api";
import { auth, googleProvider } from "@/lib/firebase";
import { signInWithPopup } from "firebase/auth";

interface LoginResponse {
    success?: boolean;
    message?: string;
    access_token: string;
    userId?: string;
    email?: string;
    firstName?: string;
    lastName?: string;
    role?: string;
    refresh_token?: string;
    userExists?: boolean;
    hasUserDetails?: boolean;
    phoneNumber?: string;
    dateOfBirth?: string;
}

function LoginContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { login, isAuthenticated, isLoading } = useAuth();

    const [email, setEmail] = useState("");
    const [emailError, setEmailError] = useState("");
    const [otp, setOtp] = useState(["", "", "", "", "", ""]);
    const [step, setStep] = useState<"email" | "otp">("email");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [resendDisabled, setResendDisabled] = useState(false);
    const [countdown, setCountdown] = useState(0);

    const handleEmailChange = (raw: string) => {
        // Auto-lowercase the entire email
        const lowered = raw.toLowerCase();
        setEmail(lowered);
        if (!raw) { setEmailError(""); return; }
        // Check for uppercase letters
        if (/[A-Z]/.test(raw)) {
            setEmailError("Email addresses must be lowercase. We've corrected it for you.");
            return;
        }
        // Check for characters not valid in an email (allow a-z 0-9 . _ % + - @ and domain chars)
        if (/[^a-z0-9._%+\-@]/.test(lowered)) {
            setEmailError("Email contains invalid characters. Only letters, digits, and . _ % + - @ are allowed.");
            return;
        }
        setEmailError("");
    };
    const [referralCode, setReferralCode] = useState<string | null>(null);

    const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

    const isLoginInitiated = useRef(false);

    // Already logged in — redirect without a page reload
    useEffect(() => {
        if (isLoading || !isAuthenticated || isLoginInitiated.current) return;
        const redirectTo = searchParams.get("redirect");
        router.replace(redirectTo ? decodeURIComponent(redirectTo) : "/");
    }, [isAuthenticated, isLoading, router, searchParams]);

    // Capture referral code from URL on mount
    useEffect(() => {
        const ref = searchParams.get("ref");
        if (ref) {
            setReferralCode(ref);
            localStorage.setItem("referralCode", ref);
        } else {
            const stored = localStorage.getItem("referralCode");
            if (stored) setReferralCode(stored);
        }
    }, [searchParams]);

    useEffect(() => {
        if (countdown > 0) {
            const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
            return () => clearTimeout(timer);
        } else {
            setResendDisabled(false);
        }
    }, [countdown]);

    const sendOtp = async () => {
        const emailVal = email.trim();
        if (!emailVal) {
            setError("Please enter your email");
            return;
        }
        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        if (!emailRegex.test(emailVal)) {
            setError("Please enter a valid email address");
            return;
        }
        setLoading(true);
        setError("");
        try {
            const res: any = await authApi.sendOtp(emailVal);
            if (res && res.success === false) {
                setError(res.message || "Invalid email address");
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
        if (newOtp.join("").length === 6) {
            verifyOtp(newOtp.join(""));
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
        if (newOtp.join("").length === 6) {
            verifyOtp(newOtp.join(""));
        }
    };

    const verifyOtp = async (forcedCode?: string) => {
        const code = forcedCode || otp.join("");
        if (code.length !== 6) { setError("Please enter the 6-digit OTP"); return; }
        setLoading(true);
        setError("");
        try {
            const currentRef = referralCode || localStorage.getItem("referralCode");
            const data = await authApi.verifyOtp(email.trim(), code, currentRef || undefined) as LoginResponse;

            if (!data.access_token) {
                throw new Error("Invalid OTP. Please enter the right one to login.");
            }

            if (data.role && ["staff", "admin", "super_admin", "bank", "partner_bank", "agent", "partner_agent"].includes(data.role)) {
                let portalName = "";
                if (data.role === "staff") portalName = "Staff Portal (/staff/login)";
                else if (data.role === "admin" || data.role === "super_admin") portalName = "Admin Portal (/admin/login)";
                else if (data.role === "bank" || data.role === "partner_bank") portalName = "Bank Portal (/bank/login)";
                else if (data.role === "agent" || data.role === "partner_agent") portalName = "Agent Portal (/agent/login)";

                throw new Error(`Access Denied: Please use the ${portalName} to login.`);
            }

            isLoginInitiated.current = true;
            triggerSuccessAndRedirect(data, email.trim());
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : "Invalid OTP");
        } finally {
            setLoading(false);
        }
    };

    const triggerSuccessAndRedirect = (data: LoginResponse, emailVal: string) => {
        if (data.refresh_token) localStorage.setItem("refreshToken", data.refresh_token);

        login(data.access_token, {
            id: data.userId,
            email: emailVal,
            firstName: data.firstName,
            lastName: data.lastName,
            role: data.role,
            refresh_token: data.refresh_token,
            phoneNumber: data.phoneNumber,
            dateOfBirth: data.dateOfBirth,
        });

        // Clear stored referral code after login/signup
        localStorage.removeItem("referralCode");
        if (typeof window !== 'undefined') {
            sessionStorage.removeItem("referralCode");
        }

        if (data.role === "admin" || data.role === "super_admin") {
            router.push("/admin");
            return;
        }

        if (data.role === "bank" || data.role === "partner_bank") {
            router.push("/bank/dashboard");
            return;
        }

        if (data.role === "agent" || data.role === "partner_agent") {
            router.push("/agent/dashboard");
            return;
        }

        if (data.role === "staff") {
            router.push("/staff/dashboard");
            return;
        }

        if (!data.userExists || data.hasUserDetails === false) {
            router.push("/user-details");
        } else {
            const redirectTo = searchParams.get("redirect");
            router.push(redirectTo ? decodeURIComponent(redirectTo) : "/");
        }
    };

    const handleGoogleLogin = () => {
        if (!auth) {
            setError("Google Login is not configured. Please add your Firebase API keys to .env.local");
            return;
        }

        setLoading(true);
        setError("");

        signInWithPopup(auth, googleProvider)
            .then(async (result) => {
                const idToken = await result.user.getIdToken();
                const data = await authApi.firebaseLogin(idToken) as LoginResponse;

                if (data.role && ["staff", "admin", "super_admin", "bank", "partner_bank", "agent", "partner_agent"].includes(data.role)) {
                    let portalName = "";
                    if (data.role === "staff") portalName = "Staff Portal (/staff/login)";
                    else if (data.role === "admin" || data.role === "super_admin") portalName = "Admin Portal (/admin/login)";
                    else if (data.role === "bank" || data.role === "partner_bank") portalName = "Bank Portal (/bank/login)";
                    else if (data.role === "agent" || data.role === "partner_agent") portalName = "Agent Portal (/agent/login)";

                    throw new Error(`Access Denied: Please use the ${portalName} to login.`);
                }

                isLoginInitiated.current = true;
                triggerSuccessAndRedirect(data, result.user.email || "");
            })
            .catch((e: any) => {
                console.error("Google Login Error:", e);
                const code = e?.code || "";
                let msg = e instanceof Error ? e.message : "Failed to login with Google";

                if (code === "auth/invalid-continue-uri" || msg.includes("auth/invalid-continue-uri")) {
                    msg = "Firebase Domain Whitelist Error (auth/invalid-continue-uri): Your domain (e.g. localhost or localhost:3000) is not authorized in Firebase Console > Authentication > Settings > Authorized Domains. Tip: You can also login directly using Email OTP below!";
                } else if (code === "auth/unauthorized-domain" || msg.includes("auth/unauthorized-domain")) {
                    msg = "Firebase Authorization Error: This domain is not authorized for Firebase Auth. Add 'localhost' / your host in Firebase Console > Authentication > Settings > Authorized Domains.";
                } else if (code === "auth/popup-closed-by-user") {
                    msg = "Sign-in popup was closed before finishing login.";
                } else if (code === "auth/popup-blocked") {
                    msg = "Sign-in popup was blocked by your browser. Please allow popups for this site.";
                }

                setError(msg);
            })
            .finally(() => {
                setLoading(false);
            });
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
                            <span className="material-symbols-outlined text-[#6605c7] text-3xl">school</span>
                        </div>
                        <span className="font-bold text-3xl font-display text-gray-900">VidyaLoans</span>
                    </Link>
                    <h1 className="text-3xl font-bold text-gray-900 font-display mb-2">
                        {step === "email" ? "Student Access" : "Verify Identity"}
                    </h1>
                    <p className="text-gray-600 text-sm">
                        {step === "email"
                            ? "Please enter your email to continue"
                            : `A secure code has been sent to ${email}`}
                    </p>
                </div>

                {/* Referral Reward Badge */}
                {referralCode && step === "email" && (
                    <div className="mb-6 w-full bg-amber-50 border border-amber-200 rounded-2xl px-5 py-3 flex items-center gap-3 animate-fade-in">
                        <div className="w-8 h-8 bg-amber-500 rounded-xl flex items-center justify-center text-white shrink-0 shadow-md">
                            <span className="material-symbols-outlined text-sm font-bold">redeem</span>
                        </div>
                        <div>
                            <p className="text-xs font-black text-amber-800 uppercase tracking-wider">Referral Reward Active!</p>
                            <p className="text-[10px] text-amber-600 font-medium">Complete sign-in to activate your reward</p>
                        </div>
                    </div>
                )}

                {/* Login Card */}
                <div className="bg-white/80 backdrop-blur-2xl border border-white/50 rounded-[2.5rem] p-10 shadow-2xl shadow-purple-500/10 border-t-4 border-t-[#6605c7]">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {step === "email" && (
                            <div className="space-y-4">
                                <button
                                    type="button"
                                    onClick={handleGoogleLogin}
                                    disabled={loading}
                                    className="w-full py-4 bg-white hover:bg-gray-50 border border-gray-200 rounded-2xl flex items-center justify-center gap-3 text-xs font-black text-gray-700 tracking-widest uppercase transition-all shadow-md shadow-gray-100/50 cursor-pointer"
                                >
                                    <svg className="w-4.5 h-4.5 shrink-0" viewBox="0 0 24 24">
                                        <path
                                            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                            fill="#4285F4"
                                        />
                                        <path
                                            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                            fill="#34A853"
                                        />
                                        <path
                                            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                                            fill="#FBBC05"
                                        />
                                        <path
                                            d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                            fill="#EA4335"
                                        />
                                    </svg>
                                    Sign In with Google
                                </button>

                                <div className="relative flex items-center gap-4 py-2">
                                    <div className="flex-1 h-px bg-gray-100"></div>
                                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Or enter email</span>
                                    <div className="flex-1 h-px bg-gray-100"></div>
                                </div>
                            </div>
                        )}

                        <div>
                            <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3 ml-1">Student Email</label>
                            <div className="relative">
                                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-xl pointer-events-none">person</span>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => handleEmailChange(e.target.value)}
                                    disabled={step === "otp" || loading}
                                    placeholder="you@example.com"
                                    className={`w-full pl-12 pr-4 py-4 bg-gray-50 border rounded-2xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-4 focus:bg-white transition-all disabled:opacity-60 disabled:cursor-not-allowed font-medium ${
                                        emailError
                                            ? "border-amber-400 focus:ring-amber-500/10"
                                            : "border-gray-100 focus:ring-[#6605c7]/5"
                                    }`}
                                    required
                                />
                                {emailError && step === "email" && (
                                    <div className="flex items-center gap-1.5 mt-2 px-1">
                                        <span className="material-symbols-outlined text-amber-500 text-sm">warning</span>
                                        <span className="text-[11px] font-semibold text-amber-600">{emailError}</span>
                                    </div>
                                )}
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
                            className="w-full py-5 bg-[#6605c7] text-white font-black uppercase tracking-widest text-xs rounded-2xl hover:bg-[#5204a0] active:scale-[0.98] transition-all disabled:opacity-60 flex items-center justify-center gap-3 shadow-xl shadow-purple-500/20 cursor-pointer"
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

export default function LoginPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="w-12 h-12 border-4 border-[#6605c7]/20 border-t-[#6605c7] rounded-full animate-spin" /></div>}>
            <LoginContent />
        </Suspense>
    );
}
