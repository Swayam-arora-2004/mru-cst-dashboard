"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const skeletonVariants = cva("animate-pulse rounded-md bg-muted", {
  variants: {
    variant: {
      default: "",
      circle: "rounded-full",
      text: "h-4 w-full",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

export interface SkeletonProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof skeletonVariants> {}

function Skeleton({ className, variant, ...props }: SkeletonProps) {
  return (
    <div
      className={cn(skeletonVariants({ variant }), className)}
      {...props}
    />
  );
}

/**
 * Skeleton Group - Renders multiple skeleton lines
 */
interface SkeletonGroupProps {
  lines?: number;
  className?: string;
  lineClassName?: string;
}

function SkeletonGroup({
  lines = 3,
  className,
  lineClassName,
}: SkeletonGroupProps) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          variant="text"
          className={cn(
            i === lines - 1 && "w-4/5", // Last line is shorter
            lineClassName
          )}
        />
      ))}
    </div>
  );
}

/**
 * Card Skeleton - Common pattern for loading cards
 */
interface SkeletonCardProps {
  className?: string;
  showAvatar?: boolean;
}

function SkeletonCard({ className, showAvatar = false }: SkeletonCardProps) {
  return (
    <div className={cn("p-6 space-y-4", className)}>
      <div className="flex items-start space-x-4">
        {showAvatar && <Skeleton variant="circle" className="h-12 w-12" />}
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
      <SkeletonGroup lines={3} />
    </div>
  );
}

/**
 * Table Skeleton - Common pattern for loading tables
 */
interface SkeletonTableProps {
  rows?: number;
  columns?: number;
  className?: string;
}

function SkeletonTable({
  rows = 5,
  columns = 4,
  className,
}: SkeletonTableProps) {
  return (
    <div className={cn("space-y-3", className)}>
      {/* Header */}
      <div className="flex gap-4">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} className="h-4 flex-1" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex gap-4">
          {Array.from({ length: columns }).map((_, colIndex) => (
            <Skeleton key={colIndex} className="h-8 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

export { Skeleton, SkeletonGroup, SkeletonCard, SkeletonTable, skeletonVariants };
