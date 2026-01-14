"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  User,
  Bell,
  Shield,
  Palette,
  Database,
  Building,
  GraduationCap,
  Save,
  Eye,
  EyeOff,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/store/authStore";

type SettingsTab = "profile" | "security" | "preferences" | "system";

export default function SettingsPage() {
  const { user, setUser } = useAuthStore();
  const [activeTab, setActiveTab] = useState<SettingsTab>("profile");
  const [isLoading, setIsLoading] = useState(false);

  // Profile state
  const [profileData, setProfileData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    department: "",
    designation: "",
  });

  // Security state
  const [securityData, setSecurityData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  // Preferences state
  const [preferences, setPreferences] = useState({
    theme: "system",
    emailNotifications: true,
    pushNotifications: true,
    weeklyReport: true,
  });

  useEffect(() => {
    if (user) {
      // Handle both 'name' field and potential first_name/last_name fields
      const nameParts = user.name?.split(' ') || ['', ''];
      setProfileData({
        firstName: user.first_name || nameParts[0] || "",
        lastName: user.last_name || nameParts.slice(1).join(' ') || "",
        email: user.email || "",
        phone: "",
        department: user.department_id || "",
        designation: user.designation || "",
      });
    }
  }, [user]);

  const handleProfileSave = async () => {
    setIsLoading(true);
    try {
      // API call would go here
      await new Promise((resolve) => setTimeout(resolve, 1000));
      toast.success("Profile updated successfully");
    } catch (error) {
      toast.error("Failed to update profile");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordChange = async () => {
    if (securityData.newPassword !== securityData.confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    if (securityData.newPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }

    setIsLoading(true);
    try {
      // API call would go here
      await new Promise((resolve) => setTimeout(resolve, 1000));
      toast.success("Password changed successfully");
      setSecurityData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    } catch (error) {
      toast.error("Failed to change password");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePreferencesSave = async () => {
    setIsLoading(true);
    try {
      // API call would go here
      await new Promise((resolve) => setTimeout(resolve, 1000));
      toast.success("Preferences saved");
    } catch (error) {
      toast.error("Failed to save preferences");
    } finally {
      setIsLoading(false);
    }
  };

  const tabs = [
    { id: "profile" as const, label: "Profile", icon: User },
    { id: "security" as const, label: "Security", icon: Shield },
    { id: "preferences" as const, label: "Preferences", icon: Palette },
    { id: "system" as const, label: "System Info", icon: Database },
  ];

  return (
    <div className="min-h-screen">
      <Header
        title="Settings"
        description="Manage your account and application preferences"
      />

      <div className="p-6 lg:p-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar Navigation */}
          <div className="lg:w-64 shrink-0">
            <Card>
              <CardContent className="p-2">
                <nav className="space-y-1">
                  {tabs.map((tab) => {
                    const Icon = tab.icon;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                          activeTab === tab.id
                            ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                            : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                        }`}
                      >
                        <Icon className="h-5 w-5" />
                        {tab.label}
                      </button>
                    );
                  })}
                </nav>
              </CardContent>
            </Card>
          </div>

          {/* Main Content */}
          <div className="flex-1 max-w-3xl">
            {activeTab === "profile" && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                <Card>
                  <CardHeader>
                    <CardTitle>Profile Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Avatar */}
                    <div className="flex items-center gap-6">
                      <Avatar
                        alt={`${profileData.firstName} ${profileData.lastName}`}
                        fallback={`${profileData.firstName[0] || "U"}${profileData.lastName[0] || ""}`}
                        size="xl"
                        className="w-20 h-20"
                      />
                      <div>
                        <Button variant="outline" size="sm">
                          Change Avatar
                        </Button>
                        <p className="text-xs text-zinc-500 mt-2">
                          JPG, GIF or PNG. Max size 2MB.
                        </p>
                      </div>
                    </div>

                    {/* Form */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Input
                        label="First Name"
                        value={profileData.firstName}
                        onChange={(e) =>
                          setProfileData((prev) => ({
                            ...prev,
                            firstName: e.target.value,
                          }))
                        }
                      />
                      <Input
                        label="Last Name"
                        value={profileData.lastName}
                        onChange={(e) =>
                          setProfileData((prev) => ({
                            ...prev,
                            lastName: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <Input
                      label="Email"
                      type="email"
                      value={profileData.email}
                      onChange={(e) =>
                        setProfileData((prev) => ({
                          ...prev,
                          email: e.target.value,
                        }))
                      }
                      disabled
                      hint="Email cannot be changed"
                    />
                    <Input
                      label="Phone Number"
                      type="tel"
                      placeholder="+91 98765 43210"
                      value={profileData.phone}
                      onChange={(e) =>
                        setProfileData((prev) => ({
                          ...prev,
                          phone: e.target.value,
                        }))
                      }
                    />
                    <Select
                      label="Designation"
                      options={[
                        { value: "professor", label: "Professor" },
                        { value: "associate_professor", label: "Associate Professor" },
                        { value: "assistant_professor", label: "Assistant Professor" },
                        { value: "lecturer", label: "Lecturer" },
                        { value: "hod", label: "Head of Department" },
                      ]}
                      value={profileData.designation}
                      onChange={(e) =>
                        setProfileData((prev) => ({
                          ...prev,
                          designation: e.target.value,
                        }))
                      }
                    />

                    <div className="flex justify-end">
                      <Button onClick={handleProfileSave} isLoading={isLoading}>
                        <Save className="h-4 w-4" />
                        Save Changes
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {activeTab === "security" && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                <Card>
                  <CardHeader>
                    <CardTitle>Change Password</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="relative">
                      <Input
                        label="Current Password"
                        type={showCurrentPassword ? "text" : "password"}
                        value={securityData.currentPassword}
                        onChange={(e) =>
                          setSecurityData((prev) => ({
                            ...prev,
                            currentPassword: e.target.value,
                          }))
                        }
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                        className="absolute right-3 top-9 text-zinc-400 hover:text-zinc-600"
                      >
                        {showCurrentPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                    <div className="relative">
                      <Input
                        label="New Password"
                        type={showNewPassword ? "text" : "password"}
                        value={securityData.newPassword}
                        onChange={(e) =>
                          setSecurityData((prev) => ({
                            ...prev,
                            newPassword: e.target.value,
                          }))
                        }
                        hint="Minimum 8 characters"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3 top-9 text-zinc-400 hover:text-zinc-600"
                      >
                        {showNewPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                    <Input
                      label="Confirm New Password"
                      type="password"
                      value={securityData.confirmPassword}
                      onChange={(e) =>
                        setSecurityData((prev) => ({
                          ...prev,
                          confirmPassword: e.target.value,
                        }))
                      }
                    />

                    <div className="flex justify-end pt-4">
                      <Button
                        onClick={handlePasswordChange}
                        isLoading={isLoading}
                        disabled={
                          !securityData.currentPassword ||
                          !securityData.newPassword ||
                          !securityData.confirmPassword
                        }
                      >
                        <Shield className="h-4 w-4" />
                        Update Password
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Sessions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-4 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
                        <div className="flex items-center gap-3">
                          <div className="h-2 w-2 bg-emerald-500 rounded-full" />
                          <div>
                            <p className="font-medium text-zinc-900 dark:text-white">
                              Current Session
                            </p>
                            <p className="text-sm text-zinc-500">
                              macOS • Chrome • Last active now
                            </p>
                          </div>
                        </div>
                        <Badge variant="success">Active</Badge>
                      </div>
                    </div>
                    <Button variant="outline" className="w-full mt-4">
                      Sign out all other sessions
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {activeTab === "preferences" && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                <Card>
                  <CardHeader>
                    <CardTitle>Appearance</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-4">
                      {["light", "dark", "system"].map((theme) => (
                        <button
                          key={theme}
                          onClick={() =>
                            setPreferences((prev) => ({ ...prev, theme }))
                          }
                          className={`p-4 rounded-xl border-2 transition-colors ${
                            preferences.theme === theme
                              ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                              : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700"
                          }`}
                        >
                          <div
                            className={`h-20 rounded-lg mb-3 ${
                              theme === "light"
                                ? "bg-white border border-zinc-200"
                                : theme === "dark"
                                  ? "bg-zinc-900"
                                  : "bg-linear-to-r from-white to-zinc-900"
                            }`}
                          />
                          <p className="font-medium capitalize">{theme}</p>
                        </button>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Notifications</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <label className="flex items-center justify-between p-4 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 cursor-pointer">
                      <div>
                        <p className="font-medium text-zinc-900 dark:text-white">
                          Email Notifications
                        </p>
                        <p className="text-sm text-zinc-500">
                          Receive email updates about your account
                        </p>
                      </div>
                      <div
                        className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                          preferences.emailNotifications
                            ? "bg-blue-500"
                            : "bg-zinc-300 dark:bg-zinc-700"
                        }`}
                        onClick={() =>
                          setPreferences((prev) => ({
                            ...prev,
                            emailNotifications: !prev.emailNotifications,
                          }))
                        }
                      >
                        <div
                          className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                            preferences.emailNotifications
                              ? "translate-x-7"
                              : "translate-x-1"
                          }`}
                        />
                      </div>
                    </label>

                    <label className="flex items-center justify-between p-4 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 cursor-pointer">
                      <div>
                        <p className="font-medium text-zinc-900 dark:text-white">
                          Push Notifications
                        </p>
                        <p className="text-sm text-zinc-500">
                          Receive push notifications in browser
                        </p>
                      </div>
                      <div
                        className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                          preferences.pushNotifications
                            ? "bg-blue-500"
                            : "bg-zinc-300 dark:bg-zinc-700"
                        }`}
                        onClick={() =>
                          setPreferences((prev) => ({
                            ...prev,
                            pushNotifications: !prev.pushNotifications,
                          }))
                        }
                      >
                        <div
                          className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                            preferences.pushNotifications
                              ? "translate-x-7"
                              : "translate-x-1"
                          }`}
                        />
                      </div>
                    </label>

                    <label className="flex items-center justify-between p-4 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 cursor-pointer">
                      <div>
                        <p className="font-medium text-zinc-900 dark:text-white">
                          Weekly Report
                        </p>
                        <p className="text-sm text-zinc-500">
                          Get a weekly summary of activity
                        </p>
                      </div>
                      <div
                        className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                          preferences.weeklyReport
                            ? "bg-blue-500"
                            : "bg-zinc-300 dark:bg-zinc-700"
                        }`}
                        onClick={() =>
                          setPreferences((prev) => ({
                            ...prev,
                            weeklyReport: !prev.weeklyReport,
                          }))
                        }
                      >
                        <div
                          className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                            preferences.weeklyReport
                              ? "translate-x-7"
                              : "translate-x-1"
                          }`}
                        />
                      </div>
                    </label>

                    <div className="flex justify-end pt-4">
                      <Button
                        onClick={handlePreferencesSave}
                        isLoading={isLoading}
                      >
                        <Save className="h-4 w-4" />
                        Save Preferences
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {activeTab === "system" && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                <Card>
                  <CardHeader>
                    <CardTitle>Application Info</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 rounded-lg bg-zinc-50 dark:bg-zinc-800">
                        <p className="text-xs text-zinc-500 uppercase tracking-wide">
                          Version
                        </p>
                        <p className="font-medium text-zinc-900 dark:text-white mt-1">
                          1.0.0
                        </p>
                      </div>
                      <div className="p-4 rounded-lg bg-zinc-50 dark:bg-zinc-800">
                        <p className="text-xs text-zinc-500 uppercase tracking-wide">
                          Environment
                        </p>
                        <p className="font-medium text-zinc-900 dark:text-white mt-1">
                          Production
                        </p>
                      </div>
                      <div className="p-4 rounded-lg bg-zinc-50 dark:bg-zinc-800">
                        <p className="text-xs text-zinc-500 uppercase tracking-wide">
                          Frontend
                        </p>
                        <p className="font-medium text-zinc-900 dark:text-white mt-1">
                          Next.js 16
                        </p>
                      </div>
                      <div className="p-4 rounded-lg bg-zinc-50 dark:bg-zinc-800">
                        <p className="text-xs text-zinc-500 uppercase tracking-wide">
                          Database
                        </p>
                        <p className="font-medium text-zinc-900 dark:text-white mt-1">
                          Supabase (PostgreSQL)
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Building className="h-5 w-5" />
                      Connected Services
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between p-4 rounded-lg border border-zinc-200 dark:border-zinc-800">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/20">
                          <Database className="h-5 w-5 text-emerald-600" />
                        </div>
                        <div>
                          <p className="font-medium text-zinc-900 dark:text-white">
                            Supabase
                          </p>
                          <p className="text-sm text-zinc-500">
                            Database & Authentication
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-emerald-500" />
                        <span className="text-sm text-emerald-600">Connected</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-4 rounded-lg border border-zinc-200 dark:border-zinc-800">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/20">
                          <GraduationCap className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-medium text-zinc-900 dark:text-white">
                            Google Gemini
                          </p>
                          <p className="text-sm text-zinc-500">
                            AI Course Code Generation
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-emerald-500" />
                        <span className="text-sm text-emerald-600">Connected</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Quick Stats</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="text-center p-4 rounded-lg bg-zinc-50 dark:bg-zinc-800">
                        <p className="text-2xl font-bold text-zinc-900 dark:text-white">
                          245
                        </p>
                        <p className="text-sm text-zinc-500">Total Students</p>
                      </div>
                      <div className="text-center p-4 rounded-lg bg-zinc-50 dark:bg-zinc-800">
                        <p className="text-2xl font-bold text-zinc-900 dark:text-white">
                          48
                        </p>
                        <p className="text-sm text-zinc-500">Courses</p>
                      </div>
                      <div className="text-center p-4 rounded-lg bg-zinc-50 dark:bg-zinc-800">
                        <p className="text-2xl font-bold text-zinc-900 dark:text-white">
                          6
                        </p>
                        <p className="text-sm text-zinc-500">Departments</p>
                      </div>
                      <div className="text-center p-4 rounded-lg bg-zinc-50 dark:bg-zinc-800">
                        <p className="text-2xl font-bold text-zinc-900 dark:text-white">
                          12
                        </p>
                        <p className="text-sm text-zinc-500">Classes</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
