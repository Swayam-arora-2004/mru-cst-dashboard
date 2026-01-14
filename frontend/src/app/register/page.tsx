"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { GraduationCap, Mail, Lock, User, Phone, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useAuthStore } from "@/store/authStore";
import { generalApi, Department } from "@/lib/api";
import { ThemeToggle } from "@/components/ui/theme-toggle";

export default function RegisterPage() {
  const router = useRouter();
  const { register, isLoading, isAuthenticated, verifyToken } = useAuthStore();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    phone: "",
    department_id: "",
    designation: "",
  });
  const [departments, setDepartments] = useState<Department[]>([]);

  useEffect(() => {
    verifyToken().then(() => {
      if (isAuthenticated) {
        router.push("/dashboard");
      }
    });
    
    // Fetch departments
    generalApi.getDepartments().then((res) => {
      if (res.success && res.data) {
        setDepartments(res.data);
      }
    });
  }, [isAuthenticated, router, verifyToken]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.email || !formData.password) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    if (formData.password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    try {
      await register({
        name: formData.name,
        email: formData.email,
        password: formData.password,
        phone: formData.phone || undefined,
        department_id: formData.department_id || undefined,
        designation: formData.designation || undefined,
      });
      toast.success("Account created successfully!");
      router.push("/dashboard");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Registration failed");
    }
  };

  const designationOptions = [
    { value: "Professor", label: "Professor" },
    { value: "Associate Professor", label: "Associate Professor" },
    { value: "Assistant Professor", label: "Assistant Professor" },
    { value: "Lecturer", label: "Lecturer" },
    { value: "Teaching Assistant", label: "Teaching Assistant" },
    { value: "Lab Instructor", label: "Lab Instructor" },
  ];

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-secondary p-4 py-12">
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
            <CardTitle className="text-2xl">Create account</CardTitle>
            <CardDescription>
              Register as a faculty member to get started
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                type="text"
                name="name"
                label="Full Name"
                placeholder="Dr. John Doe"
                leftIcon={<User className="h-4 w-4" />}
                value={formData.name}
                onChange={handleChange}
                required
              />
              <Input
                type="email"
                name="email"
                label="Email"
                placeholder="email@manavrachna.edu.in"
                leftIcon={<Mail className="h-4 w-4" />}
                value={formData.email}
                onChange={handleChange}
                required
              />
              <div className="grid grid-cols-2 gap-4">
                <Input
                  type="password"
                  name="password"
                  label="Password"
                  placeholder="••••••••"
                  leftIcon={<Lock className="h-4 w-4" />}
                  value={formData.password}
                  onChange={handleChange}
                  required
                />
                <Input
                  type="password"
                  name="confirmPassword"
                  label="Confirm"
                  placeholder="••••••••"
                  leftIcon={<Lock className="h-4 w-4" />}
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  required
                />
              </div>
              <Input
                type="tel"
                name="phone"
                label="Phone (Optional)"
                placeholder="+91 98765 43210"
                leftIcon={<Phone className="h-4 w-4" />}
                value={formData.phone}
                onChange={handleChange}
              />
              <Select
                name="department_id"
                label="Department (Optional)"
                placeholder="Select department"
                options={departments.map((d) => ({ value: d.id, label: d.name }))}
                value={formData.department_id}
                onChange={handleChange}
              />
              <Select
                name="designation"
                label="Designation (Optional)"
                placeholder="Select designation"
                options={designationOptions}
                value={formData.designation}
                onChange={handleChange}
              />

              <Button type="submit" className="w-full" size="lg" isLoading={isLoading}>
                Create Account
              </Button>
            </form>

            <div className="mt-6 text-center text-sm text-zinc-500">
              Already have an account?{" "}
              <Link href="/login" className="text-zinc-900 dark:text-white font-medium hover:underline">
                Sign in
              </Link>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </main>
  );
}
