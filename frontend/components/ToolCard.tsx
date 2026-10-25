import Link from "next/link";
import Image from "next/image";

export default function ToolCard({ href, bg, icon, title, desc, cta, large = false, border = false }: {
    href: string; bg: string; icon: string; title: string; desc: string; cta: string; large?: boolean; border?: boolean;
}) {
    return (
        <Link
            href={href}
            className={`flex ${large ? "flex-col md:flex-row md:items-center" : "flex-col"} p-8 rounded-xl ${bg} hover:shadow-2xl hover:-translate-y-2 transition-all duration-500 group border ${border ? "border-[#6605c7]/10" : "border-white/50"}`}
        >
            <div className={`flex items-start ${large ? "gap-8 mb-0" : "gap-6 mb-8"}`}>
                <div className={`${large ? "w-16 h-16" : "w-12 h-12"} bg-white/80 rounded-xl flex items-center justify-center shrink-0 shadow-sm overflow-hidden p-2.5`}>
                    {icon.startsWith("/") || icon.startsWith("http") ? (
                        <Image src={icon} alt={title} width={48} height={48} className="w-full h-full object-contain" />
                    ) : (
                        <i className={`ph ${icon.startsWith("ph-") ? icon : `ph-${icon}`} text-2xl text-[#6605c7]`} />
                    )}
                </div>
                <div className="flex-1">
                    <h3 className="text-xl font-black mb-2 text-gray-900 leading-tight">{title}</h3>
                    <p className="text-gray-500 text-[13px] leading-relaxed font-medium">{desc}</p>
                </div>
            </div>
            <div className={`${large ? "mt-6 md:mt-0 md:ml-auto" : "mt-auto"} flex justify-end`}>
                <span className="inline-flex items-center gap-2 text-[#6605c7] font-bold text-[10px] uppercase tracking-widest group-hover:gap-3 transition-all">
                    {cta} <span className="material-symbols-outlined text-sm" aria-hidden="true">arrow_forward</span>
                </span>
            </div>
        </Link>
    );
}
