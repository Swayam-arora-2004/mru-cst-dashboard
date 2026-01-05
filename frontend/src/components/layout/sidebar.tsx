"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  Users,
  BookOpen,
  ScanFace,
  Settings,
  LogOut,
  Menu,
  X,
  GraduationCap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/authStore";
import { Avatar } from "@/components/ui/avatar";
import { useState } from "react";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Students", href: "/dashboard/students", icon: Users },
  { name: "Courses", href: "/dashboard/courses", icon: BookOpen },
  { name: "Face Recognition", href: "/dashboard/face-recognition", icon: ScanFace },
  { name: "Settings", href: "/dashboard/settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuthStore();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const handleLogout = () => {
    logout();
    window.location.href = "/login";
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-6 border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-zinc-900 dark:bg-white">
          <GraduationCap className="h-5 w-5 text-white dark:text-zinc-900" />
        </div>
        <div>
          <h1 className="font-bold text-lg text-zinc-900 dark:text-white">MRU Dashboard</h1>
          <p className="text-xs text-zinc-500">University ERP</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
        {navigation.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={() => setIsMobileOpen(false)}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200",
                isActive
                  ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                  : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.name}
              {isActive && (
                <motion.div
                  layoutId="activeNav"
                  className="absolute right-0 w-1 h-8 bg-zinc-900 dark:bg-white rounded-l-full"
                />
              )}
            </Link>
          );
        })}
      </nav>

      {/* User section */}
      <div className="p-4 border-t border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50">
          <Avatar fallback={user?.name || "User"} size="md" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-zinc-900 dark:text-white truncate">
              {user?.name || "Teacher"}
            </p>
            <p className="text-xs text-zinc-500 truncate">
              {user?.designation || "Faculty"}
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700"
            title="Logout"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile menu button */}
      <button
        onClick={() => setIsMobileOpen(!isMobileOpen)}
        className="fixed top-4 left-4 z-50 p-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm lg:hidden"
      >
        {isMobileOpen ? (
          <X className="h-5 w-5" />
        ) : (
          <Menu className="h-5 w-5" />
        )}
      </button>

      {/* Mobile sidebar */}
      <motion.div
        initial={false}
        animate={{
          x: isMobileOpen ? 0 : "-100%",
        }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        className="fixed inset-y-0 left-0 z-40 w-72 bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 lg:hidden"
      >
        <SidebarContent />
      </motion.div>

      {/* Mobile overlay */}
      {isMobileOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setIsMobileOpen(false)}
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
        />
      )}

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-40 lg:w-72 lg:block">
        <div className="flex flex-col h-full bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800">
          <SidebarContent />
        </div>
      </div>
    </>
  );
}
