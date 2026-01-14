"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { GraduationCap, ArrowRight, Sparkles, Users, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/authStore";
import { LoadingOverlay } from "@/components/ui/spinner";
import { ThemeToggle } from "@/components/ui/theme-toggle";

export default function Home() {
  const router = useRouter();
  const { isAuthenticated, isHydrated, verifyToken } = useAuthStore();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    if (!isHydrated) return;
    
    if (isAuthenticated) {
      router.push("/dashboard");
      return;
    }
    
    verifyToken().finally(() => {
      setIsChecking(false);
    });
  }, [isHydrated, isAuthenticated, router, verifyToken]);

  useEffect(() => {
    if (isHydrated && !isChecking && isAuthenticated) {
      router.push("/dashboard");
    }
  }, [isHydrated, isChecking, isAuthenticated, router]);

  if (!isHydrated || (isChecking && !isAuthenticated)) {
    return <LoadingOverlay message="Loading..." />;
  }

  if (isAuthenticated) {
    return <LoadingOverlay message="Redirecting to dashboard..." />;
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden bg-background">
      {/* Theme Toggle */}
      <div className="absolute top-4 right-4 z-20">
        <ThemeToggle />
      </div>

      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-violet-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="text-center px-4 relative z-10"
      >
        {/* Logo */}
        <motion.div
          initial={{ scale: 0.8 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
          className="flex items-center justify-center w-20 h-20 mx-auto mb-8 rounded-2xl bg-gradient-to-br from-primary to-primary/80 shadow-2xl"
        >
          <GraduationCap className="h-10 w-10 text-primary-foreground" />
        </motion.div>

        {/* Title */}
        <h1 className="text-4xl md:text-6xl font-bold text-foreground mb-4 tracking-tight">
          MRU Dashboard
        </h1>
        <p className="text-lg md:text-xl text-muted-foreground mb-10 max-w-lg mx-auto leading-relaxed">
          Modern University ERP System for managing students, courses, and academic operations
        </p>

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12 max-w-3xl mx-auto">
          {[
            { title: "Face Recognition", desc: "Identify students instantly", icon: Users },
            { title: "Smart Course Codes", desc: "AI-powered code generation", icon: Sparkles },
            { title: "Real-time Analytics", desc: "Track academic progress", icon: BarChart3 },
          ].map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 + i * 0.1 }}
              className="group p-5 rounded-2xl bg-card border border-border hover:border-border/80 hover:shadow-lg transition-all duration-300"
            >
              <div className="w-10 h-10 rounded-xl mb-3 flex items-center justify-center bg-secondary">
                <feature.icon className="h-5 w-5 text-secondary-foreground" />
              </div>
              <h3 className="font-semibold text-card-foreground mb-1">
                {feature.title}
              </h3>
              <p className="text-sm text-muted-foreground">
                {feature.desc}
              </p>
            </motion.div>
          ))}
        </div>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button
            size="lg"
            onClick={() => router.push("/login")}
            className="group px-8 h-12 text-base"
          >
            Sign In
            <ArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" />
          </Button>
          <Button
            size="lg"
            variant="outline"
            onClick={() => router.push("/register")}
            className="px-8 h-12 text-base"
          >
            Create Account
          </Button>
        </div>
      </motion.div>

      {/* Footer */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        className="absolute bottom-6 text-sm text-zinc-400"
      >
        © 2026 MRU Dashboard. All rights reserved.
      </motion.p>
    </main>
  );
}
