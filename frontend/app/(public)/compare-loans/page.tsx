"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { banks } from "@/lib/bankData";
import { referenceApi } from "@/lib/api";

const STATIC_LOAN_DATA = Object.values(banks).map(bank => ({
    id: bank.slug,
    bank: bank.name,
    logo: bank.logo,
    rate: bank.interestRate,
    fee: bank.specifications.find(s => s.label === "Processing Fee")?.value || "1% + GST",
    tenure: bank.specifications.find(s => s.label === "Repayment Tenure")?.value || "Up to 15 Years",
    collateral: bank.specifications.find(s => s.label === "Collateral")?.value || "Profile based",
    tag: bank.uniqueFeatures[0]?.title || "Premium Partner"
}));

export default function CompareLoansPage() {
    const [loanData, setLoanData] = useState(STATIC_LOAN_DATA);
    const [selected, setSelected] = useState<string[]>([]);
    const [showModal, setShowModal] = useState(false);

    useEffect(() => {
        let isMounted = true;
        const loadDynamicLoans = async () => {
            try {
                const res: any = await referenceApi.getBanks();
                const list = res?.data || res || [];
                if (Array.isArray(list) && list.length > 0 && isMounted) {
                    const dynamicMapped = list.map((b: any) => {
                        const slug = (b.shortName || b.name.toLowerCase().replace(/[^a-z0-9]/g, "")).toLowerCase();
                        const staticMatch = STATIC_LOAN_DATA.find(s => s.id === slug);
                        return {
                            id: slug,
                            bank: b.name,
                            logo: b.logoUrl || b.logo || staticMatch?.logo || `/banks/${slug}.png`,
                            rate: b.interestRateMin ? `${b.interestRateMin}% - ${b.interestRateMax || (b.interestRateMin + 3)}% p.a.` : (staticMatch?.rate || "From 10.25% p.a."),
                            fee: b.processingFee || staticMatch?.fee || "1% + GST",
                            tenure: staticMatch?.tenure || "Up to 15 Years",
                            collateral: b.collateralRequired ? "Collateral Required" : (b.collateralFreeLimit ? `Collateral-free up to ₹${b.collateralFreeLimit}` : "Profile based"),
                            tag: b.isPopular ? "Most Popular Partner" : (staticMatch?.tag || "Active Lending Partner")
                        };
                    });
                    setLoanData(dynamicMapped);
                }
            } catch (err) {
                console.error("Failed to fetch dynamic banks for loan comparison:", err);
            }
        };

        loadDynamicLoans();
        return () => { isMounted = false; };
    }, []);

    const toggleLoan = (id: string) => {
        if (selected.includes(id)) {
            setSelected(selected.filter(i => i !== id));
        } else {
            if (selected.length < 3) {
                setSelected([...selected, id]);
            } else {
                alert("You can compare up to 3 loans at a time.");
            }
        }
    };

    const selectedData = loanData.filter(l => selected.includes(l.id));

    return (
        <main className="relative z-10 pt-28 pb-20 bg-transparent min-h-screen">
            <section className="max-w-6xl mx-auto px-6">
                <div className="mb-12">
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#6605c7]/[0.05] rounded-lg text-[10px] font-bold text-[#6605c7] uppercase tracking-widest mb-4 border border-[#6605c7]/[0.1]">
                        <span className="material-symbols-outlined text-[14px]">balance</span>
                        Loan Marketplace
                    </div>
                    <h1 className="text-3xl font-bold text-gray-900 mb-4">
                        Compare Education Loans
                    </h1>
                    <p className="text-[13px] text-gray-500 max-w-xl leading-relaxed">
                        Find the perfect loan for your education journey. Compare interest rates, processing fees, and terms from India's top lenders side-by-side.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {loanData.map((loan) => (
                        <div key={loan.id} className={`group bg-white border border-gray-100 rounded-xl p-6 transition-all duration-200 hover:border-[#6605c7]/[0.1] hover:shadow-lg hover:shadow-[#6605c7]/[0.02] ${selected.includes(loan.id) ? "border-[#6605c7] ring-1 ring-[#6605c7]/[0.1] bg-[#6605c7]/[0.01]" : ""}`}>
                            <div className="flex items-center gap-4 mb-6">
                                <div className="w-12 h-12 bg-white rounded-xl p-2.5 flex items-center justify-center border border-gray-100 shadow-sm overflow-hidden">
                                    <img
                                        src={loan.logo}
                                        alt={loan.bank}
                                        className="w-full h-full object-contain"
                                        onError={(e) => {
                                            (e.target as HTMLElement).style.display = 'none';
                                            const parent = (e.target as HTMLElement).parentElement;
                                            if (parent && !parent.querySelector('.fallback-loan-badge')) {
                                                const badge = document.createElement('div');
                                                badge.className = 'fallback-loan-badge w-full h-full rounded-lg bg-purple-50 text-[#6605c7] flex items-center justify-center font-black text-xs';
                                                badge.innerText = loan.bank.slice(0, 2).toUpperCase();
                                                parent.appendChild(badge);
                                            }
                                        }}
                                    />
                                </div>
                                <div>
                                    <h3 className="font-bold text-gray-900 text-[15px] leading-tight">{loan.bank}</h3>
                                    <span className="text-[10px] font-bold text-[#6605c7] uppercase tracking-widest">{loan.tag}</span>
                                </div>
                            </div>

                            <div className="space-y-4 mb-8">
                                <div className="flex justify-between items-baseline">
                                    <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Interest Rate</span>
                                    <span className="text-xl font-bold text-[#6605c7]">{loan.rate}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Processing Fee</span>
                                    <span className="text-[13px] font-bold text-gray-900">{loan.fee}</span>
                                </div>
                            </div>

                            <div className="flex gap-2">
                                <a href={`/apply-loan?bank=${loan.id}`} className="flex-1 py-2.5 bg-[#6605c7] text-white rounded-lg font-bold uppercase tracking-widest text-[10px] hover:bg-[#5504a6] transition-all text-center flex items-center justify-center">Apply Now</a>
                                <button
                                    onClick={() => toggleLoan(loan.id)}
                                    className={`px-4 py-2.5 rounded-lg font-bold uppercase tracking-widest text-[10px] transition-all border ${selected.includes(loan.id) ? "bg-[#6605c7] text-white border-[#6605c7]" : "border-gray-100 text-gray-600 hover:bg-gray-50"}`}
                                >
                                    {selected.includes(loan.id) ? "Selected" : "Compare"}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                {selected.length > 0 && (
                    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 w-full max-w-xl px-6 z-50">
                        <div className="bg-[#1a1a2e] border border-white/10 rounded-xl p-2 pl-6 flex items-center justify-between shadow-2xl">
                            <span className="text-white font-bold text-[13px]">
                                <span className="text-emerald-400">{selected.length}</span> {selected.length === 1 ? "Loan" : "Loans"} Selected
                            </span>
                            <div className="flex gap-4 items-center pr-1">
                                <button onClick={() => setSelected([])} className="text-[11px] font-bold text-gray-400 hover:text-white uppercase tracking-widest transition-colors">Clear</button>
                                <button
                                    onClick={() => setShowModal(true)}
                                    disabled={selected.length < 2}
                                    className="px-6 py-2 bg-[#6605c7] text-white rounded-lg font-bold uppercase tracking-widest text-[11px] hover:bg-[#5504a6] transition-all disabled:opacity-30 disabled:hover:bg-[#6605c7]"
                                >
                                    Compare Now
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </section>

            {showModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-gray-900/60 backdrop-blur-sm">
                    <div className="bg-white rounded-xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl animate-fade-in-up flex flex-col">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                            <div>
                                <h2 className="text-xl font-bold text-gray-900">Loan Comparison Matrix</h2>
                                <p className="text-[11px] text-gray-500 uppercase tracking-widest font-bold mt-1">Detailed Analysis</p>
                            </div>
                            <button onClick={() => setShowModal(false)} className="w-8 h-8 rounded-lg border border-gray-100 flex items-center justify-center hover:bg-gray-50 transition-colors">
                                <span className="material-symbols-outlined text-[18px]">close</span>
                            </button>
                        </div>
                        <div className="p-8 overflow-y-auto custom-scrollbar">
                            <table className="w-full">
                                <thead>
                                    <tr>
                                        <th className="py-4 px-4"></th>
                                        {selectedData.map(loan => (
                                            <th key={loan.id} className="py-4 px-4 bg-gray-50/50 first:rounded-l-xl last:rounded-r-xl">
                                                <div className="flex flex-col items-center gap-2">
                                                    <div className="w-10 h-10 flex items-center justify-center">
                                                        <img
                                                            src={loan.logo}
                                                            alt={loan.bank}
                                                            className="w-full h-auto object-contain max-h-10"
                                                            onError={(e) => {
                                                                (e.target as HTMLElement).style.display = 'none';
                                                                const parent = (e.target as HTMLElement).parentElement;
                                                                if (parent && !parent.querySelector('.fallback-modal-badge')) {
                                                                    const badge = document.createElement('div');
                                                                    badge.className = 'fallback-modal-badge w-8 h-8 rounded-lg bg-purple-50 text-[#6605c7] flex items-center justify-center font-black text-xs';
                                                                    badge.innerText = loan.bank.slice(0, 2).toUpperCase();
                                                                    parent.appendChild(badge);
                                                                }
                                                            }}
                                                        />
                                                    </div>
                                                    <span className="font-bold text-gray-900 text-[11px] uppercase tracking-wider whitespace-nowrap">{loan.bank}</span>
                                                </div>
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50 text-center">
                                    {[
                                        { label: "Interest Rate", key: "rate" },
                                        { label: "Processing Fee", key: "fee" },
                                        { label: "Tenure", key: "tenure" },
                                        { label: "Collateral", key: "collateral" }
                                    ].map((row, i) => (
                                        <tr key={i} className="hover:bg-gray-50/30 transition-colors">
                                            <td className="py-5 px-4 text-left font-bold text-gray-400 uppercase tracking-widest text-[9px] whitespace-nowrap">{row.label}</td>
                                            {selectedData.map(loan => (
                                                <td key={loan.id} className={`py-5 px-4 ${row.key === "rate" ? "text-lg font-bold text-[#6605c7]" : "text-[13px] font-bold text-gray-900"}`}>
                                                    {loan[row.key as keyof typeof loan]}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                    <tr>
                                        <td className="py-8"></td>
                                        {selectedData.map(loan => (
                                            <td key={loan.id} className="py-8 px-4">
                                                <a href={`/apply-loan?bank=${loan.id}`} className="w-full py-2.5 bg-[#6605c7] text-white rounded-lg font-bold uppercase tracking-widest text-[10px] hover:bg-[#5504a6] transition-all shadow-lg text-center inline-block">Apply Now</a>
                                            </td>
                                        ))}
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
}
