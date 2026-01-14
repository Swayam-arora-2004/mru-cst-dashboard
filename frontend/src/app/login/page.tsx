"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { GraduationCap, Mail, Lock, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useAuthStore } from "@/store/authStore";
import { LoadingOverlay } from "@/components/ui/spinner";
import { ThemeToggle } from "@/components/ui/theme-toggle";

export default function LoginPage() {
  const router = useRouter();
  const { login, isLoading, isAuthenticated, isHydrated, verifyToken } = useAuthStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    if (!isHydrated) return;
    
    // If already authenticated from persisted state, redirect
    if (isAuthenticated) {
      router.push("/dashboard");
      return;
    }
    
    // Verify token to check if session is still valid
    verifyToken().finally(() => {
      setIsChecking(false);
    });
  }, [isHydrated, isAuthenticated, router, verifyToken]);

  // Redirect after successful verification
  useEffect(() => {
    if (isHydrated && !isChecking && isAuthenticated) {
      router.push("/dashboard");
    }
  }, [isHydrated, isChecking, isAuthenticated, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      toast.error("Please fill in all fields");
      return;
    }

    try {
      await login(email, password);
      toast.success("Login successful!");
      router.push("/dashboard");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Login failed");
    }
  };

  // Show loading while checking auth state
  if (!isHydrated || isChecking) {
    return <LoadingOverlay message="Loading..." />;
  }

  // If authenticated, show loading while redirecting
  if (isAuthenticated) {
    return <LoadingOverlay message="Redirecting..." />;
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-secondary p-4">
      {/* Theme Toggle */}
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md"
      >
        {/* Back button */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-white mb-6 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to home
        </Link>

        <Card className="border-zinc-200 dark:border-zinc-800">
          <CardHeader className="text-center pb-2">
            <div className="flex items-center justify-center w-14 h-14 mx-auto mb-4 rounded-xl bg-zinc-900 dark:bg-white">
              <GraduationCap className="h-7 w-7 text-white dark:text-zinc-900" />
            </div>
            <CardTitle className="text-2xl">Welcome back</CardTitle>
            <CardDescription>
              Sign in to your account to continue
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                type="email"
                label="Email"
                placeholder="email@manavrachna.edu.in"
                leftIcon={<Mail className="h-4 w-4" />}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <Input
                type="password"
                label="Password"
                placeholder="••••••••"
                leftIcon={<Lock className="h-4 w-4" />}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />

              <div className="flex items-center justify-between text-sm">
                <label className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
                  <input
                    type="checkbox"
                    className="rounded border-zinc-300 dark:border-zinc-600"
                  />
                  Remember me
                </label>
                <a href="#" className="text-zinc-900 dark:text-white hover:underline">
                  Forgot password?
                </a>
              </div>

              <Button type="submit" className="w-full" size="lg" isLoading={isLoading}>
                Sign In
              </Button>
            </form>

            <div className="mt-6 text-center text-sm text-zinc-500">
              Don&apos;t have an account?{" "}
              <Link href="/register" className="text-zinc-900 dark:text-white font-medium hover:underline">
                Create one
              </Link>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </main>
  );
}
