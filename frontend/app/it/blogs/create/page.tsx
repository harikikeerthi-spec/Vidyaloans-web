"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import DynamicBlogEditor from "@/components/DynamicBlogEditor";

export default function ITCreateBlogPage() {
  const router = useRouter();
  const { user } = useAuth();

  return (
    <div className="h-[calc(100vh-3rem)] md:h-[calc(100vh-4rem)] flex flex-col overflow-hidden font-sans">
      <DynamicBlogEditor
        currentUser={user}
        onBack={() => router.push("/it/blogs")}
        onSaved={() => router.push("/it/blogs")}
      />
    </div>
  );
}
