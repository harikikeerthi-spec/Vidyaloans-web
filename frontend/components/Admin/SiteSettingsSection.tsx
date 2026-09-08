"use client";

import React, { useState, useEffect } from "react";
import { adminApi } from "@/lib/api";
import {
  Cpu,
  Key,
  Zap,
  Eye,
  EyeOff,
  Sparkles,
  Save,
  Sliders,
  CheckCircle2,
  Shield,
  Search,
  Globe,
  Mail,
  Building2,
  Calendar,
  RotateCcw,
  Check,
  AlertTriangle,
  Radio,
  Copy,
  Terminal,
  Code,
  ExternalLink,
  Smartphone,
} from "lucide-react";

const DEFAULT_BLOCKED_DOMAINS = require("@/lib/disposable-domains.json").join(", ");

interface SiteSettings {
  // General & Branding
  siteName: string;
  tagline: string;
  metaTitle: string;
  metaDescription: string;
  supportEmail: string;
  contactEmail: string;
  phone: string;
  tollFree: string;
  address: string;
  currency: string;
  timezone: string;
  copyrightText: string;
  logoLightUrl: string;
  logoDarkUrl: string;
  faviconUrl: string;
  appIconUrl: string;
  primaryColor: string;
  secondaryColor: string;
  darkThemeBg: string;
  customCss: string;

  // Payments
  razorpayKeyId: string;
  razorpayKeySecret: string;
  stripePublishableKey: string;
  stripeSecretKey: string;
  googleAdsId?: string;

  // AI Integration
  openRouterApiKey: string;
  aiModel: string;
  aiTemperature: number;

  // Security, SEO & Disposable Email Protection
  disposableEmailBlock: boolean;
  disposableBlockLevel: string;
  blockedDomains: string;
  allowedDomains: string;
  disposableApiKey: string;
  disposableProvider: string;
  disposableAction: string;
  enableRecaptcha: boolean;
  recaptchaSiteKey: string;

  // Amber HQ Leads API
  amberApiKey: string;
  amberApiSecret: string;
  amberWebhookUrl: string;

  // Google & Social Discovery
  googleAnalyticsId: string;
  googleTagManagerId: string;
  facebookPixelId: string;
  facebookUrl: string;
  instagramUrl: string;
  twitterUrl: string;
  linkedinUrl: string;
  youtubeUrl: string;
  whatsappNumber: string;
  telegramUrl: string;
  posthogApiKey: string;
  mixpanelToken: string;
  hotjarSiteId: string;
  customHeadScripts: string;
  customBodyScripts: string;
  webhookUrl: string;

  // Email & AWS SES
  awsSesRegion: string;
  awsSesAccessKey: string;
  awsSesSecretKey: string;
  awsSesSenderEmail: string;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPassword: string;

  // Event Scraper
  eventScraperCron: string;
  eventScraperEnabled: boolean;
  eventScraperSource: string;

  // Mobile App Download Banner
  enableAppBanner: boolean;
  playStoreUrl: string;
  appStoreUrl: string;
}

const DEFAULT_FORM: SiteSettings = {
  siteName: "VidyaLoans",
  tagline: "Overseas Education Financing & Study Abroad Loan Portal",
  metaTitle: "VidyaLoans - Instant Education Loans for Overseas Studies",
  metaDescription:
    "Compare and apply for top education loans with lowest interest rates, quick approval, and zero hidden charges.",
  supportEmail: "support@vidyaloans.com",
  contactEmail: "contact@vidyaloans.com",
  phone: "+91 1800-123-4567",
  tollFree: "1800-123-4567",
  address: "VidyaLoans Financial Tower, Sector 44, Gurgaon, Haryana 122003, India",
  currency: "INR",
  timezone: "Asia/Kolkata",
  copyrightText: "© 2026 VidyaLoans Inc. All rights reserved.",
  logoLightUrl: "/images/vidyaloans-logo-transparent.png",
  logoDarkUrl: "/images/vidyaloans-logo-transparent.png",
  faviconUrl: "/favicon.ico",
  appIconUrl: "/images/icon.png",
  primaryColor: "#6605c7",
  secondaryColor: "#4f46e5",
  darkThemeBg: "#0f172a",
  customCss: "/* Custom CSS Overrides */\n:root {\n  --brand-primary: #6605c7;\n}",

  razorpayKeyId: "",
  razorpayKeySecret: "",
  stripePublishableKey: "",
  stripeSecretKey: "",

  openRouterApiKey: "",
  aiModel: "google/gemini-2.0-flash-001",
  aiTemperature: 0.7,

  disposableEmailBlock: true,
  disposableBlockLevel: "strict",
  blockedDomains: DEFAULT_BLOCKED_DOMAINS,
  allowedDomains:
    "gmail.com, yahoo.com, outlook.com, hotmail.com, icloud.com, proton.me, protonmail.com, vidyaloans.com",
  disposableApiKey: "",
  disposableProvider: "builtin",
  disposableAction: "reject",
  enableRecaptcha: true,
  recaptchaSiteKey: "",

  amberApiKey: "",
  amberApiSecret: "",
  amberWebhookUrl: "https://api.vidyaloans.in/api/webhooks/amber",

  googleAnalyticsId: "G-1Z8RYR9RBW",
  googleTagManagerId: "GTM-PSHKZ8FK",
  facebookPixelId: "987654321098765",
  facebookUrl: "https://facebook.com/vidyaloans",
  instagramUrl: "https://instagram.com/vidyaloans",
  twitterUrl: "https://x.com/vidyaloans",
  linkedinUrl: "https://linkedin.com/company/vidyaloans",
  youtubeUrl: "https://youtube.com/@vidyaloans",
  whatsappNumber: "+919876543210",
  telegramUrl: "https://t.me/vidyaloans",
  posthogApiKey: "phc_vidyaloans_live_key_998877",
  mixpanelToken: "mp_token_vidyaloans_production",
  hotjarSiteId: "3456789",
  customHeadScripts:
    "<!-- Google Tag Manager -->\n<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});})(window,document,'script','dataLayer','GTM-PSHKZ8FK');</script>\n<!-- Google tag (gtag.js) -->\n<script async src=\"https://www.googletagmanager.com/gtag/js?id=G-1Z8RYR9RBW\"></script>\n<script>\n  window.dataLayer = window.dataLayer || [];\n  function gtag(){dataLayer.push(arguments);}\n  gtag('js', new Date());\n\n  gtag('config', 'G-1Z8RYR9RBW');\n</script>",
  customBodyScripts:
    "<!-- Google Tag Manager (noscript) -->\n<noscript><iframe src=\"https://www.googletagmanager.com/ns.html?id=GTM-PSHKZ8FK\" height=\"0\" width=\"0\" style=\"display:none;visibility:hidden\"></iframe></noscript>",
  webhookUrl: "https://api.vidyaloans.com/v1/webhooks/events",

  awsSesRegion: "ap-south-1",
  awsSesAccessKey: "",
  awsSesSecretKey: "",
  awsSesSenderEmail: "support@vidyaloans.in",
  smtpHost: "email-smtp.ap-south-1.amazonaws.com",
  smtpPort: 587,
  smtpUser: "",
  smtpPassword: "",

  eventScraperCron: "0 0 * * *",
  eventScraperEnabled: true,
  eventScraperSource: "https://education.events.api/v1/scrapes",

  enableAppBanner: true,
  playStoreUrl: "https://play.google.com/store/apps/details?id=in.vidyaloans.app",
  appStoreUrl: "",
};

