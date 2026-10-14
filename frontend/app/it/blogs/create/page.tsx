"use client";

import { useRouter } from "next/navigation";
import AdminBlogBuilder from "@/components/AdminBlogBuilder";

export default function ITCreateBlogPage() {
  const router = useRouter();

  return (
    <div className="h-[calc(100vh-3rem)] md:h-[calc(100vh-4rem)] flex flex-col overflow-hidden font-sans">
      <AdminBlogBuilder
        backHref="/it/blogs"
        onBack={() => router.push("/it/blogs")}
        onPublished={() => router.push("/it/blogs")}
      />
    </div>
  );
}
