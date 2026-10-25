"use client";

import { useState, useMemo, useEffect } from "react";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import { Doughnut } from "react-chartjs-2";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter, usePathname } from "next/navigation";

ChartJS.register(ArcElement, Tooltip, Legend);

export default function EmiCalculatorPage() {
    const { isAuthenticated } = useAuth();
    const router = useRouter();
    const pathname = usePathname();
    const [principal, setPrincipal] = useState(2500000);
    const [rate, setRate] = useState(10.5);
    const [tenure, setTenure] = useState(10); // in years

    useEffect(() => {
        if (typeof window !== "undefined") {
            const saved = localStorage.getItem("pending_emi_data");
            if (saved) {
                try {
                    const parsed = JSON.parse(saved);
                    if (parsed.principal) setPrincipal(parsed.principal);
                    if (parsed.rate) setRate(parsed.rate);
                    if (parsed.tenure) setTenure(parsed.tenure);
                } catch (e) {
                    console.error("Failed to restore saved EMI data", e);
                }
                localStorage.removeItem("pending_emi_data");
            }
        }
    }, []);

    const { emi, totalInterest, totalPayable, amortization } = useMemo(() => {
        const monthlyRate = rate / 12 / 100;
        const months = tenure * 12;
        const emiValue = principal * monthlyRate * Math.pow(1 + monthlyRate, months) / (Math.pow(1 + monthlyRate, months) - 1);
        const totalPayableValue = emiValue * months;
        const totalInterestValue = totalPayableValue - principal;

        const schedule = [];
        let balance = principal;
        const targetMonths = Math.min(12, months);
        for (let i = 1; i <= targetMonths; i++) {
            const interest = balance * monthlyRate;
            const subPrincipal = emiValue - interest;
            balance = balance - subPrincipal;
            schedule.push({
                month: i,
                principal: subPrincipal,
                interest: interest,
                balance: Math.max(0, balance)
            });
        }

        return {
            emi: emiValue,
            totalInterest: totalInterestValue,
            totalPayable: totalPayableValue,
            amortization: schedule
        };
    }, [principal, rate, tenure]);

    const fmt = (n: number) =>
        new Intl.NumberFormat("en-IN", {
            style: "currency",
            currency: "INR",
            maximumFractionDigits: 0,
        }).format(n);

    const chartData = {
        labels: ["Principal Amount", "Total Interest"],
        datasets: [
            {
                data: [principal, totalInterest],
                backgroundColor: ["#6605c7", "#e0c389"],
                hoverBackgroundColor: ["#7a0de8", "#f0d4a0"],
                borderWidth: 0,
            },
        ],
    };

    const chartOptions = {
        plugins: {
            legend: {
                display: false,
            },
        },
        cutout: "75%",
        responsive: true,
        maintainAspectRatio: false,
    };

    const downloadSchedule = () => {
        if (!isAuthenticated) {
            localStorage.setItem("pending_emi_data", JSON.stringify({ principal, rate, tenure }));
            alert("Please login to download your amortization schedule. You will be redirected to the login page.");
            router.push(`/login?redirect=${encodeURIComponent(pathname)}`);
            return;
        }
        const headers = ["Month", "Principal Payment (INR)", "Interest Payment (INR)", "Remaining Balance (INR)"];
        const rows = amortization.map((row) => [
            row.month,
            Math.round(row.principal),
            Math.round(row.interest),
            Math.round(row.balance)
        ]);
        const csvContent = [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `EMI_Amortization_Schedule_${principal}_INR.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    return (
        <div className="min-h-screen bg-transparent">
            <div className="pt-28 pb-20 px-6 relative z-10">
                <div className="max-w-6xl mx-auto">
                    {/* Header Section */}
                    <div className="mb-12">
                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#6605c7]/[0.05] rounded-xl text-[10px] font-bold text-[#6605c7] uppercase tracking-widest mb-4 border border-[#6605c7]/[0.1]">
                            <span className="material-symbols-outlined text-[14px]">calculate</span>
                            Financial Tools
                        </div>
                        <h1 className="text-3xl font-bold text-gray-900 mb-4">
                            EMI Calculator
                        </h1>
                        <p className="text-[13px] text-gray-500 max-w-xl leading-relaxed">
                            Plan your education journey with transparency. Estimate your monthly repayments accurately to manage your finances better.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                        {/* Left Column: Controls & Table */}
                        <div className="lg:col-span-7 space-y-6">
                            <div className="bg-white rounded-xl p-8 shadow-xl border border-gray-100 space-y-8">
                                <SliderControl
                                    label="Loan Amount"
                                    value={fmt(principal)}
                                    numValue={principal}
                                    min={100000}
                                    max={10000000}
                                    step={50000}
                                    onChange={setPrincipal}
                                />

                                <SliderControl
                                    label="Interest Rate (p.a.)"
                                    value={`${rate}%`}
                                    numValue={rate}
                                    min={7}
                                    max={15}
                                    step={0.1}
                                    onChange={setRate}
                                />

                                <SliderControl
                                    label="Tenure (Years)"
                                    value={`${tenure} Years`}
                                    numValue={tenure}
                                    min={1}
                                    max={15}
                                    step={1}
                                    onChange={setTenure}
                                />
                            </div>

                            <div className="bg-white rounded-xl p-8 shadow-sm border border-gray-100 overflow-hidden">
                                <h3 className="font-bold text-gray-900 text-[13px] mb-6 flex items-center gap-2 uppercase tracking-wider">
                                    <span className="material-symbols-outlined text-[#6605c7] text-[18px]">calendar_month</span>
                                    Amortization Schedule
                                </h3>
                                <div className="overflow-x-auto relative">
                                    <table className={`w-full text-left ${!isAuthenticated ? 'blur-sm select-none pointer-events-none' : ''}`}>
                                        <thead>
                                            <tr className="text-[11px] font-bold uppercase tracking-widest text-gray-400 border-b border-gray-50">
                                                <th className="pb-3 pr-4">Month</th>
                                                <th className="pb-3 pr-4">Principal</th>
                                                <th className="pb-3 pr-4">Interest</th>
                                                <th className="pb-3">Balance</th>
                                            </tr>
                                        </thead>
                                        <tbody className="text-[13px] divide-y divide-gray-50 text-gray-600">
                                            {amortization.map((row) => (
                                                <tr key={row.month} className="hover:bg-gray-50/50 transition-colors">
                                                    <td className="py-3 font-bold text-gray-900">{row.month}</td>
                                                    <td className="py-3">{fmt(row.principal)}</td>
                                                    <td className="py-3">{fmt(row.interest)}</td>
                                                    <td className="py-3 font-medium">{fmt(row.balance)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>

                                    {!isAuthenticated && (
                                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/60 backdrop-blur-[2px] p-6 text-center">
                                            <div className="w-12 h-12 rounded-full bg-purple-50 flex items-center justify-center mb-3">
                                                <span className="material-symbols-outlined text-[#6605c7] text-xl">lock</span>
                                            </div>
                                            <p className="text-gray-900 font-bold text-sm mb-3">Login to unlock full 12-month amortization schedule</p>
                                            <button 
                                                onClick={() => {
                                                    localStorage.setItem("pending_emi_data", JSON.stringify({ principal, rate, tenure }));
                                                    router.push(`/login?redirect=${encodeURIComponent(pathname)}`);
                                                }}
                                                className="px-6 py-2 bg-[#6605c7] hover:bg-[#5504a6] text-white text-[11px] uppercase tracking-widest font-bold rounded-xl transition-all shadow-md cursor-pointer"
                                            >
                                                Unlock Schedule
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Right Column: Result Card */}
                        <div className="lg:col-span-5 bg-white rounded-xl p-10 shadow-sm border border-gray-100 text-center sticky top-24">
                            <span className="text-gray-400 text-[11px] uppercase font-bold tracking-[0.2em] mb-3 block">
                                Your Monthly Payment
                            </span>
                            <div className="text-5xl font-bold text-gray-900 mb-10 font-sans tracking-tight">
                                {fmt(Math.round(emi))}
                            </div>

                            {/* Donut Chart */}
                            <div className="relative w-48 h-48 mx-auto mb-10">
                                <div className="absolute inset-0">
                                    <Doughnut data={chartData} options={chartOptions} />
                                </div>
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="text-center">
                                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Total Repayable</div>
                                        <div className="text-[13px] font-bold text-gray-900 mt-0.5">{fmt(totalPayable)}</div>
                                    </div>
                                </div>
                            </div>

                            {/* Breakdown Summary */}
                            <div className="grid grid-cols-2 gap-3 mb-10">
                                <div className="p-4 bg-[#6605c7]/[0.02] rounded-xl border border-[#6605c7]/[0.1] text-left">
                                    <p className="text-[10px] font-bold uppercase text-gray-400 mb-1 tracking-widest">Total Principal</p>
                                    <p className="text-[13px] font-bold text-gray-900">{fmt(principal)}</p>
                                </div>
                                <div className="p-4 bg-amber-50 rounded-xl border border-amber-100 text-left">
                                    <p className="text-[10px] font-bold uppercase text-amber-500 mb-1 tracking-widest">Total Interest</p>
                                    <p className="text-[13px] font-bold text-gray-900">{fmt(totalInterest)}</p>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <button
                                    onClick={downloadSchedule}
                                    className="w-full py-3.5 bg-[#6605c7] text-white rounded-xl font-bold uppercase tracking-widest text-[11px] hover:bg-[#5504a6] shadow-lg shadow-purple-500/20 transition-all"
                                >
                                    Download Schedule
                                </button>
                                <button className="w-full py-3.5 bg-white border border-gray-100 text-gray-900 rounded-xl font-bold uppercase tracking-widest text-[11px] hover:bg-gray-50 transition-all">
                                    <a href="/loan-eligibility">Check Eligibility</a>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function SliderControl({ label, value, numValue, min, max, step, onChange }: {
    label: string; value: string; numValue: number; min: number; max: number; step: number;
    onChange: (v: number) => void;
}) {
    return (
        <div>
            <div className="flex justify-between items-end mb-4">
                <label className="text-gray-400 text-[11px] uppercase font-bold tracking-widest">{label}</label>
                <span className="text-gray-900 text-2xl font-bold">{value}</span>
            </div>
            <div className="relative pt-2">
                <input
                    type="range"
                    min={min}
                    max={max}
                    step={step}
                    value={numValue}
                    onChange={(e) => onChange(Number(e.target.value))}
                    className="w-full h-1.5 rounded-full appearance-none cursor-pointer accent-[#6605c7]"
                    style={{
                        background: `linear-gradient(to right, #6605c7 0%, #6605c7 ${((numValue - min) / (max - min)) * 100}%, #f3f4f6 ${((numValue - min) / (max - min)) * 100}%, #f3f4f6 100%)`
                    }}
                />
                <div className="flex justify-between mt-3 px-1">
                    <span className="text-[10px] font-bold text-gray-300 uppercase tracking-widest">
                        {min >= 100000 ? `₹${min / 100000}L` : min === 7 ? "7%" : `${min}Y`}
                    </span>
                    <span className="text-[10px] font-bold text-gray-300 uppercase tracking-widest">
                        {max >= 10000000 ? "₹1CR" : max === 15 ? "15%" : `${max}Y`}
                    </span>
                </div>
            </div>
        </div>
    );
}

