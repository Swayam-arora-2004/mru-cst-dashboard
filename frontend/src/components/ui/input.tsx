"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  icon?: React.ReactNode;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, label, error, hint, icon, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
            {label}
          </label>
        )}
        <div className="relative">
          {icon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">
              {icon}
            </div>
          )}
          <input
            type={type}
            className={cn(
              "flex h-11 w-full rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm transition-all duration-200",
              "placeholder:text-zinc-400",
              "focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900",
              "disabled:cursor-not-allowed disabled:opacity-50",
              "dark:border-zinc-800 dark:bg-zinc-950 dark:focus:ring-zinc-100/10 dark:focus:border-zinc-100",
              icon && "pl-10",
              error && "border-red-500 focus:ring-red-500/20 focus:border-red-500",
              className
            )}
            ref={ref}
            {...props}
          />
        </div>
        {error && (
          <p className="mt-1.5 text-sm text-red-500">{error}</p>
        )}
        {hint && !error && (
          <p className="mt-1.5 text-xs text-zinc-500">{hint}</p>
        )}
      </div>
    );
  }
);
Input.displayName = "Input";

export { Input };
