"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default:
          "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100",
        primary:
          "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
        secondary:
          "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
        success:
          "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
        warning:
          "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
        destructive:
          "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
        outline:
          "border border-zinc-200 text-zinc-700 dark:border-zinc-700 dark:text-zinc-300",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
