"use client";

import Link from "next/link";
import Image from "next/image";
import { useSiteSettings } from "@/contexts/SiteSettingsContext";

export default function Footer() {
    const { settings } = useSiteSettings();

    const siteName = settings?.siteName || "VidyaLoans";
    const logoUrl = settings?.logoLightUrl || "/images/vidyaloans-logo-transparent.png";
    const tagline = settings?.tagline || "Empowering students with transparent, flexible, and accessible education financing solutions worldwide.";
    const supportEmail = settings?.supportEmail || "support@vidyaloans.in";
    const phone = settings?.phone || "+91 8143797779";
    const copyrightText = settings?.copyrightText || `© ${new Date().getFullYear()} ${siteName}® Inc. All rights reserved.`;

    return (
        <footer className="bg-[#0c0714] text-white relative overflow-hidden">
            {/* Subtle gradient glow at top */}
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-purple-500/40 to-transparent"></div>
            <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[600px] h-[200px] bg-[#6605c7]/5 rounded-full blur-[100px] pointer-events-none"></div>

            {/* Main Footer Content */}
            <div className="max-w-7xl mx-auto px-6 pt-20 pb-10 relative z-10">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-12 lg:gap-8 mb-16">

                    {/* Brand Column */}
                    <div className="lg:col-span-3">
                        <Link href="/" className="flex items-center gap-2 mb-6 group">
                            <Image
                                src={logoUrl}
                                alt={`${siteName} Logo`}
                                width={40}
                                height={40}
                                className="w-10 h-10 object-contain"
                            />
                            <span className="text-xl font-bold font-display tracking-tight text-white flex items-center">
                                {siteName}
                                <sup className="text-[10px] font-semibold text-purple-400 ml-0.5">®</sup>
                            </span>
                        </Link>
                        <p className="text-gray-400 text-[13px] leading-relaxed mb-8 max-w-xs font-normal">
                            {tagline}
                        </p>

                        {/* Social Icons */}
                        <div className="flex items-center gap-2.5 mb-8">
                            {settings?.instagramUrl && (
                                <SocialIcon href={settings.instagramUrl} icon="/images/social/instagram.png" alt="Instagram" color="hover:bg-[#E1306C]" />
                            )}
                            {settings?.linkedinUrl && (
                                <SocialIcon href={settings.linkedinUrl} icon="/images/social/linkedin.png" alt="LinkedIn" color="hover:bg-[#0077B5]" />
                            )}
                            {settings?.youtubeUrl && (
                                <SocialIcon href={settings.youtubeUrl} icon="/images/social/youtube.png" alt="YouTube" color="hover:bg-red-600" />
                            )}
                            {settings?.twitterUrl && (
                                <SocialIcon href={settings.twitterUrl} icon="/images/social/twitter.png" alt="Twitter" color="hover:bg-black" />
                            )}
                        </div>

                        {/* Contact */}
                        <div className="space-y-1">
                            <a href={`mailto:${supportEmail}`} className="flex items-center min-h-[44px] py-1 gap-2.5 text-gray-400 hover:text-white text-[13px] transition-colors group">
                                <span className="material-symbols-outlined text-base text-gray-500 group-hover:text-[#6605c7] transition-colors">mail</span>
                                {supportEmail}
                            </a>
                            <a href={`tel:${phone.replace(/\s+/g, '')}`} className="flex items-center min-h-[44px] py-1 gap-2.5 text-gray-400 hover:text-white text-[13px] transition-colors group">
                                <span className="material-symbols-outlined text-base text-gray-500 group-hover:text-[#6605c7] transition-colors">call</span>
                                {phone}
                            </a>
                        </div>
                    </div>

                    {/* About VidyaLoans */}
                    <div className="lg:col-span-2">
                        <h4 className="text-[11px] font-bold uppercase tracking-[0.1em] text-white mb-4">About VidyaLoans®</h4>
                        <ul className="space-y-0.5 text-[13px]">
                            <FooterLink href="/about-us" label="Our Story" />
                            <FooterLink href="/how-it-works" label="How It Works" />
                            <FooterLink href="/privacy-policy" label="Privacy Policy" />
                            <FooterLink href="/terms-conditions" label="Terms & Conditions" />
                            <FooterLink href="/cookies" label="Cookie Policy" />
                            <FooterLink href="/contact" label="Contact Us" />
                        </ul>
                    </div>

                    {/* Resources */}
                    <div className="lg:col-span-2">
                        <h4 className="text-[11px] font-bold uppercase tracking-[0.1em] text-white mb-4">Resources</h4>
                        <ul className="space-y-0.5 text-[13px]">
                            <FooterLink href="/compare-universities" label="University Selection" />
                            <FooterLink href="/compare-loans" label="Education Loans" />
                            <FooterLink href="/blog" label="Blogs & News" />
                            <FooterLink href="/bank-reviews" label="Bank Reviews" />
                            <FooterLink href="/faq" label="FAQ" />
                            <FooterLink href="/community/discussions" label="Community" />
                        </ul>
                    </div>

                    {/* AI Tools */}
                    <div className="lg:col-span-2">
                        <h4 className="text-[11px] font-bold uppercase tracking-[0.1em] text-white mb-4">AI Tools</h4>
                        <ul className="space-y-0.5 text-[13px]">
                            <FooterLink href="/emi" label="EMI Calculator" />
                            <FooterLink href="/loan-eligibility" label="Eligibility Checker" />
                            <FooterLink href="/sop-writer" label="SOP Writer" />
                            <FooterLink href="/grade-converter" label="Grade Converter" />
                            <FooterLink href="/admit-predictor" label="Admit Predictor" />
                            <FooterLink href="/repayment-stress" label="Stress Simulator" />
                        </ul>
                    </div>

                    {/* Offices */}
                    <div className="lg:col-span-3">
                        <h4 className="text-[11px] font-bold uppercase tracking-[0.1em] text-white mb-4">Offices</h4>
                        <ul className="space-y-1 text-[13px]">
                            <li className="flex items-start gap-2 text-gray-400 min-h-[44px] py-1">
                                <span className="material-symbols-outlined text-[#6605c7] text-base mt-0.5">location_on</span>
                                <div>
                                    <span className="text-white font-medium block">Nuzvidu</span>
                                    <span className="text-[11px] text-gray-500">Headquarters</span>
                                </div>
                            </li>
                            {/* {["Hyderabad", "Visakhapatnam", "Vijayawada", "Chennai"].map((city) => (
                                <li key={city} className="flex items-start gap-2.5 text-gray-400">
                                    <span className="material-symbols-outlined text-[#6605c7] text-base mt-0.5">location_on</span>
                                    {city}
                                </li>
                            ))} */}
                        </ul>
                    </div>
                </div>

                {/* Bottom Bar */}
                <div className="pt-8 border-t border-white/[0.06]">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                            <p suppressHydrationWarning className="text-[11px] text-gray-500 order-3 md:order-1 font-normal opacity-80">
                                {copyrightText}
                            </p>

                            {/* Made in India */}
                            {/* <p className="text-[11px] text-gray-400 order-2 md:order-3 flex items-center gap-1.5 font-normal opacity-80">
                            Made with <span className="text-red-400/80">❤</span> in India for students worldwide
                        </p> */}
                    </div>
                </div>
            </div>
        </footer>
    );
}

function SocialIcon({ href, icon, alt, color }: { href: string; icon: string; alt: string; color: string }) {
    return (
        <a
            href={href}
            className={`min-w-[44px] min-h-[44px] w-11 h-11 bg-white/[0.05] ${color} rounded-lg flex items-center justify-center transition-all duration-300 hover:scale-105 hover:shadow-lg`}
        >
            <img src={icon} alt={alt} className="w-[18px] h-[18px] opacity-70 group-hover:opacity-100" />
        </a>
    );
}

function FooterLink({ href, label }: { href: string; label: string }) {
    return (
        <li>
            <Link href={href} className="text-gray-400/80 hover:text-white transition-colors inline-flex items-center min-h-[44px] py-1.5 font-normal">
                {label}
            </Link>
        </li>
    );
}
