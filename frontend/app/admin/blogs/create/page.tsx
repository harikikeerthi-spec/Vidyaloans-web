"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function CreateBlogPage() {
    const router = useRouter();

    useEffect(() => {
        router.replace("/it/blogs?action=create");
    }, [router]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 text-xs text-slate-500 font-bold">
            Redirecting to IT Dashboard Blog Builder...
        </div>
    );
}

