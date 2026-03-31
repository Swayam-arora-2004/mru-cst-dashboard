"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { GraduationCap, Mail, Lock, User, Phone, ArrowLeft, Eye, EyeOff } from "lucide-react";
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
    specialization: "",
  });
  const [departments, setDepartments] = useState<Department[]>([]);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

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
    const { name, value } = e.target;
    
    setFormData((prev) => {
      // If department is changed, clear specialization
      if (name === "department_id") {
        return {
          ...prev,
          [name]: value,
          specialization: "",
        };
      }
      return {
        ...prev,
        [name]: value,
      };
    });
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
        specialization: formData.specialization || undefined,
      });
      toast.success("Account created successfully!");
      router.push("/dashboard");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Registration failed");
    }
  };

  const designationOptions = [
    { value: "Professor", label: "Professor" },
    { value: "Head of Department", label: "Head of Department" },
    { value: "Associate Teacher", label: "Associate Teacher" },
    { value: "Assistant Teacher", label: "Assistant Teacher" },
    { value: "Lab Coordinator", label: "Lab Coordinator" },
  ];

  const specializationOptions: Record<string, { value: string; label: string }[]> = {
    "Computer Science and Engineering (Specialization)": [
      { value: "AI & Machine Learning", label: "AI & Machine Learning" },
      { value: "Data Science", label: "Data Science" },
      { value: "Cybersecurity", label: "Cybersecurity" },
      { value: "Cloud Computing", label: "Cloud Computing" },
      { value: "Blockchain Technology", label: "Blockchain Technology" },
    ],
    "Electronics and Communication Engineering (Specialization)": [
      { value: "VLSI Design", label: "VLSI Design" },
      { value: "Embedded Systems", label: "Embedded Systems" },
      { value: "IoT", label: "IoT" },
      { value: "Robotics", label: "Robotics" },
      { value: "Artificial Intelligence", label: "Artificial Intelligence" },
    ],
    "Electronic and Electrical Engineering (Specialization)": [
      { value: "Power Electronics", label: "Power Electronics" },
      { value: "Control Systems", label: "Control Systems" },
      { value: "Renewable Energy Systems", label: "Renewable Energy Systems" },
      { value: "VLSI Design", label: "VLSI Design" },
      { value: "Robotics", label: "Robotics" },
      { value: "Communication Engineering", label: "Communication Engineering" },
    ]
  };

  const selectedDepartmentObj = departments.find(d => d.id === formData.department_id);
  const activeSpecializations = selectedDepartmentObj ? specializationOptions[selectedDepartmentObj.name] : null;

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
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to home
        </Link>

        <Card className="border-border">
          <CardHeader className="text-center pb-2">
            <div className="flex items-center justify-center w-14 h-14 mx-auto mb-4 rounded-xl bg-primary">
              <GraduationCap className="h-7 w-7 text-primary-foreground" />
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
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    name="password"
                    label="Password"
                    placeholder="••••••••"
                    leftIcon={<Lock className="h-4 w-4" />}
                    value={formData.password}
                    onChange={handleChange}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-9 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                <div className="relative">
                  <Input
                    type={showConfirmPassword ? "text" : "password"}
                    name="confirmPassword"
                    label="Confirm"
                    placeholder="••••••••"
                    leftIcon={<Lock className="h-4 w-4" />}
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-9 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
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
              
              {activeSpecializations && (
                <Select
                  name="specialization"
                  label="Specialization"
                  placeholder="Select specialization"
                  options={activeSpecializations}
                  value={formData.specialization}
                  onChange={handleChange}
                />
              )}
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

            <div className="mt-6 text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link href="/login" className="text-foreground font-medium hover:underline">
                Sign in
              </Link>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </main>
  );
}
