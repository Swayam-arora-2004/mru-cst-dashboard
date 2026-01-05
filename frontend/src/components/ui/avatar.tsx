"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { generateInitials } from "@/lib/utils";

interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  src?: string | null;
  alt?: string;
  fallback?: string;
  size?: "sm" | "md" | "lg" | "xl";
}

const sizeClasses = {
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-12 w-12 text-base",
  xl: "h-16 w-16 text-lg",
};

const Avatar = React.forwardRef<HTMLDivElement, AvatarProps>(
  ({ className, src, alt, fallback, size = "md", ...props }, ref) => {
    const [imageError, setImageError] = React.useState(false);

    const initials = fallback ? generateInitials(fallback) : "??";

    return (
      <div
        ref={ref}
        className={cn(
          "relative flex shrink-0 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800",
          sizeClasses[size],
          className
        )}
        {...props}
      >
        {src && !imageError ? (
          <img
            src={src}
            alt={alt || "Avatar"}
            className="aspect-square h-full w-full object-cover"
            onError={() => setImageError(true)}
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center font-medium text-zinc-600 dark:text-zinc-300">
            {initials}
          </span>
        )}
      </div>
    );
  }
);
Avatar.displayName = "Avatar";

export { Avatar };
