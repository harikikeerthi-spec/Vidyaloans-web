"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { authApi, referenceApi } from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";

const DEFAULT_BANKS = [
    { id: "auxilo", name: "Auxilo Finserve", logo: "/banks/auxilo.png" },
    { id: "avanse", name: "Avanse Financial", logo: "/banks/avanse.png" },
    { id: "credila", name: "HDFC Credila", logo: "/banks/credila.png" },
    { id: "idfc", name: "IDFC FIRST Bank", logo: "/banks/idfc.png" },
    { id: "poonawalla", name: "Poonawalla Fincorp", logo: "/banks/poonawalla.jpg" },
];

// ---------------------------------------------------------------------------
// BankDropdown — opens a scrollable list below the trigger button
// ---------------------------------------------------------------------------
function BankDropdown({
    selected,
    onChange,
    banks = DEFAULT_BANKS,
}: {
    selected: string | null;
    onChange: (id: string) => void;
    banks?: { id: string; name: string; logo: string }[];
}) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    const selectedBank = banks.find((b) => b.id.toLowerCase() === selected?.toLowerCase())
        || banks.find((b) => b.name.toLowerCase() === selected?.toLowerCase());

    // Close on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    return (
        <div ref={ref} className="relative">
            {/* Trigger */}
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all"
                style={{
                    background: open ? "rgba(102,5,199,0.04)" : "rgba(249,250,251,0.7)",
                    borderColor: open ? "rgba(102,5,199,0.4)" : "rgba(0,0,0,0.08)",
                    boxShadow: open ? "0 0 0 4px rgba(102,5,199,0.06)" : "none",
                }}
            >
                {selectedBank ? (
                    <>
                        <div className="w-8 h-8 rounded-lg border border-gray-100 bg-white flex items-center justify-center overflow-hidden p-0.5 shrink-0">
                            <img src={selectedBank.logo} alt={selectedBank.name} className="w-full h-full object-contain" />
                        </div>
                        <span className="text-sm font-bold text-gray-900 flex-1">{selectedBank.name}</span>
                    </>
                ) : (
                    <>
                        <span className="material-symbols-outlined text-xl text-gray-400">account_balance</span>
                        <span className="text-sm text-gray-400 flex-1">Select your bank…</span>
                    </>
                )}
                <span
                    className="material-symbols-outlined text-gray-400 shrink-0 transition-transform duration-200"
                    style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", fontSize: 20 }}
                >
                    expand_more
                </span>
            </button>

            {/* Dropdown panel */}
            {open && (
                <div
                    className="absolute left-0 right-0 z-50 mt-2 rounded-2xl border overflow-hidden"
                    style={{
                        background: "rgba(255,255,255,0.98)",
                        backdropFilter: "blur(20px)",
                        WebkitBackdropFilter: "blur(20px)",
                        borderColor: "rgba(102,5,199,0.12)",
                        boxShadow: "0 16px 48px rgba(102,5,199,0.14), 0 2px 8px rgba(0,0,0,0.06)",
                    }}
                >
                    {/* Scrollable list — max 3.5 items visible */}
                    <div className="overflow-y-auto" style={{ maxHeight: 252 }}>
                        {banks.map((bank, i) => {
                            const isSelected = bank.id === selected;
                            return (
                                <button
                                    key={bank.id}
                                    type="button"
                                    onClick={() => { onChange(bank.id); setOpen(false); }}
                                    className="w-full flex items-center gap-3 px-4 py-3.5 text-left transition-all"
                                    style={{
                                        background: isSelected
                                            ? "linear-gradient(90deg, rgba(102,5,199,0.07) 0%, rgba(139,36,229,0.04) 100%)"
                                            : undefined,
                                        borderBottom: i < banks.length - 1
                                            ? "1px solid rgba(0,0,0,0.05)"
                                            : undefined,
                                    }}
                                    onMouseEnter={(e) => {
                                        if (!isSelected) e.currentTarget.style.background = "rgba(102,5,199,0.04)";
                                    }}
                                    onMouseLeave={(e) => {
                                        if (!isSelected) e.currentTarget.style.background = "";
                                    }}
                                >
                                    <div
                                        className="w-9 h-9 rounded-xl border flex items-center justify-center overflow-hidden p-1 shrink-0"
                                        style={{
                                            borderColor: isSelected ? "rgba(102,5,199,0.25)" : "rgba(0,0,0,0.07)",
                                            background: isSelected ? "rgba(102,5,199,0.06)" : "#fff",
                                            boxShadow: isSelected ? "0 2px 10px rgba(102,5,199,0.12)" : "0 1px 3px rgba(0,0,0,0.05)",
                                        }}
                                    >
                                        <img src={bank.logo} alt={bank.name} className="w-full h-full object-contain" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p
                                            className="text-sm font-bold truncate"
                                            style={{ color: isSelected ? "#6605c7" : "#111827" }}
                                        >
                                            {bank.name}
                                        </p>
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mt-0.5">
                                            Partner Institution
                                        </p>
                                    </div>
                                    {isSelected && (
                                        <span className="material-symbols-outlined shrink-0" style={{ color: "#6605c7", fontSize: 18 }}>
                                            check_circle
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}

// ---------------------------------------------------------------------------
// Main login page
// ---------------------------------------------------------------------------
function BankLoginContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { login } = useAuth();

    const [banksList, setBanksList] = useState(DEFAULT_BANKS);
    const [selectedBank, setSelectedBank] = useState<string | null>(null);
    const [email, setEmail] = useState("");
    const [otp, setOtp] = useState(["", "", "", "", "", ""]);
    const [step, setStep] = useState<"form" | "otp">("form");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<React.ReactNode>("");
    const [resendDisabled, setResendDisabled] = useState(false);
    const [countdown, setCountdown] = useState(0);

    // Fetch dynamic banks from backend database
    useEffect(() => {
        referenceApi.getBanks().then((res: any) => {
            if (res?.success && Array.isArray(res.data) && res.data.length > 0) {
                const mapped = res.data.map((b: any) => ({
                    id: b.shortName || b.id,
                    name: b.name,
                    logo: b.logoUrl || "/banks/idfc.png",
                }));
                setBanksList(mapped);
            }
        }).catch(() => {});
    }, []);

    // Dynamic bank resolver based on email input
    const getBankFromEmail = (emailStr: string): string | null => {
        const lowerEmail = emailStr.toLowerCase().trim();
        if (!lowerEmail) return null;
        for (const b of banksList) {
            const bId = (b.id || "").toLowerCase();
            const bName = (b.name || "").toLowerCase();
            if ((bId && lowerEmail.includes(bId)) || (bName && lowerEmail.includes(bName))) {
                return b.id;
            }
        }

        if (lowerEmail.includes("auxilo")) return "auxilo";
        if (lowerEmail.includes("avanse")) return "avanse";
        if (lowerEmail.includes("credila") || lowerEmail.includes("hdfc")) return "credila";
        if (lowerEmail.includes("idfc")) return "idfc";
        if (lowerEmail.includes("poonawalla")) return "poonawalla";

        // Fallbacks for seed test users
        if (lowerEmail === "idfcbank@gmail.com") return "idfc";
        if (lowerEmail === "credilabank@gmail.com") return "credila";
        if (lowerEmail === "auxilobank@gmail.com") return "auxilo";
        if (lowerEmail === "poonawallabank@gmail.com") return "poonawalla";
        if (lowerEmail === "avansebank@gmail.com") return "avanse";

        return null;
    };

    useEffect(() => {
        const bankId = getBankFromEmail(email);
        if (bankId) setSelectedBank(bankId);
    }, [email, banksList]);

    // Forgot password states
    const [showForgotModal, setShowForgotModal] = useState(false);
    const [forgotEmail, setForgotEmail] = useState("");
    const [forgotLoading, setForgotLoading] = useState(false);
    const [forgotSuccess, setForgotSuccess] = useState(false);
    const [forgotError, setForgotError] = useState("");

    const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

    const handleForgotSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!forgotEmail.trim()) { setForgotError("Email is required"); return; }
        setForgotLoading(true);
        setForgotError("");
        try {
            await new Promise((r) => setTimeout(r, 1200));
            setForgotSuccess(true);
        } catch (err) {
            setForgotError("Failed to trigger recovery token.");
        } finally {
            setForgotLoading(false);
        }
    };

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
        const lowerEmail = email.trim().toLowerCase();
        if (lowerEmail.includes("admin") || lowerEmail.startsWith("admin@")) {
            setError(
                <span>
                    It looks like you are an administrator. Please use the{" "}
                    <Link href="/admin/login" className="underline font-bold text-[#6605c7] hover:text-[#5203a4]">
                        Admin Login Page
                    </Link>{" "}
                    to access the portal.
                </span>
            );
            return;
        }
        const bankId = selectedBank || getBankFromEmail(email) || "idfc"; // Fallback to idfc
        setLoading(true);
        setError("");
        try {
            sessionStorage.setItem("selectedBank", bankId);
            localStorage.setItem("selectedBank", bankId);
            const res = await authApi.sendOtp(email.trim(), "bank") as any;
            if (res && res.success === false) {
                setError(res.message || "Access Denied: Bank partner officer access required.");
                setLoading(false);
                return;
            }
            if (res?.bankId) {
                setSelectedBank(res.bankId);
                sessionStorage.setItem("selectedBank", res.bankId);
                localStorage.setItem("selectedBank", res.bankId);
            }
            if (res?.bankName) {
                sessionStorage.setItem("selectedBankName", res.bankName);
            }
            if (res?.bankLogo) {
                sessionStorage.setItem("selectedBankLogo", res.bankLogo);
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
        if (digit && index < 5) otpRefs.current[index + 1]?.focus();
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
            const data = await authApi.verifyOtp(email.trim(), code) as any;

            if (data.success === false || !data.access_token) {
                throw new Error(data.message || "Invalid OTP. Please enter the right one to login.");
            }

            if (data.role === "admin" || data.role === "super_admin") {
                setError(
                    <span>
                        You have administrator privileges. Please use the{" "}
                        <Link href="/admin/login" className="underline font-bold text-[#6605c7] hover:text-[#5203a4]">
                            Admin Login Page
                        </Link>{" "}
                        to access the portal.
                    </span>
                );
                return;
            }

            if (data.role !== "bank" && data.role !== "partner_bank") {
                throw new Error("Unauthorized role. You must be bank staff to access this portal.");
            }

            if (data.refresh_token) localStorage.setItem("refreshToken", data.refresh_token);

            const finalBankId = data.bankId || data.bank || selectedBank || getBankFromEmail(email.trim()) || "idfc";
            sessionStorage.setItem("selectedBank", finalBankId);
            localStorage.setItem("selectedBank", finalBankId);
            if (data.bankName) {
                sessionStorage.setItem("selectedBankName", data.bankName);
            }
            if (data.bankLogo) {
                sessionStorage.setItem("selectedBankLogo", data.bankLogo);
            }

            login(data.access_token, {
                id: data.userId,
                email: email.trim(),
                firstName: data.firstName,
                lastName: data.lastName,
                role: data.role as any,
                bankName: data.bankName,
                bankLogo: data.bankLogo,
                bankId: finalBankId,
                refresh_token: data.refresh_token,
            });
            router.push("/bank/dashboard");
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : "Invalid OTP");
        } finally {
            setLoading(false);
        }
    };

    const selectedBankObj = banksList.find((b) => b.id.toLowerCase() === selectedBank?.toLowerCase())
        || banksList.find((b) => b.name.toLowerCase() === selectedBank?.toLowerCase());
    const selectedBankName = selectedBankObj?.name || (typeof window !== "undefined" ? sessionStorage.getItem("selectedBankName") : null) || selectedBank;

    return (
        <div
            className="min-h-screen flex items-center justify-center px-4 relative"
            style={{
                background: `
                    radial-gradient(ellipse 70% 60% at 10% 10%, rgba(102,5,199,0.10) 0%, transparent 60%),
                    radial-gradient(ellipse 60% 50% at 90% 10%, rgba(224,195,137,0.10) 0%, transparent 55%),
                    radial-gradient(ellipse 70% 70% at 50% 100%, rgba(79,70,229,0.07) 0%, transparent 60%),
                    linear-gradient(160deg, #f5f0ff 0%, #faf8ff 40%, #f0f4ff 70%, #f8f5ff 100%)
                `,
            }}
        >
            <div className="relative z-10 w-full max-w-md">

                {/* Logo */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center gap-4 mb-6">
                        {selectedBank ? (
                            <motion.div
                                initial={{ scale: 0.9, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                className="flex items-center gap-5 bg-white/90 backdrop-blur-md px-6 py-2 rounded-2xl border border-purple-200/50 shadow-md shadow-purple-500/5"
                            >
                                <img
                                    src="/vidyaloan_logo.png"
                                    alt="Vidyaloan Logo"
                                    className="w-16 h-16 object-contain mix-blend-multiply"
                                    style={{ transform: "scale(1.35)" }}
                                />
                                <span className="text-gray-300 text-xl font-light leading-none select-none">×</span>
                                <div className="h-10 flex items-center justify-center overflow-hidden">
                                    {selectedBankObj?.logo ? (
                                        <img
                                            src={selectedBankObj.logo}
                                            alt="Bank Logo"
                                            className="h-10 w-auto max-w-[140px] object-contain"
                                        />
                                    ) : (
                                        <div className="h-9 px-3 rounded-xl bg-purple-100 text-[#6605c7] flex items-center justify-center font-bold text-xs uppercase">
                                            {selectedBankName || selectedBank}
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        ) : (
                            <Link href="/" className="inline-flex items-center gap-2 group">
                                <img
                                    src="/vidyaloan_logo.png"
                                    alt="Vidyaloan Logo"
                                    className="w-10 h-10 object-contain group-hover:scale-105 transition-transform"
                                />
                                <span className="font-bold text-2xl font-display text-gray-900 tracking-tight">
                                    Vidyaloan X Bank Access Portal
                                </span>
                            </Link>
                        )}
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900 font-display mb-1.5 tracking-tight">
                        {step === "form" ? "Banker Access" : "Verify Authorization"}
                    </h1>
                    <p className="text-gray-550 text-[13px]">
                        {step === "form"
                            ? "Enter your corporate email address to access your dashboard"
                            : `Secure OTP sent to ${email}`}
                    </p>
                </div>

                {/* Card */}
                <div
                    className="rounded-3xl p-8 border"
                    style={{
                        background: "rgba(255,255,255,0.88)",
                        backdropFilter: "blur(24px)",
                        WebkitBackdropFilter: "blur(24px)",
                        borderColor: "rgba(102,5,199,0.10)",
                        boxShadow: "0 20px 60px rgba(102,5,199,0.08), 0 2px 8px rgba(0,0,0,0.04)",
                    }}
                >
                    {/* ── FORM STEP ── */}
                    {step === "form" && (
                        <div className="space-y-5">



                            {/* Email */}
                            <div>
                                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">
                                    Corporate Email Address
                                </label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    disabled={loading}
                                    placeholder="staff@bank.com"
                                    className="w-full px-4 py-3 rounded-xl text-gray-900 text-sm placeholder-gray-400 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                                    style={{
                                        background: "rgba(249,250,251,0.7)",
                                        border: "1px solid rgba(0,0,0,0.08)",
                                        outline: "none",
                                    }}
                                    onFocus={(e) => {
                                        e.target.style.borderColor = "rgba(102,5,199,0.4)";
                                        e.target.style.boxShadow = "0 0 0 4px rgba(102,5,199,0.06)";
                                    }}
                                    onBlur={(e) => {
                                        e.target.style.borderColor = "rgba(0,0,0,0.08)";
                                        e.target.style.boxShadow = "none";
                                    }}
                                    onKeyDown={(e) => e.key === "Enter" && sendOtp()}
                                />
                                <div className="flex justify-end mt-2">
                                    <button
                                        type="button"
                                        onClick={() => { setShowForgotModal(true); setForgotSuccess(false); setForgotEmail(""); setForgotError(""); }}
                                        className="text-[10px] font-black uppercase tracking-widest text-[#6605c7] hover:underline"
                                    >
                                        Forgot Password?
                                    </button>
                                </div>
                            </div>

                            {/* Error */}
                            {error && (
                                <div className="px-4 py-2.5 bg-red-50 border border-red-100 rounded-xl text-red-600 text-xs font-medium flex items-center gap-2">
                                    <span className="material-symbols-outlined text-base">error</span>
                                    {error}
                                </div>
                            )}

                            {/* Submit */}
                            <button
                                type="button"
                                onClick={sendOtp}
                                disabled={loading}
                                className="w-full py-3.5 text-white font-bold rounded-xl transition-all disabled:opacity-60 flex items-center justify-center gap-2 text-[14px]"
                                style={{
                                    background: "linear-gradient(135deg, #6605c7 0%, #8b24e5 100%)",
                                    boxShadow: "0 8px 24px rgba(102,5,199,0.28)",
                                }}
                                onMouseEnter={(e) => { if (!loading) e.currentTarget.style.boxShadow = "0 12px 32px rgba(102,5,199,0.38)"; }}
                                onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "0 8px 24px rgba(102,5,199,0.28)"; }}
                            >
                                {loading ? (
                                    <>
                                        <span className="material-symbols-outlined animate-spin text-base">progress_activity</span>
                                        Sending OTP…
                                    </>
                                ) : (
                                    <>
                                        Get OTP
                                        <span className="material-symbols-outlined text-base">arrow_forward</span>
                                    </>
                                )}
                            </button>
                        </div>
                    )}

                    {/* ── OTP STEP ── */}
                    {step === "otp" && (
                        <div className="space-y-6">
                            {/* Bank badge */}
                            {selectedBankName && (
                                <div
                                    className="flex items-center gap-2 px-3 py-2 rounded-xl text-[11px] font-bold"
                                    style={{
                                        background: "rgba(102,5,199,0.06)",
                                        color: "#6605c7",
                                        border: "1px solid rgba(102,5,199,0.15)",
                                    }}
                                >
                                    <span className="material-symbols-outlined text-base">account_balance</span>
                                    {selectedBankName}
                                </div>
                            )}

                            <div>
                                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-4 ml-1">
                                    Enter OTP
                                </label>
                                <div className="flex gap-2.5 justify-center" onPaste={handleOtpPaste}>
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
                                            className="w-11 h-12 text-center text-lg font-bold rounded-xl transition-all"
                                            style={{
                                                background: "rgba(249,250,251,0.7)",
                                                border: "1px solid rgba(0,0,0,0.08)",
                                                outline: "none",
                                                color: "#111",
                                            }}
                                            onFocus={(e) => {
                                                e.target.style.borderColor = "rgba(102,5,199,0.4)";
                                                e.target.style.boxShadow = "0 0 0 4px rgba(102,5,199,0.06)";
                                            }}
                                            onBlur={(e) => {
                                                e.target.style.borderColor = "rgba(0,0,0,0.08)";
                                                e.target.style.boxShadow = "none";
                                            }}
                                        />
                                    ))}
                                </div>
                                <div className="text-center mt-4">
                                    {resendDisabled ? (
                                        <span className="text-[11px] text-gray-400 font-medium">Resend code in {countdown}s</span>
                                    ) : (
                                        <button type="button" onClick={sendOtp} className="text-[11px] text-[#6605c7] hover:underline font-bold uppercase tracking-wider">
                                            Resend OTP
                                        </button>
                                    )}
                                </div>
                            </div>


                            {error && (
                                <div className="px-4 py-2.5 bg-red-50 border border-red-100 rounded-xl text-red-600 text-xs font-medium flex items-center gap-2">
                                    <span className="material-symbols-outlined text-base">error</span>
                                    {error}
                                </div>
                            )}

                            <button
                                type="button"
                                onClick={verifyOtp}
                                disabled={loading}
                                className="w-full py-3.5 text-white font-bold rounded-xl transition-all disabled:opacity-60 flex items-center justify-center gap-2 text-[14px]"
                                style={{
                                    background: "linear-gradient(135deg, #6605c7 0%, #8b24e5 100%)",
                                    boxShadow: "0 8px 24px rgba(102,5,199,0.28)",
                                }}
                            >
                                {loading ? (
                                    <>
                                        <span className="material-symbols-outlined animate-spin text-base">progress_activity</span>
                                        Verifying…
                                    </>
                                ) : (
                                    <>
                                        Authorize Access
                                        <span className="material-symbols-outlined text-base">security</span>
                                    </>
                                )}
                            </button>

                            <button
                                type="button"
                                onClick={() => { setStep("form"); setOtp(["", "", "", "", "", ""]); setError(""); }}
                                className="w-full text-center text-[11px] text-gray-400 hover:text-[#6605c7] font-bold uppercase tracking-widest"
                            >
                                ← Change Bank or Email
                            </button>
                        </div>
                    )}
                </div>

                <p className="text-center text-gray-400 text-[11px] mt-8 leading-relaxed">
                    By accessing this portal, you agree to strict confidentiality agreements. Unauthorized access is prohibited.
                </p>
            </div>

            {/* Forgot Password Modal */}
            <AnimatePresence>
                {showForgotModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <div className="fixed inset-0 bg-black/45 backdrop-blur-sm" onClick={() => setShowForgotModal(false)} />
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-white rounded-[2rem] border border-gray-100 shadow-2xl p-8 max-w-md w-full z-10 relative overflow-hidden"
                        >
                            <h3 className="text-xl font-black text-gray-900 mb-2 uppercase tracking-tight">Recover Credentials</h3>
                            <p className="text-xs text-gray-400 mb-6 font-bold uppercase tracking-wider">A security recovery protocol will be sent to your corporate address.</p>

                            {forgotSuccess ? (
                                <div className="space-y-6">
                                    <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl text-emerald-700 text-xs font-semibold flex items-start gap-2.5 leading-relaxed">
                                        <span className="material-symbols-outlined text-emerald-600 mt-0.5 shrink-0">check_circle</span>
                                        <div>
                                            <p className="font-black uppercase tracking-wider text-[10px] mb-1">Recovery Token Sent</p>
                                            <p className="opacity-90">A link has been dispatched. Please check your inbox or contact your IT security administrator.</p>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setShowForgotModal(false)}
                                        className="w-full py-3 bg-gray-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-800 transition-all"
                                    >
                                        Done
                                    </button>
                                </div>
                            ) : (
                                <form onSubmit={handleForgotSubmit} className="space-y-5">
                                    <div>
                                        <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-2">Corporate Email Address</label>
                                        <input
                                            type="email"
                                            required
                                            placeholder="staff@bank.com"
                                            value={forgotEmail}
                                            onChange={(e) => setForgotEmail(e.target.value)}
                                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold focus:outline-none focus:border-[#6605c7] focus:ring-4 focus:ring-[#6605c7]/5 shadow-sm transition-all"
                                        />
                                    </div>

                                    {forgotError && (
                                        <div className="px-4 py-2.5 bg-red-50 border border-red-100 rounded-xl text-red-600 text-xs font-medium flex items-center gap-2">
                                            <span className="material-symbols-outlined text-base">error</span>
                                            {forgotError}
                                        </div>
                                    )}

                                    <div className="flex gap-4 pt-3">
                                        <button
                                            type="button"
                                            onClick={() => setShowForgotModal(false)}
                                            className="flex-1 py-3 border border-gray-200 text-gray-500 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-50 transition-all"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={forgotLoading}
                                            className="flex-1 py-3 bg-[#6605c7] text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-[#5203a4] shadow-lg shadow-purple-500/10 transition-all flex items-center justify-center"
                                        >
                                            {forgotLoading ? "..." : "Send Token"}
                                        </button>
                                    </div>
                                </form>
                            )}
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}

export default function BankLoginPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><span className="material-symbols-outlined animate-spin text-4xl text-[#6605c7]">progress_activity</span></div>}>
            <BankLoginContent />
        </Suspense>
    );
}
