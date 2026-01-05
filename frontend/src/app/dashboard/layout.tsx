"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { Sidebar } from "@/components/layout/sidebar";
import { LoadingOverlay } from "@/components/ui/spinner";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { isAuthenticated, isLoading, isHydrated, verifyToken } = useAuthStore();
  const [isVerifying, setIsVerifying] = useState(true);

  // Wait for hydration, then verify token
  useEffect(() => {
    if (!isHydrated) return;
    
    const verify = async () => {
      await verifyToken();
      setIsVerifying(false);
    };
    
    verify();
  }, [isHydrated, verifyToken]);

  // Redirect to login if not authenticated (after hydration and verification)
  useEffect(() => {
    if (isHydrated && !isVerifying && !isLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isHydrated, isVerifying, isLoading, isAuthenticated, router]);

  // Show loading while hydrating or verifying
  if (!isHydrated || isVerifying || isLoading) {
    return <LoadingOverlay message="Loading..." />;
  }

  // Don't render anything if not authenticated (will redirect)
  if (!isAuthenticated) {
    return <LoadingOverlay message="Redirecting..." />;
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <Sidebar />
      <main className="lg:ml-72">
        {children}
      </main>
    </div>
  );
}
