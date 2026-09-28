"use client";

import React, { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useSiteSettings } from '@/contexts/SiteSettingsContext';

export default function WhatsAppWidget() {
    const pathname = usePathname();
    const { settings } = useSiteSettings();
    const [isVisible, setIsVisible] = useState(false);
    const [showTooltip, setShowTooltip] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => setIsVisible(true), 1500);
        const tooltipTimer = setTimeout(() => setShowTooltip(true), 4000);
        const hideTooltipTimer = setTimeout(() => setShowTooltip(false), 9000);

        return () => {
            clearTimeout(timer);
            clearTimeout(tooltipTimer);
            clearTimeout(hideTooltipTimer);
        };
    }, []);

    const openWhatsApp = () => {
        const rawNumber = settings?.whatsappNumber || process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || process.env.NEXT_PUBLIC_AWS_WHATSAPP_NUMBER || '+918143797779';
        const cleanNumber = rawNumber.replace(/[^0-9]/g, '');
        const siteName = settings?.siteName || "VidyaLoan";
        const message = encodeURIComponent(`Hi ${siteName} team! I'm interested in an education loan and would like to speak with a mentor.`);
        window.open(`https://wa.me/${cleanNumber}?text=${message}`, '_blank');
    };

    // Hide on dashboards and home page
    const isDashboard = pathname.startsWith('/staff') || pathname.startsWith('/admin') || pathname.startsWith('/bank');
    const isHomePage = pathname === '/';

    if (!isVisible || isDashboard || isHomePage) return null;

    return (
        <div className="fixed bottom-8 right-8 z-[100] flex flex-col items-end gap-3 group">
            {/* Tooltip/Prompt */}
            <div 
                className={`transition-all duration-500 transform ${showTooltip ? 'translate-x-0 opacity-100' : 'translate-x-10 opacity-0 pointer-events-none'}`}
            >
                <div className="bg-white rounded-2xl shadow-2xl p-5 border border-gray-100 max-w-[240px] relative">
                    <button 
                        onClick={() => setShowTooltip(false)}
                        className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 p-1"
                    >
                        <span className="material-symbols-outlined text-xs">close</span>
                    </button>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-white shrink-0">
                            <span className="material-symbols-outlined text-sm">support_agent</span>
                        </div>
                        <span className="text-[11px] font-black uppercase tracking-widest text-[#6605c7]">Mentor Support</span>
                    </div>
                    <p className="text-xs text-gray-600 font-bold leading-relaxed mb-3">
                        Need help with your study abroad financing? Chat with us on WhatsApp!
                    </p>
                    <button 
                        onClick={openWhatsApp}
                        className="w-full py-2 bg-[#25D366] text-white rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-[#20ba59] transition-all"
                    >
                        Chat Now
                    </button>
                    {/* Arrow */}
                    <div className="absolute -bottom-2 right-6 w-4 h-4 bg-white border-b border-r border-gray-100 rotate-45"></div>
                </div>
            </div>

            {/* Main Button */}
            <button
                onClick={openWhatsApp}
                className="relative flex items-center justify-center w-16 h-16 rounded-[2rem] bg-[#25D366] text-white shadow-[0_10px_40px_rgba(37,211,102,0.4)] hover:shadow-[0_15px_50px_rgba(37,211,102,0.5)] transition-all hover:-translate-y-1 hover:scale-105 active:scale-95 overflow-hidden"
            >
                {/* Shine Animation */}
                <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/20 to-white/0 -translate-x-full animate-[shimmer_3s_infinite]" />
                
                {/* Ping rings */}
                <div className="absolute inset-0 animate-ping opacity-20 bg-white rounded-[2rem]" />
                
                <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor" className="relative z-10 drop-shadow-md">
                    <path d="M12.031 6.172c-2.32 0-4.518.892-6.193 2.512-3.321 3.238-3.434 8.731-.26 12.115l-1.096 4.02 4.116-1.08c1.05.617 2.228.943 3.431.944h.005c4.717 0 8.558-3.722 8.561-8.305.002-2.22-.853-4.305-2.407-5.87-1.554-1.564-3.623-2.427-5.826-2.436h-.031zm5.221 11.216c-.237.643-1.141 1.206-1.583 1.284-.442.078-.962.138-2.889-.606-2.46-.95-4.04-3.376-4.162-3.535-.122-.16-1.002-1.285-1.002-2.451 0-1.166.589-1.739.846-1.998.257-.259.56-.324.747-.324.187 0 .373.001.536.009.172.008.406-.062.635.474.237.556.811 1.933.882 2.074.071.141.118.305.023.493-.095.187-.143.282-.283.443-.141.16-.296.357-.423.479-.141.135-.288.283-.124.556.164.272.729 1.171 1.564 1.896.7.6 1.296.792 1.562.923.237.118.374.1.512-.056.138-.157.6-.689.761-.924.161-.235.321-.194.542-.112.221.082 1.399.643 1.639.759.239.117.399.175.459.274.06.1.06.578-.177 1.221z" />
                </svg>
            </button>
            <style jsx>{`
                @keyframes shimmer {
                    0% { transform: translateX(-100%); }
                    100% { transform: translateX(100%); }
                }
                @keyframes ping-slow {
                    0% { transform: scale(1); opacity: 0.1; }
                    50% { opacity: 0.2; }
                    100% { transform: scale(1.5); opacity: 0; }
                }
            `}</style>
        </div>
    );
}