type TabType =
  | "general"
  | "ai"
  | "security"
  | "discovery"
  | "email";

export default function SiteSettingsSection() {
  const [activeTab, setActiveTab] = useState<TabType>("ai");
  const [form, setForm] = useState<SiteSettings>(DEFAULT_FORM);
  const [initialForm, setInitialForm] = useState<SiteSettings>(DEFAULT_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Visibility toggles for passwords & API keys
  const [showOpenRouter, setShowOpenRouter] = useState(false);
  const [showRazorpaySecret, setShowRazorpaySecret] = useState(false);
  const [showStripeSecret, setShowStripeSecret] = useState(false);
  const [showAmberSecret, setShowAmberSecret] = useState(false);
  const [showAwsSecret, setShowAwsSecret] = useState(false);
  const [showSmtpPassword, setShowSmtpPassword] = useState(false);

  // Email Tester state
  const [testEmail, setTestEmail] = useState("user@0-mail.com");
  const [testResult, setTestResult] = useState<any>(null);
  const [testLoading, setTestLoading] = useState(false);

  // Copy indicator
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Load Settings
  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await adminApi.getSiteSettings();
      if (res && res.data) {
        // Smart merge: ensure full 4,600+ domain list is present in the UI along with any DB custom domains
        const dbDomains = (res.data.blockedDomains || "")
          .split(/[\n,]+/)
          .map((d: string) => d.trim().toLowerCase())
          .filter(Boolean);
        const defaultDomains = DEFAULT_BLOCKED_DOMAINS.split(", ").map((d: string) => d.trim().toLowerCase());
        const mergedSet = new Set([...defaultDomains, ...dbDomains]);
        const fullBlocked = Array.from(mergedSet).sort().join(", ");

        const mergedForm: SiteSettings = {
          ...DEFAULT_FORM,
          ...res.data,
          blockedDomains: fullBlocked,
        };

        setForm(mergedForm);
        setInitialForm(mergedForm);
      }
    } catch (e) {
      console.error("Error fetching site settings:", e);
      showToast("Loaded default configuration", "error");
    } finally {
      setLoading(false);
    }
  };

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const copyToClipboard = (text: string, label: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(label);
    showToast(`Copied ${label} to clipboard!`, "success");
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const handleChange = (field: keyof SiteSettings, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleImageUpload = (field: "logoLightUrl" | "logoDarkUrl" | "faviconUrl" | "appIconUrl", file: File) => {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      showToast("Image size must be less than 2MB", "error");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        handleChange(field, e.target.result as string);
        showToast("Image loaded! Click 'Save Settings' to apply platform-wide.", "success");
      }
    };
    reader.readAsDataURL(file);
  };

  const isDirty = JSON.stringify(form) !== JSON.stringify(initialForm);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await adminApi.updateSiteSettings(form);
      const updatedData = res?.data || form;
      if (res && res.data) {
        setForm((prev) => ({ ...prev, ...res.data }));
        setInitialForm((prev) => ({ ...prev, ...res.data }));
        showToast("Settings saved and reflected site-wide!", "success");
      } else {
        showToast("Settings updated and applied!", "success");
        setInitialForm(form);
      }

      // Hot reload: update localStorage and broadcast across all tabs and windows
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem("vidyaloans_site_settings", JSON.stringify(updatedData));
        } catch (e) { }

        window.dispatchEvent(new CustomEvent("site-settings-updated", { detail: updatedData }));

        if ("BroadcastChannel" in window) {
          try {
            const channel = new BroadcastChannel("site_settings_sync");
            channel.postMessage({ type: "SETTINGS_UPDATED", data: updatedData });
            channel.close();
          } catch (e) { }
        }
      }
    } catch (e) {
      console.error("Error saving site settings:", e);
      showToast("Failed to save site settings", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!confirm("Are you sure you want to reset all site settings to default values?")) return;
    setResetting(true);
    try {
      const res = await adminApi.resetSiteSettings();
      if (res && res.data) {
        setForm((prev) => ({ ...prev, ...res.data }));
        setInitialForm((prev) => ({ ...prev, ...res.data }));
        showToast("Settings reset to defaults and reflected site-wide!", "success");

        if (typeof window !== "undefined") {
          try {
            localStorage.setItem("vidyaloans_site_settings", JSON.stringify(res.data));
          } catch (e) { }

          window.dispatchEvent(new CustomEvent("site-settings-updated", { detail: res.data }));

          if ("BroadcastChannel" in window) {
            try {
              const channel = new BroadcastChannel("site_settings_sync");
              channel.postMessage({ type: "SETTINGS_UPDATED", data: res.data });
              channel.close();
            } catch (e) { }
          }
        }
      }
    } catch (e) {
      console.error("Error resetting settings:", e);
      showToast("Failed to reset settings", "error");
    } finally {
      setResetting(false);
    }
  };

  const handleTestEmail = async () => {
    if (!testEmail) return;
    setTestLoading(true);
    try {
      const res = await adminApi.testDisposableEmail(testEmail);
      if (res && res.data) {
        setTestResult(res.data);
      }
    } catch (e) {
      console.error("Error testing disposable email:", e);
    } finally {
      setTestLoading(false);
    }
  };

  const blockedCount = (form.blockedDomains || "")
    .split(/[\n,]+/)
    .map((d) => d.trim())
    .filter(Boolean).length;

  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: "general", label: "General & Branding", icon: <Building2 className="w-4 h-4" /> },
    { id: "ai", label: "AI Integration", icon: <Cpu className="w-4 h-4" /> },
    { id: "security", label: "Security & Disposable Shield", icon: <Shield className="w-4 h-4" /> },
    { id: "discovery", label: "Google & Social Discovery", icon: <Globe className="w-4 h-4" /> },
    { id: "email", label: "Email & AWS SES", icon: <Mail className="w-4 h-4" /> },
  ];

  if (loading) {
    return (
      <div className="p-12 flex flex-col items-center justify-center min-h-[450px] bg-white rounded-2xl border border-slate-200/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
        <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4" />
        <p className="text-slate-500 text-sm font-medium">Loading Site Settings...</p>
      </div>
    );
  }

  return (
    <div className="w-full font-sans space-y-6">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-2xl border text-sm font-semibold flex items-center gap-3 transition-all ${toast.type === "success"
              ? "bg-emerald-900 border-emerald-500 text-emerald-100"
              : "bg-rose-900 border-rose-500 text-rose-100"
            }`}
        >
          {toast.type === "success" ? <CheckCircle2 className="w-5 h-5 text-emerald-400" /> : <AlertTriangle className="w-5 h-5 text-rose-400" />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Site Settings</h1>
          <p className="text-slate-500 text-xs mt-0.5">Manage your platform configuration and integrations.</p>
        </div>

        <div className="flex items-center gap-2">
          {isDirty && (
            <span className="px-3 py-1 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 animate-pulse">
              Unsaved changes
            </span>
          )}
          <button
            onClick={handleReset}
            disabled={resetting}
            className="px-3 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold transition-all flex items-center gap-1.5 shadow-sm"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Defaults
          </button>

          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white shadow-md shadow-indigo-500/20 text-xs font-bold transition-all flex items-center gap-2"
          >
            {saving ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                Save Settings
              </>
            )}
          </button>
        </div>
      </div>

      {/* Navigation Tabs (Pill style matching reference screenshot) */}
      <div className="flex items-center gap-2.5 overflow-x-auto pb-2 custom-scrollbar">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 rounded-xl font-semibold text-xs flex items-center gap-2 transition-all shrink-0 border ${isActive
                  ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:text-slate-900"
                }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
              {tab.id === "security" && (
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${isActive ? "bg-indigo-700 text-indigo-100" : "bg-slate-100 text-slate-600"
                    }`}
                >
                  {blockedCount.toLocaleString()}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* ── TAB: AI INTEGRATION (High-End Stripe / Apple-Esque Polish) ── */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      {activeTab === "ai" && (
        <div className="relative bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-200/80 overflow-hidden animate-fade-in">
          {/* Subtle Gradient Top Accent */}
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-violet-500 via-purple-500 to-indigo-500"></div>

          {/* Card Header */}
          <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="absolute inset-0 bg-violet-200 rounded-xl blur-md opacity-60"></div>
                <div className="relative p-2.5 bg-white border border-violet-100 rounded-xl text-violet-600 shadow-sm">
                  <Sparkles className="w-5 h-5" />
                </div>
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 tracking-tight">AI Configuration</h2>
                <p className="text-sm text-slate-500 mt-0.5">Manage your LLM API keys and model parameters.</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-600 border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                System Active
              </span>
            </div>
          </div>

          {/* Card Body - Settings Form */}
          <div className="p-8 space-y-10">
            {/* Section 1: OpenRouter (Gemini) */}
            <section>
              <div className="flex items-center gap-2 mb-5">
                <Cpu className="w-4 h-4 text-indigo-500" />
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Primary Engine (Gemini)</h3>
              </div>

              <div className="space-y-6 bg-slate-50/50 p-6 rounded-2xl border border-slate-100">
                {/* API Key Input */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-semibold text-slate-600">OpenRouter API Key</label>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(form.openRouterApiKey, "OpenRouter Key")}
                      className="text-[11px] font-mono text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                    >
                      <Copy className="w-3 h-3" />
                      {copiedKey === "OpenRouter Key" ? "Copied!" : "Copy Key"}
                    </button>
                  </div>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Key className="h-4 w-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                    </div>
                    <input
                      type={showOpenRouter ? "text" : "password"}
                      value={form.openRouterApiKey}
                      onChange={(e) => handleChange("openRouterApiKey", e.target.value)}
                      placeholder="sk-or-v1-..."
                      className="block w-full pl-10 pr-12 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-mono text-slate-700 shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)] focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowOpenRouter(!showOpenRouter)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-indigo-600 transition-colors"
                    >
                      {showOpenRouter ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Grid for Model & Temp */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-2">Model Identifier</label>
                    <input
                      type="text"
                      value={form.aiModel}
                      onChange={(e) => handleChange("aiModel", e.target.value)}
                      placeholder="google/gemini-2.0-flash-001"
                      className="block w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-mono text-indigo-600 shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)] focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-xs font-semibold text-slate-600">AI Temperature</label>
                      <span className="text-xs font-bold font-mono text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                        {form.aiTemperature.toFixed(2)}
                      </span>
                    </div>
                    <div className="relative pt-1 flex items-center gap-3">
                      <Sliders className="w-4 h-4 text-slate-400" />
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={form.aiTemperature}
                        onChange={(e) => handleChange("aiTemperature", parseFloat(e.target.value))}
                        className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600 hover:accent-indigo-700 transition-all"
                      />
                    </div>
                    <div className="flex justify-between mt-1.5 px-7 text-[10px] text-slate-400 font-medium">
                      <span>Precise</span>
                      <span>Creative</span>
                    </div>

                    <div className="mt-3 p-3 rounded-xl bg-indigo-50/60 border border-indigo-100 text-[11px] text-slate-600 space-y-1">
                      <div className="flex items-center gap-1.5 font-bold text-indigo-700">
                        <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                        <span>What is AI Temperature?</span>
                      </div>
                      <p className="text-[11px] leading-relaxed text-slate-600">
                        Controls response randomness. <strong>0.0 – 0.3:</strong> Factual, strict, and precise (best for loan eligibility, document analysis & underwriting). <strong>0.5 – 0.7:</strong> Balanced assistance for customer support. <strong>0.8 – 1.0:</strong> Creative & diverse (best for SOP writing).
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>

          {/* Card Footer / Action Area */}
          <div className="px-8 py-5 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
            <p className="text-xs text-slate-400 font-medium">Keys are encrypted at rest using AES-256.</p>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition-all duration-300 shadow-lg bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 shadow-indigo-500/25"
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Save Changes</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* ── TAB: SECURITY & SEO (Disposable Email Protection) ── */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      {activeTab === "security" && (
        <div className="space-y-6 animate-fade-in">
          {/* Master Switch & Mode Selector */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-[0_8px_30px_rgb(0,0,0,0.04)] space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
              <div>
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center ${form.disposableEmailBlock ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
                      }`}
                  >
                    <Shield className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-base">Disposable & Temporary Email Shield</h3>
                    <p className="text-xs text-slate-500">
                      Block fraudulent applications and fake accounts with {blockedCount.toLocaleString()} blocked
                      domains
                    </p>
                  </div>
                </div>
              </div>

              {/* Master Shield Toggle */}
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.disposableEmailBlock}
                  onChange={(e) => handleChange("disposableEmailBlock", e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-14 h-8 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-emerald-600"></div>
                <span className="ml-3 text-xs font-bold text-slate-800">
                  {form.disposableEmailBlock ? "SHIELD ACTIVE" : "SHIELD DISABLED"}
                </span>
              </label>
            </div>

            {/* Enforcement Mode Cards */}
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-3">Enforcement Level Policy</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  {
                    id: "strict",
                    title: "Strict Block",
                    desc: "Instantly reject student loan applications and user signups using disposable domains.",
                    icon: "block",
                    color: "border-emerald-500 bg-emerald-50/40 text-emerald-900",
                  },
                  {
                    id: "warning",
                    title: "Warning Banner",
                    desc: "Alert applicant that institutional verification will require an official email.",
                    icon: "warning",
                    color: "border-amber-500 bg-amber-50/40 text-amber-900",
                  },
                  {
                    id: "audit_only",
                    title: "Audit Log Only",
                    desc: "Allow submission but flag the application in admin audit logs for manual underwriting review.",
                    icon: "visibility",
                    color: "border-indigo-500 bg-indigo-50/40 text-indigo-900",
                  },
                ].map((mode) => (
                  <button
                    key={mode.id}
                    onClick={() => handleChange("disposableBlockLevel", mode.id)}
                    className={`p-4 rounded-xl border text-left transition-all relative ${form.disposableBlockLevel === mode.id
                        ? `${mode.color} shadow-md ring-2 ring-indigo-500/20`
                        : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                      }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="material-symbols-outlined text-xl">{mode.icon}</span>
                      {form.disposableBlockLevel === mode.id && (
                        <span className="material-symbols-outlined text-lg text-indigo-600">check_circle</span>
                      )}
                    </div>
                    <h4 className="font-bold text-xs mb-1">{mode.title}</h4>
                    <p className="text-[11px] text-slate-500 leading-relaxed">{mode.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Blacklist Domain Manager */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-[0_8px_30px_rgb(0,0,0,0.04)] space-y-3">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2 text-rose-600 font-bold text-sm">
                <span className="material-symbols-outlined">do_not_disturb_on</span>
                <h3>Blocked Disposable & Fraudulent Email Domains</h3>
              </div>
              <span className="text-[11px] font-bold text-rose-600 bg-rose-50 px-2.5 py-1 rounded-full border border-rose-200">
                {blockedCount.toLocaleString()} Domains / Rules
              </span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              All official, personal, university, corporate, and legitimate email addresses (e.g. Gmail, Outlook, Yahoo, Hotmail, iCloud, custom domain emails) are <strong>automatically approved</strong> for signup, login, and loan applications. Only temporary, disposable, burner providers or specific emails added to this blacklist below will be blocked.
            </p>
            <textarea
              rows={8}
              value={form.blockedDomains}
              onChange={(e) => handleChange("blockedDomains", e.target.value)}
              className="w-full p-4 rounded-xl border border-slate-300 font-mono text-xs bg-rose-50/20 text-rose-950 leading-relaxed focus:ring-2 focus:ring-rose-400 custom-scrollbar shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)]"
              placeholder="tempmail.com, mailinator.com, 10minutemail.com, spammer@bad.com..."
            />
          </div>

          {/* Real-time Email Protection Live Tester */}
          <div className="bg-slate-900 text-white p-6 rounded-2xl border border-slate-800 shadow-xl space-y-4">
            <div className="flex items-center gap-2 text-indigo-400 font-bold text-sm border-b border-slate-800 pb-3">
              <span className="material-symbols-outlined text-lg">science</span>
              <h3>Live Disposable Email Tester Widget</h3>
            </div>

            <p className="text-xs text-slate-400">
              Test any email address against your active disposable email protection rules live
            </p>

            <div className="flex items-center gap-3">
              <input
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="e.g. test@0-mail.com or user@gmail.com"
                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-800 text-white text-xs font-mono focus:ring-2 focus:ring-indigo-500"
              />
              <button
                onClick={handleTestEmail}
                disabled={testLoading}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition-all shrink-0 flex items-center gap-2 shadow-md shadow-indigo-600/20"
              >
                {testLoading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Search className="w-4 h-4" />
                    Test Email
                  </>
                )}
              </button>
            </div>

            {testResult && (
              <div
                className={`p-4 rounded-xl border text-xs space-y-2 animate-fade-in ${testResult.blocked
                    ? "bg-rose-950/60 border-rose-600/60 text-rose-200"
                    : "bg-emerald-950/60 border-emerald-600/60 text-emerald-200"
                  }`}
              >
                <div className="flex items-center justify-between font-bold text-sm">
                  <span className="flex items-center gap-2">
                    <span className="material-symbols-outlined">{testResult.blocked ? "cancel" : "check_circle"}</span>
                    {testResult.blocked ? "DISPOSABLE EMAIL DETECTED & BLOCKED" : "EMAIL IS VALID & ALLOWED"}
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-white/10">
                    {testResult.action}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-white/10 text-[11px]">
                  <div>
                    <span className="opacity-60 block">DOMAIN</span>
                    <span className="font-mono font-bold">@{testResult.domain}</span>
                  </div>
                  <div>
                    <span className="opacity-60 block">SHIELD STATUS</span>
                    <span className="font-bold">{testResult.protectionEnabled ? "Active" : "Disabled"}</span>
                  </div>
                  <div>
                    <span className="opacity-60 block">ENFORCEMENT</span>
                    <span className="font-bold capitalize">{testResult.blockLevel}</span>
                  </div>
                  <div>
                    <span className="opacity-60 block">RESULT REASON</span>
                    <span className="truncate block" title={testResult.reason}>
                      {testResult.reason}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* ── TAB: GENERAL & BRANDING (Live Dynamic Reflection Engine) ── */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      {activeTab === "general" && (
        <div className="space-y-6 animate-fade-in">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Core Site Identity & SEO */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-[0_8px_30px_rgb(0,0,0,0.04)] space-y-4">
              <div className="flex items-center gap-2 text-indigo-600 font-bold text-sm border-b pb-3">
                <Building2 className="w-4 h-4" />
                <h3>Core Brand Identity & SEO</h3>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Site Title / Brand Name</label>
                <input
                  type="text"
                  value={form.siteName}
                  onChange={(e) => handleChange("siteName", e.target.value)}
                  placeholder="VidyaLoans"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 text-xs font-semibold shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Tagline / Slogan</label>
                <input
                  type="text"
                  value={form.tagline}
                  onChange={(e) => handleChange("tagline", e.target.value)}
                  placeholder="Overseas Education Financing & Study Abroad Loan Portal"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 text-xs font-medium shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Meta Title (Browser Page Title)</label>
                <input
                  type="text"
                  value={form.metaTitle}
                  onChange={(e) => handleChange("metaTitle", e.target.value)}
                  placeholder="VidyaLoans - Instant Education Loans for Overseas Studies"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 text-xs font-medium shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Meta Description (Search Engines & Social Sharing)</label>
                <textarea
                  rows={3}
                  value={form.metaDescription}
                  onChange={(e) => handleChange("metaDescription", e.target.value)}
                  placeholder="Compare and apply for top education loans with lowest interest rates, quick approval, and zero hidden charges."
                  className="w-full p-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 text-xs font-medium shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)]"
                />
              </div>
            </div>

            {/* Branding Visual Assets (Upload & URLs) */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-[0_8px_30px_rgb(0,0,0,0.04)] space-y-4">
              <div className="flex items-center gap-2 text-indigo-600 font-bold text-sm border-b pb-3">
                <span className="material-symbols-outlined text-lg">image</span>
                <h3>Branding Assets & Logos</h3>
              </div>

              {/* Logo Light */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Primary Light Theme Logo URL</label>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 p-1 flex items-center justify-center shrink-0 overflow-hidden">
                    <img
                      src={form.logoLightUrl || "/images/vidyaloans-logo-transparent.png"}
                      alt="Logo"
                      className="w-full h-full object-contain"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = "/images/vidyaloans-logo-transparent.png";
                      }}
                    />
                  </div>
                  <div className="flex-1 space-y-1">
                    <input
                      type="text"
                      value={form.logoLightUrl}
                      onChange={(e) => handleChange("logoLightUrl", e.target.value)}
                      placeholder="/images/vidyaloans-logo-transparent.png"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)]"
                    />
                    <label className="inline-flex items-center gap-1 text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer">
                      <span className="material-symbols-outlined text-sm">upload_file</span>
                      <span>Upload New Logo</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleImageUpload("logoLightUrl", file);
                        }}
                      />
                    </label>
                  </div>
                </div>
              </div>

              {/* Favicon & App Icon */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Favicon URL (.ico / .png)</label>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 p-1 flex items-center justify-center shrink-0">
                      <img
                        src={form.faviconUrl || "/favicon.ico"}
                        alt="Favicon"
                        className="w-full h-full object-contain"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = "/favicon.ico";
                        }}
                      />
                    </div>
                    <input
                      type="text"
                      value={form.faviconUrl}
                      onChange={(e) => handleChange("faviconUrl", e.target.value)}
                      placeholder="/favicon.ico"
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-mono shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)]"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">App Icon URL</label>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 p-1 flex items-center justify-center shrink-0">
                      <img
                        src={form.appIconUrl || "/images/icon.png"}
                        alt="Icon"
                        className="w-full h-full object-contain"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = "/images/icon.png";
                        }}
                      />
                    </div>
                    <input
                      type="text"
                      value={form.appIconUrl}
                      onChange={(e) => handleChange("appIconUrl", e.target.value)}
                      placeholder="/images/icon.png"
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-mono shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)]"
                    />
                  </div>
                </div>
              </div>

              {/* Theme Colors */}
              <div className="border-t pt-3 space-y-3">
                <span className="block text-xs font-bold uppercase tracking-wider text-slate-600">Dynamic Theme Colors</span>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Primary Brand Color</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={form.primaryColor || "#6605c7"}
                        onChange={(e) => handleChange("primaryColor", e.target.value)}
                        className="w-8 h-8 rounded-lg cursor-pointer border border-slate-300 p-0.5"
                      />
                      <input
                        type="text"
                        value={form.primaryColor}
                        onChange={(e) => handleChange("primaryColor", e.target.value)}
                        className="w-full px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-mono"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Secondary / Indigo Color</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={form.secondaryColor || "#4f46e5"}
                        onChange={(e) => handleChange("secondaryColor", e.target.value)}
                        className="w-8 h-8 rounded-lg cursor-pointer border border-slate-300 p-0.5"
                      />
                      <input
                        type="text"
                        value={form.secondaryColor}
                        onChange={(e) => handleChange("secondaryColor", e.target.value)}
                        className="w-full px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-mono"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Corporate & Contact Details */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-[0_8px_30px_rgb(0,0,0,0.04)] space-y-4">
              <div className="flex items-center gap-2 text-indigo-600 font-bold text-sm border-b pb-3">
                <Mail className="w-4 h-4" />
                <h3>Contact & Regional Localization</h3>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Support Email</label>
                  <input
                    type="email"
                    value={form.supportEmail}
                    onChange={(e) => handleChange("supportEmail", e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 text-xs font-medium"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Contact Email</label>
                  <input
                    type="email"
                    value={form.contactEmail}
                    onChange={(e) => handleChange("contactEmail", e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 text-xs font-medium"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Helpline Phone</label>
                  <input
                    type="text"
                    value={form.phone}
                    onChange={(e) => handleChange("phone", e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 text-xs font-medium"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Toll-Free Phone</label>
                  <input
                    type="text"
                    value={form.tollFree}
                    onChange={(e) => handleChange("tollFree", e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 text-xs font-medium"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Corporate Address / Office</label>
                <input
                  type="text"
                  value={form.address}
                  onChange={(e) => handleChange("address", e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 text-xs font-medium"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Default Currency</label>
                  <input
                    type="text"
                    value={form.currency}
                    onChange={(e) => handleChange("currency", e.target.value)}
                    placeholder="INR"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-medium"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Platform Timezone</label>
                  <input
                    type="text"
                    value={form.timezone}
                    onChange={(e) => handleChange("timezone", e.target.value)}
                    placeholder="Asia/Kolkata"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-medium"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Copyright Footer Text</label>
                <input
                  type="text"
                  value={form.copyrightText}
                  onChange={(e) => handleChange("copyrightText", e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-medium"
                />
              </div>
            </div>

            {/* Custom CSS & Styling Overrides */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-[0_8px_30px_rgb(0,0,0,0.04)] space-y-4">
              <div className="flex items-center gap-2 text-indigo-600 font-bold text-sm border-b pb-3">
                <Code className="w-4 h-4" />
                <h3>Custom CSS & Styling Injection</h3>
              </div>
              <p className="text-xs text-slate-500">
                Inject custom CSS overrides and root styling variables dynamically across the entire website.
              </p>
              <div>
                <textarea
                  rows={5}
                  value={form.customCss}
                  onChange={(e) => handleChange("customCss", e.target.value)}
                  placeholder="/* Overwrite default site styling */&#10;:root {&#10;  --brand-primary: #6605c7;&#10;}"
                  className="w-full p-3 rounded-xl border border-slate-300 font-mono text-xs bg-slate-950 text-indigo-300 shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)] focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>
        </div>
      )}



      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* ── TAB: GOOGLE & SOCIAL DISCOVERY ── */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      {activeTab === "discovery" && (
        <div className="space-y-6 animate-fade-in">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-[0_8px_30px_rgb(0,0,0,0.04)] space-y-4">
              <div className="flex items-center gap-2 text-indigo-600 font-bold text-sm border-b pb-3">
                <Globe className="w-4 h-4" />
                <h3>Google Tag & Tracking Identifiers</h3>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Google Tag Manager ID</label>
                <input
                  type="text"
                  value={form.googleTagManagerId}
                  onChange={(e) => handleChange("googleTagManagerId", e.target.value)}
                  placeholder="GTM-PSHKZ8FK"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono text-xs shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)]"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-700">Google Analytics 4 (GA4)</label>
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    Active
                  </span>
                </div>
                <input
                  type="text"
                  value={form.googleAnalyticsId}
                  onChange={(e) => handleChange("googleAnalyticsId", e.target.value)}
                  placeholder="G-1Z8RYR9RBW"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono text-xs shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)]"
                />

                {/* Google Tag (gtag.js) Embedded Snippet Helper */}
                <div className="mt-3 p-3.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-indigo-400 flex items-center gap-1.5">
                      <Code className="w-3.5 h-3.5" />
                      Google Tag (gtag.js) Script Code
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const snippet = `<!-- Google tag (gtag.js) -->\n<script async src="https://www.googletagmanager.com/gtag/js?id=${form.googleAnalyticsId || "G-1Z8RYR9RBW"}"></script>\n<script>\n  window.dataLayer = window.dataLayer || [];\n  function gtag(){dataLayer.push(arguments);}\n  gtag('js', new Date());\n\n  gtag('config', '${form.googleAnalyticsId || "G-1Z8RYR9RBW"}');\n</script>`;
                        copyToClipboard(snippet, "Google Tag Snippet");
                      }}
                      className="text-[11px] font-mono text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition-colors"
                    >
                      <Copy className="w-3 h-3" />
                      {copiedKey === "Google Tag Snippet" ? "Copied!" : "Copy Code"}
                    </button>
                  </div>
                  <pre className="text-[10.5px] font-mono text-emerald-300/90 overflow-x-auto p-2.5 bg-black/50 rounded-lg whitespace-pre select-all leading-relaxed">
                    {`<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=${form.googleAnalyticsId || "G-1Z8RYR9RBW"}"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());

  gtag('config', '${form.googleAnalyticsId || "G-1Z8RYR9RBW"}');
</script>`}
                  </pre>
                  <div className="flex items-center justify-between pt-0.5">
                    <p className="text-[10px] text-slate-400">
                      Auto-loaded in Next.js layout &amp; Custom &lt;head&gt; scripts
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        const targetId = form.googleAnalyticsId || "G-1Z8RYR9RBW";
                        const snippet = `<!-- Google tag (gtag.js) -->\n<script async src="https://www.googletagmanager.com/gtag/js?id=${targetId}"></script>\n<script>\n  window.dataLayer = window.dataLayer || [];\n  function gtag(){dataLayer.push(arguments);}\n  gtag('js', new Date());\n\n  gtag('config', '${targetId}');\n</script>`;
                        if (!form.customHeadScripts.includes(targetId)) {
                          const updated = form.customHeadScripts ? `${form.customHeadScripts}\n${snippet}` : snippet;
                          handleChange("customHeadScripts", updated);
                          setToast({ message: "Google tag code inserted into Custom <head> Scripts!", type: "success" });
                        } else {
                          setToast({ message: "Google tag code is already in Custom <head> Scripts", type: "success" });
                        }
                      }}
                      className="text-[10.5px] text-indigo-400 hover:text-indigo-300 font-semibold underline"
                    >
                      Sync into &lt;head&gt; Scripts
                    </button>
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Facebook / Meta Pixel ID</label>
                <input
                  type="text"
                  value={form.facebookPixelId}
                  onChange={(e) => handleChange("facebookPixelId", e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono text-xs shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)]"
                />
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-[0_8px_30px_rgb(0,0,0,0.04)] space-y-4">
              <div className="flex items-center gap-2 text-indigo-600 font-bold text-sm border-b pb-3">
                <Globe className="w-4 h-4" />
                <h3>Social Channels & WhatsApp Widget</h3>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  WhatsApp Support Number (Powers Floating Chat Widget)
                </label>
                <input
                  type="text"
                  value={form.whatsappNumber}
                  onChange={(e) => handleChange("whatsappNumber", e.target.value)}
                  placeholder="+918143797779"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500 text-xs font-mono"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Facebook URL</label>
                  <input
                    type="text"
                    value={form.facebookUrl}
                    onChange={(e) => handleChange("facebookUrl", e.target.value)}
                    placeholder="https://facebook.com/..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Instagram URL</label>
                  <input
                    type="text"
                    value={form.instagramUrl}
                    onChange={(e) => handleChange("instagramUrl", e.target.value)}
                    placeholder="https://instagram.com/..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">X (Twitter) URL</label>
                  <input
                    type="text"
                    value={form.twitterUrl}
                    onChange={(e) => handleChange("twitterUrl", e.target.value)}
                    placeholder="https://x.com/..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">LinkedIn URL</label>
                  <input
                    type="text"
                    value={form.linkedinUrl}
                    onChange={(e) => handleChange("linkedinUrl", e.target.value)}
                    placeholder="https://linkedin.com/company/..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">YouTube Channel URL</label>
                  <input
                    type="text"
                    value={form.youtubeUrl}
                    onChange={(e) => handleChange("youtubeUrl", e.target.value)}
                    placeholder="https://youtube.com/@..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Telegram Community URL</label>
                  <input
                    type="text"
                    value={form.telegramUrl}
                    onChange={(e) => handleChange("telegramUrl", e.target.value)}
                    placeholder="https://t.me/..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)]"
                  />
                </div>
              </div>
            </div>

            {/* Mobile App Download Banner Settings */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-[0_8px_30px_rgb(0,0,0,0.04)] space-y-4">
              <div className="flex items-center justify-between border-b pb-3">
                <div className="flex items-center gap-2 text-purple-600 font-bold text-sm">
                  <Smartphone className="w-4 h-4" />
                  <h3>Mobile App &amp; Play Store Download Prompt</h3>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.enableAppBanner !== false}
                    onChange={(e) => handleChange("enableAppBanner", e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                  <span className="ml-2 text-xs font-semibold text-slate-700">
                    {form.enableAppBanner !== false ? "Active" : "Disabled"}
                  </span>
                </label>
              </div>

              <p className="text-xs text-slate-500 leading-relaxed">
                When enabled, visitors browsing from mobile screens (&lt;768px or Android/iOS devices) will see a floating bottom-sheet banner prompting them to install the VidyaLoans mobile app. Once dismissed, it respects a 7-day cooldown.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Google Play Store URL
                  </label>
                  <input
                    type="text"
                    value={form.playStoreUrl}
                    onChange={(e) => handleChange("playStoreUrl", e.target.value)}
                    placeholder="https://play.google.com/store/apps/details?id=in.vidyaloans.app&hl=en-US&ah=Vx9t8taW0pweH2uHyGVMktR2FLs"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)] focus:ring-2 focus:ring-purple-500"
                  />
                  <span className="text-[10.5px] text-slate-400 mt-1 block">
                    Android devices will attempt direct <code className="text-purple-600 font-semibold">market://</code> intent with fallback to this web URL.
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Apple App Store URL (Optional)
                  </label>
                  <input
                    type="text"
                    value={form.appStoreUrl}
                    onChange={(e) => handleChange("appStoreUrl", e.target.value)}
                    placeholder="https://apps.apple.com/app/vidyaloans/id..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)] focus:ring-2 focus:ring-purple-500"
                  />
                  <span className="text-[10.5px] text-slate-400 mt-1 block">
                    iOS visitors will be redirected to this link when tapped.
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 p-2.5 bg-purple-50/70 border border-purple-100 rounded-xl text-[11px] text-purple-800">
                <span className="font-bold">Pro-tip:</span>
                <span>The package identifier <code className="font-semibold text-purple-900">in.vidyaloans.app</code> is also embedded in the website &lt;head&gt; meta tags for native Android browser smart banners.</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-[0_8px_30px_rgb(0,0,0,0.04)] space-y-3">
              <div className="flex items-center justify-between border-b pb-3">
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <Code className="w-4 h-4 text-indigo-600" />
                  Custom &lt;head&gt; Scripts (GTM &amp; Google Tag / gtag.js)
                </h3>
                <span className="text-[10.5px] text-slate-500 font-medium">Auto-injected in global &lt;head&gt;</span>
              </div>
              <textarea
                rows={7}
                value={form.customHeadScripts}
                onChange={(e) => handleChange("customHeadScripts", e.target.value)}
                className="w-full p-3 rounded-xl border border-slate-300 font-mono text-xs bg-slate-950 text-emerald-300 shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)]"
              />
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-[0_8px_30px_rgb(0,0,0,0.04)] space-y-3">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2 border-b pb-3">
                <Terminal className="w-4 h-4 text-indigo-600" />
                Custom &lt;body&gt; Scripts (GTM NoScript)
              </h3>
              <textarea
                rows={5}
                value={form.customBodyScripts}
                onChange={(e) => handleChange("customBodyScripts", e.target.value)}
                className="w-full p-3 rounded-xl border border-slate-300 font-mono text-xs bg-slate-950 text-emerald-300 shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)]"
              />
            </div>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* ── TAB: EMAIL & AWS SES ── */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      {activeTab === "email" && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-[0_8px_30px_rgb(0,0,0,0.04)] space-y-4 animate-fade-in">
          <div className="flex items-center gap-2 text-indigo-600 font-bold text-sm border-b pb-3">
            <Mail className="w-4 h-4" />
            <h3>Amazon Simple Email Service (AWS SES)</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">AWS Region</label>
              <input
                type="text"
                value={form.awsSesRegion}
                onChange={(e) => handleChange("awsSesRegion", e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono text-xs shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Sender Email Address</label>
              <input
                type="email"
                value={form.awsSesSenderEmail}
                onChange={(e) => handleChange("awsSesSenderEmail", e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono text-xs shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">AWS Access Key</label>
              <input
                type="text"
                value={form.awsSesAccessKey}
                onChange={(e) => handleChange("awsSesAccessKey", e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono text-xs shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">AWS Secret Key</label>
              <div className="relative">
                <input
                  type={showAwsSecret ? "text" : "password"}
                  value={form.awsSesSecretKey}
                  onChange={(e) => handleChange("awsSesSecretKey", e.target.value)}
                  className="w-full px-3 py-2 pr-10 rounded-xl border border-slate-300 font-mono text-xs shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)]"
                />
                <button
                  type="button"
                  onClick={() => setShowAwsSecret(!showAwsSecret)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-indigo-600"
                >
                  {showAwsSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          {/* AWS SES SMTP Relay */}
          <div className="pt-4 border-t border-slate-100">
            <div className="flex items-center gap-2 text-indigo-600 font-bold text-sm mb-3">
              <Mail className="w-4 h-4" />
              <h3>AWS SES SMTP Relay Configuration</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">SMTP Host</label>
                <input
                  type="text"
                  value={form.smtpHost}
                  onChange={(e) => handleChange("smtpHost", e.target.value)}
                  placeholder="email-smtp.ap-south-1.amazonaws.com"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono text-xs shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">SMTP Port</label>
                <input
                  type="number"
                  value={form.smtpPort}
                  onChange={(e) => handleChange("smtpPort", parseInt(e.target.value) || 587)}
                  placeholder="587"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono text-xs shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">SMTP Username</label>
                <input
                  type="text"
                  value={form.smtpUser}
                  onChange={(e) => handleChange("smtpUser", e.target.value)}
                  placeholder="AKIA..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono text-xs shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">SMTP Password</label>
                <div className="relative">
                  <input
                    type={showSmtpPassword ? "text" : "password"}
                    value={form.smtpPassword}
                    onChange={(e) => handleChange("smtpPassword", e.target.value)}
                    placeholder="••••••••••••••••••••••••"
                    className="w-full px-3 py-2 pr-10 rounded-xl border border-slate-300 font-mono text-xs shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSmtpPassword(!showSmtpPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-indigo-600"
                  >
                    {showSmtpPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
