import { banks } from "@/lib/bankData";

export const metadata = {
    title: "Partner Banks & Reviews - VidyaLoan",
    description: "Compare education loan offers from top global banks. Check reviews, interest rates, and funding limits.",
};

export default function BankReviewsPage() {
    const bankList = Object.values(banks);

    return (
        <section className="max-w-7xl mx-auto px-6 pt-32 pb-24">
            <div className="text-center mb-16">
                <span className="text-[#6605c7] font-bold text-[11px] tracking-[0.2em] uppercase mb-4 block">Our Partners</span>
                <h1 className="text-5xl md:text-6xl font-bold font-display mb-6 text-gray-900">
                    Partner <span className="text-[#6605c7]">Banks</span> & Reviews
                </h1>
                <p className="text-xl text-gray-500 max-w-2xl mx-auto leading-relaxed font-sans">
                    Compare offers, read reviews, and find the perfect funding partner for your education.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {bankList.map((bank, i) => (
                    <div key={i} className="bg-white/80 backdrop-blur-xl border border-gray-100 rounded-[2rem] p-8 hover:shadow-2xl transition-all hover:-translate-y-2 group">
                        <div className="flex justify-between items-start mb-6">
                            <div className="w-16 h-16 rounded-2xl bg-white flex items-center justify-center shadow-sm border border-gray-100 p-2 overflow-hidden">
                                <img src={bank.logo} alt={bank.name} className="h-10 w-auto object-contain" />
                            </div>
                            <div className="flex items-center gap-1 bg-green-50 px-3 py-1 rounded-full border border-green-100">
                                <span className="material-symbols-outlined text-green-600 text-sm">star</span>
                                <span className="text-xs font-bold text-green-700">{bank.rating}</span>
                            </div>
                        </div>
                        <h3 className="text-2xl font-bold font-display mb-2 text-gray-900 group-hover:text-[#6605c7] transition-colors">
                            {bank.name}
                        </h3>
                        <p className="text-sm text-gray-500 mb-6 line-clamp-2">{bank.description}</p>

                        <div className="space-y-4 mb-8">
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-gray-500">Max Funding</span>
                                <span className="font-bold text-gray-900">{bank.maxLoan}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-gray-500">Interest Rate</span>
                                <span className="font-bold text-gray-900">{bank.interestRate}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-gray-500">Processing Time</span>
                                <span className="font-bold text-gray-900">
                                    {bank.approvalTime === "48h" ? "48 Hours" : bank.approvalTime === "72h" ? "72 Hours" : bank.approvalTime || "48 Hours"}
                                </span>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <a href={`/apply-loan?bank=${bank.slug}`} className="block w-full py-4 bg-[#1a1626] text-white text-center rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-[#6605c7] transition-all">
                                Apply Now
                            </a>
                            <a href={`/bank/${bank.slug}`} className="block w-full py-4 border border-gray-100 text-[#1a1626] text-center rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-gray-50 transition-all">
                                View Reviews
                            </a>
                            {/* <a href="/referral" className="flex items-center justify-center gap-2 w-full py-4 bg-gradient-to-r from-[#e0c389] to-[#d4a743] text-gray-900 text-center rounded-2xl font-bold text-xs uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all">
                                <span className="material-symbols-outlined text-sm">card_giftcard</span>
                                Refer & Earn
                            </a> */}
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
}
