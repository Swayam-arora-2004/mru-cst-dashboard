"use client";

import { useState, useEffect, useRef } from "react";
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
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthStore } from "@/store/authStore";
import { generalApi, authApi, notificationsApi, type SystemInfo, type UserPreferences } from "@/lib/api";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "BF7X_R5G...";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

type SettingsTab = "profile" | "security" | "preferences" | "system";

export default function SettingsPage() {
  const { user, setUser } = useAuthStore();
  const [activeTab, setActiveTab] = useState<SettingsTab>("profile");
  const [isLoading, setIsLoading] = useState(false);
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [isLoadingSystemInfo, setIsLoadingSystemInfo] = useState(false);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isLoadingPreferences, setIsLoadingPreferences] = useState(false);
  const [isTestingNotifications, setIsTestingNotifications] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [departments, setDepartments] = useState<Array<{ id: string; code: string; name: string }>>([]);

  // Profile state
  const [profileData, setProfileData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    department: "",
    designation: "",
    specialization: "",
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
  const [preferences, setPreferences] = useState<{
    theme: 'light' | 'dark' | 'system';
    emailNotifications: boolean;
    pushNotifications: boolean;
    weeklyReport: boolean;
  }>({
    theme: "system",
    emailNotifications: true,
    pushNotifications: true,
    weeklyReport: true,
  });

  // Fetch profile data on mount
  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;
      setIsLoadingProfile(true);
      try {
        const response = await authApi.getProfile();
        if (response.success && response.data) {
          const userData = response.data.user;
          // Split the name into first and last name
          const nameParts = (userData.name || '').trim().split(' ');
          const firstName = nameParts[0] || '';
          const lastName = nameParts.slice(1).join(' ') || '';
          
          setProfileData({
            firstName: firstName,
            lastName: lastName,
            email: userData.email || "",
            phone: userData.phone || "",
            department: userData.department_id || "",
            designation: userData.designation || "",
            specialization: userData.specialization || "",
          });
        }
      } catch (error) {
        console.error("Failed to fetch profile:", error);
        toast.error("Failed to load profile data");
      } finally {
        setIsLoadingProfile(false);
      }
    };
    fetchProfile();
  }, [user]);

  // Fetch departments on mount
  useEffect(() => {
    const fetchDepartments = async () => {
      try {
        const response = await generalApi.getDepartments();
        if (response.success && response.data) {
          setDepartments(response.data);
        }
      } catch (error) {
        console.error("Failed to fetch departments:", error);
      }
    };
    fetchDepartments();
  }, []);

  // Fetch preferences on mount or when preferences tab is active
  useEffect(() => {
    const fetchPreferences = async () => {
      if (!user) return;
      setIsLoadingPreferences(true);
      try {
        const response = await authApi.getPreferences();
        if (response.success && response.data) {
          const prefs = response.data.preferences;
          setPreferences({
            theme: prefs.theme || "system",
            emailNotifications: prefs.emailNotifications ?? true,
            pushNotifications: prefs.pushNotifications ?? true,
            weeklyReport: prefs.weeklyReport ?? true,
          });
        }
      } catch (error) {
        console.error("Failed to fetch preferences:", error);
      } finally {
        setIsLoadingPreferences(false);
      }
    };
    if (activeTab === "preferences") {
      fetchPreferences();
    }
  }, [activeTab, user]);

  // Fetch system info when system tab is active
  useEffect(() => {
    if (activeTab === "system" && !systemInfo) {
      fetchSystemInfo();
    }
  }, [activeTab]);

  const fetchSystemInfo = async () => {
    setIsLoadingSystemInfo(true);
    try {
      const response = await generalApi.getSystemInfo();
      if (response.success && response.data) {
        setSystemInfo(response.data);
      }
    } catch (error) {
      console.error("Failed to fetch system info:", error);
      toast.error("Failed to load system information");
    } finally {
      setIsLoadingSystemInfo(false);
    }
  };

  const handleProfileSave = async () => {
    setIsLoading(true);
    try {
      // Combine first and last name, handling empty lastName
      const fullName = profileData.lastName 
        ? `${profileData.firstName} ${profileData.lastName}`.trim()
        : profileData.firstName.trim();
      
      if (!fullName) {
        toast.error("Name is required");
        setIsLoading(false);
        return;
      }
      
      const response = await authApi.updateProfile({
        name: fullName,
        phone: profileData.phone || undefined,
        designation: profileData.designation || undefined,
        department_id: profileData.department || undefined,
      });
      
      if (response.success && response.data) {
        // Update user in auth store
        setUser(response.data.user);
        toast.success("Profile updated successfully");
      } else {
        toast.error(response.error || "Failed to update profile");
      }
    } catch (error: unknown) {
      const err = error as { message?: string };
      toast.error(err.message || "Failed to update profile");
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
      const response = await authApi.changePassword({
        currentPassword: securityData.currentPassword,
        newPassword: securityData.newPassword,
      });
      
      if (response.success) {
        toast.success("Password changed successfully");
        setSecurityData({
          currentPassword: "",
          newPassword: "",
          confirmPassword: "",
        });
      } else {
        toast.error(response.error || "Failed to change password");
      }
    } catch (error: unknown) {
      const err = error as { message?: string };
      toast.error(err.message || "Failed to change password");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePreferencesSave = async () => {
    setIsLoading(true);
    try {
      const response = await authApi.updatePreferences(preferences);
      
      if (response.success) {
        toast.success("Preferences saved successfully");
      } else {
        toast.error(response.error || "Failed to save preferences");
      }
    } catch (error: unknown) {
      const err = error as { message?: string };
      toast.error(err.message || "Failed to save preferences");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file size (2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image size must be less than 2MB");
      return;
    }

    setIsUploadingAvatar(true);
    const formData = new FormData();
    formData.append("avatar", file);

    try {
      const response = await authApi.uploadAvatar(formData);
      if (response.success && response.data) {
        setUser(response.data.user);
        toast.success("Avatar updated successfully");
      } else {
        toast.error(response.error || "Failed to upload avatar");
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to upload avatar");
    } finally {
      setIsUploadingAvatar(false);
      // Reset input
      if (fileInputRef.current) fileInputRef.current.value = "";
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
                      <Avatar size="xl" className="w-20 h-20 border-2 border-border">
                        <AvatarImage 
                          src={user?.profile_image_url || undefined} 
                          alt={user?.name || "User"} 
                        />
                        <AvatarFallback className="text-xl bg-zinc-100 dark:bg-zinc-800">
                          {profileData.firstName?.[0] || user?.name?.[0] || "U"}
                          {profileData.lastName?.[0] || ""}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <input
                          type="file"
                          ref={fileInputRef}
                          className="hidden"
                          accept="image/*"
                          onChange={handleAvatarChange}
                        />
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => fileInputRef.current?.click()}
                          isLoading={isUploadingAvatar}
                        >
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
                      disabled
                      hint="Phone number is set securely by administration"
                    />
                    <Select
                      label="Department"
                      options={[
                        { value: "", label: "Select Department" },
                        ...departments.map((dept) => ({
                          value: dept.id,
                          label: `${dept.code} - ${dept.name}`,
                        })),
                      ]}
                      value={profileData.department}
                      onChange={(e) =>
                        setProfileData((prev) => ({
                          ...prev,
                          department: e.target.value,
                        }))
                      }
                      disabled
                    />
                    <Select
                      label="Designation"
                      options={[
                        { value: "Professor", label: "Professor" },
                        { value: "Head of Department", label: "Head of Department" },
                        { value: "Associate Teacher", label: "Associate Teacher" },
                        { value: "Assistant Teacher", label: "Assistant Teacher" },
                        { value: "Lab Coordinator", label: "Lab Coordinator" },
                      ]}
                      value={profileData.designation}
                      onChange={(e) =>
                        setProfileData((prev) => ({
                          ...prev,
                          designation: e.target.value,
                        }))
                      }
                      disabled
                    />

                    {/* Specialization — read-only display */}
                    {profileData.specialization && (
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-1.5">
                          Specialization
                        </label>
                        <div className="flex items-center gap-2 px-4 py-3 rounded-xl border border-border bg-muted/40">
                          <GraduationCap className="h-4 w-4 text-primary flex-shrink-0" />
                          <span className="text-sm font-medium text-foreground">
                            {profileData.specialization}
                          </span>
                          <span className="ml-auto text-xs text-muted-foreground bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                            Enrolled
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Specialization is set during account creation and cannot be changed here.
                        </p>
                      </div>
                    )}

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
                        <button 
                          onClick={async () => {
                            try {
                              if (!('serviceWorker' in navigator)) {
                                toast.error("Browser does not support notifications");
                                return;
                              }
                              
                              const permission = await Notification.requestPermission();
                              if (permission !== 'granted') {
                                toast.error("Permission denied for notifications");
                                return;
                              }

                              const registration = await navigator.serviceWorker.ready;
                              const subscription = await registration.pushManager.subscribe({
                                userVisibleOnly: true,
                                applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
                              });

                              await notificationsApi.subscribe(subscription);
                              toast.success("Successfully subscribed to push notifications");
                              setPreferences(p => ({ ...p, pushNotifications: true }));
                            } catch (err: any) {
                              console.error(err);
                              toast.error("Push subscription failed: " + err.message);
                            }
                          }}
                          className="text-xs text-blue-500 hover:underline mt-1 block"
                        >
                          {preferences.pushNotifications ? "Reset/Update Subscription" : "Enable Push on this Device"}
                        </button>
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

                    <div className="flex justify-between items-center pt-4 border-t border-border/10">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          setIsTestingNotifications(true);
                          try {
                            const res = await notificationsApi.test();
                            if (res.success) {
                              toast.success("Test signals dispatched! Check your email and browser alerts.");
                            } else {
                              toast.error(res.error || "Failed to trigger test.");
                            }
                          } catch (err: any) {
                            toast.error(err.message || "Network error during test.");
                          } finally {
                            setIsTestingNotifications(false);
                          }
                        }}
                        isLoading={isTestingNotifications}
                      >
                        <Bell className="h-4 w-4 mr-2" />
                        Trigger System Test
                      </Button>

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
                    {isLoadingSystemInfo ? (
                      <div className="grid grid-cols-2 gap-4">
                        {[1, 2, 3, 4].map((i) => (
                          <div key={i} className="p-4 rounded-lg bg-zinc-50 dark:bg-zinc-800">
                            <Skeleton className="h-4 w-20 mb-2" />
                            <Skeleton className="h-6 w-32" />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 rounded-lg bg-zinc-50 dark:bg-zinc-800">
                          <p className="text-xs text-zinc-500 uppercase tracking-wide">
                            Version
                          </p>
                          <p className="font-medium text-zinc-900 dark:text-white mt-1">
                            {systemInfo?.application.version || "1.0.0"}
                          </p>
                        </div>
                        <div className="p-4 rounded-lg bg-zinc-50 dark:bg-zinc-800">
                          <p className="text-xs text-zinc-500 uppercase tracking-wide">
                            Environment
                          </p>
                          <p className="font-medium text-zinc-900 dark:text-white mt-1">
                            {systemInfo?.application.environment
                              ? systemInfo.application.environment.charAt(0).toUpperCase() +
                                systemInfo.application.environment.slice(1)
                              : "Production"}
                          </p>
                        </div>
                        <div className="p-4 rounded-lg bg-zinc-50 dark:bg-zinc-800">
                          <p className="text-xs text-zinc-500 uppercase tracking-wide">
                            Frontend
                          </p>
                          <p className="font-medium text-zinc-900 dark:text-white mt-1">
                            {systemInfo?.application.frontend.framework}{" "}
                            {systemInfo?.application.frontend.version || "16"}
                          </p>
                        </div>
                        <div className="p-4 rounded-lg bg-zinc-50 dark:bg-zinc-800">
                          <p className="text-xs text-zinc-500 uppercase tracking-wide">
                            Database
                          </p>
                          <p className="font-medium text-zinc-900 dark:text-white mt-1">
                            {systemInfo?.application.database.type} ({systemInfo?.application.database.engine})
                          </p>
                        </div>
                      </div>
                    )}
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
                    {isLoadingSystemInfo ? (
                      <>
                        {[1, 2].map((i) => (
                          <div key={i} className="flex items-center justify-between p-4 rounded-lg border border-zinc-200 dark:border-zinc-800">
                            <div className="flex items-center gap-3">
                              <Skeleton className="h-10 w-10 rounded-lg" />
                              <div>
                                <Skeleton className="h-5 w-32 mb-1" />
                                <Skeleton className="h-4 w-48" />
                              </div>
                            </div>
                            <Skeleton className="h-6 w-24" />
                          </div>
                        ))}
                      </>
                    ) : (
                      <>
                        <div className="flex items-center justify-between p-4 rounded-lg border border-zinc-200 dark:border-zinc-800">
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${
                              systemInfo?.services.supabase.connected
                                ? "bg-emerald-100 dark:bg-emerald-900/20"
                                : "bg-red-100 dark:bg-red-900/20"
                            }`}>
                              <Database className={`h-5 w-5 ${
                                systemInfo?.services.supabase.connected
                                  ? "text-emerald-600"
                                  : "text-red-600"
                              }`} />
                            </div>
                            <div>
                              <p className="font-medium text-zinc-900 dark:text-white">
                                {systemInfo?.services.supabase.name || "Supabase"}
                              </p>
                              <p className="text-sm text-zinc-500">
                                {systemInfo?.services.supabase.description || "Database & Authentication"}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Check className={`h-4 w-4 ${
                              systemInfo?.services.supabase.connected
                                ? "text-emerald-500"
                                : "text-red-500"
                            }`} />
                            <span className={`text-sm ${
                              systemInfo?.services.supabase.connected
                                ? "text-emerald-600"
                                : "text-red-600"
                            }`}>
                              {systemInfo?.services.supabase.connected ? "Connected" : "Disconnected"}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between p-4 rounded-lg border border-zinc-200 dark:border-zinc-800">
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${
                              systemInfo?.services.gemini.connected
                                ? "bg-blue-100 dark:bg-blue-900/20"
                                : "bg-red-100 dark:bg-red-900/20"
                            }`}>
                              <GraduationCap className={`h-5 w-5 ${
                                systemInfo?.services.gemini.connected
                                  ? "text-blue-600"
                                  : "text-red-600"
                              }`} />
                            </div>
                            <div>
                              <p className="font-medium text-zinc-900 dark:text-white">
                                {systemInfo?.services.gemini.name || "Google Gemini"}
                              </p>
                              <p className="text-sm text-zinc-500">
                                {systemInfo?.services.gemini.description || "AI Course Code Generation"}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Check className={`h-4 w-4 ${
                              systemInfo?.services.gemini.connected
                                ? "text-emerald-500"
                                : "text-red-500"
                            }`} />
                            <span className={`text-sm ${
                              systemInfo?.services.gemini.connected
                                ? "text-emerald-600"
                                : "text-red-600"
                            }`}>
                              {systemInfo?.services.gemini.connected ? "Connected" : "Disconnected"}
                            </span>
                          </div>
                        </div>
                      </>
                    )}
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
