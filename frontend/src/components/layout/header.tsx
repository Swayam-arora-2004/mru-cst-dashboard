"use client";

import { Search, Bell } from "lucide-react";
import { Input } from "@/components/ui/input";

interface HeaderProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function Header({ title, description, action }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800">
      <div className="flex items-center justify-between px-6 py-4 lg:px-8">
        <div className="flex-1 min-w-0 lg:ml-0 ml-12">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white truncate">
            {title}
          </h1>
          {description && (
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              {description}
            </p>
          )}
        </div>

        <div className="flex items-center gap-4">
          {/* Search */}
          <div className="hidden md:block w-64">
            <Input
              placeholder="Search..."
              leftIcon={<Search className="h-4 w-4" />}
            />
          </div>

          {/* Notifications */}
          <button className="relative p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800">
            <Bell className="h-5 w-5" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
          </button>

          {/* Action button */}
          {action}
        </div>
      </div>
    </header>
  );
}
