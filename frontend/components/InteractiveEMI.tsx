"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

export default function InteractiveEMI() {
    const [loanAmount, setLoanAmount] = useState(2000000); // ₹20,00,000
    const [interestRate, setInterestRate] = useState(9.5);
    const [tenure, setTenure] = useState(7); // years

    const { emi, totalInterest, totalPayment } = useMemo(() => {
        const P = loanAmount;
        const r = interestRate / 12 / 100; // monthly rate
        const n = tenure * 12; // total months

        if (r === 0) {
            const emi = P / n;
            return { emi: Math.round(emi), totalInterest: 0, totalPayment: P };
        }

        const emi = (P * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
        const totalPayment = Math.round(emi * n);
        const totalInterest = totalPayment - P;

        return {
            emi: Math.round(emi),
            totalInterest,
            totalPayment,
        };
    }, [loanAmount, interestRate, tenure]);

    const formatCurrency = (val: number) =>
        "₹ " + val.toLocaleString("en-IN");

    const principalPercent = (loanAmount / totalPayment) * 100;

    return (
        <div className="bg-white/70 backdrop-blur-md p-8 rounded-xl shadow-2xl border border-gray-100">
            <div className="space-y-8">
                {/* Loan Amount Slider */}
                <div>
                    <div className="flex justify-between mb-3">
                        <label htmlFor="interactive-emi-amount" className="text-[12px] font-black uppercase tracking-widest text-gray-700">
                            Loan Amount
                        </label>
                        <span className="text-[#6605c7] font-black text-[13px]">
                            {formatCurrency(loanAmount)}
                        </span>
                    </div>
                    <input
                        id="interactive-emi-amount"
                        type="range"
                        aria-label="Loan Amount"
                        aria-valuemin={100000}
                        aria-valuemax={10000000}
                        aria-valuenow={loanAmount}
                        aria-valuetext={formatCurrency(loanAmount)}
                        min={100000}
                        max={10000000}
                        step={50000}
                        value={loanAmount}
                        onChange={(e) => setLoanAmount(Number(e.target.value))}
                        className="w-full h-1.5 bg-gray-100 rounded-full appearance-none cursor-pointer accent-[#6605c7] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6605c7] focus-visible:ring-offset-2"
                        style={{
                            background: `linear-gradient(to right, #6605c7 ${((loanAmount - 100000) / (10000000 - 100000)) * 100}%, #f3f4f6 ${((loanAmount - 100000) / (10000000 - 100000)) * 100}%)`,
                        }}
                    />
                    <div className="flex justify-between mt-1.5">
                        <span className="text-[11px] text-gray-500 font-bold">₹1L</span>
                        <span className="text-[11px] text-gray-500 font-bold">₹1Cr</span>
                    </div>
                </div>

                {/* Interest Rate Slider */}
                <div>
                    <div className="flex justify-between mb-3">
                        <label htmlFor="interactive-emi-rate" className="text-[12px] font-black uppercase tracking-widest text-gray-700">
                            Interest Rate
                        </label>
                        <span className="text-[#6605c7] font-black text-[13px]">
                            {interestRate.toFixed(1)}%
                        </span>
                    </div>
                    <input
                        id="interactive-emi-rate"
                        type="range"
                        aria-label="Interest Rate"
                        aria-valuemin={7}
                        aria-valuemax={18}
                        aria-valuenow={interestRate}
                        aria-valuetext={`${interestRate.toFixed(1)}% per annum`}
                        min={7}
                        max={18}
                        step={0.1}
                        value={interestRate}
                        onChange={(e) => setInterestRate(Number(e.target.value))}
                        className="w-full h-1.5 bg-gray-100 rounded-full appearance-none cursor-pointer accent-[#6605c7] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6605c7] focus-visible:ring-offset-2"
                        style={{
                            background: `linear-gradient(to right, #6605c7 ${((interestRate - 7) / (18 - 7)) * 100}%, #f3f4f6 ${((interestRate - 7) / (18 - 7)) * 100}%)`,
                        }}
                    />
                    <div className="flex justify-between mt-1.5">
                        <span className="text-[11px] text-gray-500 font-bold">7%</span>
                        <span className="text-[11px] text-gray-500 font-bold">18%</span>
                    </div>
                </div>

                {/* Tenure Slider */}
                <div>
                    <div className="flex justify-between mb-3">
                        <label htmlFor="interactive-emi-tenure" className="text-[12px] font-black uppercase tracking-widest text-gray-700">
                            Loan Tenure
                        </label>
                        <span className="text-[#6605c7] font-black text-[13px]">
                            {tenure} {tenure === 1 ? "Year" : "Years"}
                        </span>
                    </div>
                    <input
                        id="interactive-emi-tenure"
                        type="range"
                        aria-label="Loan Tenure"
                        aria-valuemin={1}
                        aria-valuemax={20}
                        aria-valuenow={tenure}
                        aria-valuetext={`${tenure} ${tenure === 1 ? "Year" : "Years"}`}
                        min={1}
                        max={20}
                        step={1}
                        value={tenure}
                        onChange={(e) => setTenure(Number(e.target.value))}
                        className="w-full h-1.5 bg-gray-100 rounded-full appearance-none cursor-pointer accent-[#6605c7] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6605c7] focus-visible:ring-offset-2"
                        style={{
                            background: `linear-gradient(to right, #6605c7 ${((tenure - 1) / (20 - 1)) * 100}%, #f3f4f6 ${((tenure - 1) / (20 - 1)) * 100}%)`,
                        }}
                    />
                    <div className="flex justify-between mt-1.5">
                        <span className="text-[11px] text-gray-500 font-bold">1 Yr</span>
                        <span className="text-[11px] text-gray-500 font-bold">20 Yrs</span>
                    </div>
                </div>

                {/* Results */}
                <div className="pt-6 border-t border-gray-100">
                    {/* Donut-like breakdown bar */}
                    <div className="flex h-2.5 rounded-full overflow-hidden mb-6">
                        <div
                            className="bg-[#6605c7] rounded-l-full transition-all duration-500"
                            style={{ width: `${principalPercent}%` }}
                        />
                        <div
                            className="bg-[#e7e1f7] rounded-r-full transition-all duration-500"
                            style={{ width: `${100 - principalPercent}%` }}
                        />
                    </div>
                    <div className="flex justify-between mb-5">
                        <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full bg-[#6605c7]" />
                            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Principal</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full bg-[#e7e1f7]" />
                            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Interest</span>
                        </div>
                    </div>

                    {/* EMI Display */}
                    <div className="text-center mb-5">
                        <div className="text-[11px] text-gray-400 font-black uppercase tracking-widest mb-2">
                            Monthly EMI
                        </div>
                        <div className="text-4xl font-black text-gray-900 font-sans tabular-nums transition-all">
                            {formatCurrency(emi)}
                        </div>
                    </div>

                    {/* Summary Row */}
                    <div className="grid grid-cols-2 gap-4 mb-6">
                        <div className="p-3 rounded-lg bg-gray-50/80 text-center">
                            <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">Total Interest</div>
                            <div className="text-sm font-black text-gray-700 tabular-nums">{formatCurrency(totalInterest)}</div>
                        </div>
                        <div className="p-3 rounded-lg bg-gray-50/80 text-center">
                            <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">Total Payment</div>
                            <div className="text-sm font-black text-gray-700 tabular-nums">{formatCurrency(totalPayment)}</div>
                        </div>
                    </div>

                    <Link
                        href="/emi"
                        className="block w-full text-center py-3.5 rounded-xl font-bold text-white text-[13px] transition-all hover:opacity-90 hover:-translate-y-0.5"
                        style={{ background: "linear-gradient(135deg, #6605c7, #8b24e5)", boxShadow: "0 8px 32px rgba(102,5,199,0.3)" }}
                    >
                        Full Calculator →
                    </Link>
                </div>
            </div>
        </div>
    );
}
