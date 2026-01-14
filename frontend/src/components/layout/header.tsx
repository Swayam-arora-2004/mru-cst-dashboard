"use client";

import { Search, Bell } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/ui/theme-toggle";

interface HeaderProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function Header({ title, description, action }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 bg-card/80 backdrop-blur-md border-b border-border">
      <div className="flex items-center justify-between px-6 py-4 lg:px-8">
        <div className="flex-1 min-w-0 lg:ml-0 ml-12">
          <h1 className="text-2xl font-bold text-foreground truncate">
            {title}
          </h1>
          {description && (
            <p className="mt-1 text-sm text-muted-foreground">
              {description}
            </p>
          )}
        </div>

        <div className="flex items-center gap-4">
          {/* Theme Toggle */}
          <ThemeToggle />

          {/* Search */}
          {/* <div className="hidden md:block w-64">
            <Input
              placeholder="Search..."
              leftIcon={<Search className="h-4 w-4" />}
            />
          </div> */}

          {/* Notifications */}
          {/* <button className="relative p-2 text-muted-foreground hover:text-foreground transition-colors rounded-xl hover:bg-secondary">
            <Bell className="h-5 w-5" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-destructive rounded-full" />
          </button> */}

          {/* Action button */}
          {action}
        </div>
      </div>
    </header>
  );
}
