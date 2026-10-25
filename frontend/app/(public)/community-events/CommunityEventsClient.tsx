"use client";

import { useState } from "react";

const EVENTS = [
    {
        id: "1",
        date: "05",
        month: "Feb",
        type: "Live Webinar",
        title: "How to Get IDFC First Bank Education Loan Approved in 48 Hours",
        desc: "Join Rajesh Kumar, former loan officer, as he shares insider tips on fast-tracking your education loan application with proper digital documentation.",
        speakers: "Rajesh Kumar (Partner Expert)",
        attendees: "420 Registered",
        time: "6:00 PM - 7:30 PM IST",
        color: "from-primary to-purple-600"
    },
    {
        id: "2",
        date: "08",
        month: "Feb",
        type: "Q&A Session",
        title: "Student Visa + Education Loan: Complete Guide",
        desc: "Immigration experts discuss how to coordinate loan disbursement with visa timelines for UK, USA, Canada, and Australia.",
        speakers: "Sarah Jenkins & Local Experts",
        attendees: "285 Registered",
        time: "5:30 PM - 7:00 PM IST",
        color: "from-blue-500 to-indigo-600"
    },
    {
        id: "3",
        date: "12",
        month: "Feb",
        type: "Networking",
        title: "Virtual Coffee Chat: Connect with Alumni",
        desc: "Casual networking session with students who've successfully repaid their loans. Ask questions, get advice, make connections.",
        speakers: "Community Alumni",
        attendees: "150 Registered",
        time: "11:00 AM - 12:00 PM IST",
        color: "from-orange-500 to-red-600"
    },
    {
        id: "4",
        date: "15",
        month: "Feb",
        type: "Live Webinar",
        title: "Collateral vs Non-Collateral Loans: What's Best?",
        desc: "Financial advisors break down the pros and cons of secured vs unsecured education loans, helping you make the right choice.",
        speakers: "Michael Chen & Priya Sharma",
        attendees: "520 Registered",
        time: "7:00 PM - 8:30 PM IST",
        color: "from-green-500 to-emerald-600"
    }
];

export default function CommunityEventsPage() {
    return (
        <main className="relative z-10 pt-32 pb-24">
            <div className="max-w-7xl mx-auto px-6">
                <header className="text-center mb-20">
                    <span className="inline-block px-4 py-2 rounded-full bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-[0.2em] mb-4">The Forum</span>
                    <h1 className="text-5xl md:text-7xl font-display font-medium text-gray-900 mb-8 leading-tight">
                        Learn, Network, <br /><span className="italic text-gray-400">Succeed Together</span>
                    </h1>
                    <p className="text-gray-500 text-lg max-w-2xl mx-auto leading-relaxed">
                        Join our expert-led webinars, Q&A sessions, and community meetups. Direct knowledge from those who've navigated the journey.
                    </p>
                </header>

                <div className="space-y-12">
                    <div className="flex items-center justify-between mb-12">
                        <h2 className="text-3xl font-display font-bold text-gray-900">Upcoming Events</h2>
                        <button className="px-8 py-3 bg-white border border-gray-100 rounded-full text-[10px] font-bold uppercase tracking-widest text-gray-500 hover:bg-gray-50 transition-all shadow-sm">View Calendar</button>
                    </div>

                    <div className="flex flex-col gap-8">
                        {EVENTS.map((event) => (
                            <div key={event.id} className="group bg-white/80 backdrop-blur-xl border border-gray-100 rounded-[3rem] p-8 md:p-12 transition-all duration-300 hover:shadow-2xl hover:border-primary/20 relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-2 h-full bg-gradient-to-b from-primary to-purple-600 opacity-20 group-hover:opacity-100 transition-opacity" />

                                <div className="flex flex-col md:flex-row gap-8 items-start">
                                    <div className={`flex-shrink-0 w-28 h-28 rounded-[2rem] bg-gradient-to-br ${event.color} flex flex-col items-center justify-center text-white shadow-xl`}>
                                        <span className="text-4xl font-bold">{event.date}</span>
                                        <span className="text-xs font-bold uppercase tracking-widest">{event.month}</span>
                                    </div>

                                    <div className="flex-1">
                                        <div className="flex gap-2 mb-4">
                                            <span className="px-3 py-1 bg-primary/5 text-primary text-[10px] font-bold uppercase tracking-widest rounded-full">{event.type}</span>
                                            <span className="px-3 py-1 bg-green-500/5 text-green-600 text-[10px] font-bold uppercase tracking-widest rounded-full">Free</span>
                                        </div>

                                        <h3 className="text-2xl md:text-3xl font-display font-bold text-gray-900 mb-4 group-hover:text-[#6605c7] transition-colors">{event.title}</h3>
                                        <p className="text-gray-500 leading-relaxed mb-8 max-w-3xl">{event.desc}</p>

                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
                                            <div className="flex items-center gap-3">
                                                <span className="material-symbols-outlined text-gray-300">schedule</span>
                                                <span className="text-xs font-bold text-gray-500">{event.time}</span>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <span className="material-symbols-outlined text-gray-300">person</span>
                                                <span className="text-xs font-bold text-gray-500">{event.speakers}</span>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <span className="material-symbols-outlined text-gray-300">groups</span>
                                                <span className="text-xs font-bold text-gray-500">{event.attendees}</span>
                                            </div>
                                        </div>

                                        <button className="px-10 py-4 bg-[#6605c7] text-white rounded-full font-bold uppercase tracking-widest text-[10px] hover:scale-[1.05] transition-all shadow-xl shadow-primary/20">Register Now</button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="mt-32">
                    <h2 className="text-3xl font-display font-bold text-gray-900 mb-12">Event Archives</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {[
                            { title: "HDFC Credila vs Avanse: Partner Comparison", views: "1.2k views", bg: "bg-primary/5" },
                            { title: "Tax Benefits on Education Loans", views: "890 views", bg: "bg-blue-500/5" },
                            { title: "EMI Planning After Graduation", views: "1.5k views", bg: "bg-green-500/5" }
                        ].map((item, i) => (
                            <div key={i} className="group glass-card p-6 rounded-[2.5rem] hover:-translate-y-2 transition-all cursor-pointer">
                                <div className={`aspect-video ${item.bg} rounded-3xl mb-6 flex items-center justify-center overflow-hidden relative`}>
                                    <span className="material-symbols-outlined text-6xl text-gray-200 group-hover:text-primary group-hover:scale-110 transition-all">play_circle</span>
                                </div>
                                <h4 className="font-bold text-gray-900 mb-2 truncate px-2">{item.title}</h4>
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-2">{item.views}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </main>
    );
}
