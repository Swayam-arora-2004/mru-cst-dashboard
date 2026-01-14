"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { Button } from "./button";

const dialogVariants = cva(
  "fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in-0",
  {
    variants: {
      backdrop: {
        blur: "bg-background/80 backdrop-blur-sm",
        dark: "bg-black/50",
        light: "bg-white/50",
      },
    },
    defaultVariants: {
      backdrop: "blur",
    },
  }
);

const dialogContentVariants = cva(
  "relative bg-background border border-border rounded-lg shadow-lg w-full animate-in zoom-in-95 slide-in-from-bottom-4",
  {
    variants: {
      size: {
        sm: "max-w-sm",
        md: "max-w-md",
        lg: "max-w-lg",
        xl: "max-w-xl",
        "2xl": "max-w-2xl",
        full: "max-w-full m-4",
      },
    },
    defaultVariants: {
      size: "md",
    },
  }
);

export interface DialogProps extends VariantProps<typeof dialogVariants> {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
}

export interface DialogContentProps
  extends VariantProps<typeof dialogContentVariants> {
  children: React.ReactNode;
  className?: string;
  showClose?: boolean;
  onClose?: () => void;
}

export interface DialogHeaderProps {
  children: React.ReactNode;
  className?: string;
}

export interface DialogTitleProps {
  children: React.ReactNode;
  className?: string;
}

export interface DialogDescriptionProps {
  children: React.ReactNode;
  className?: string;
}

export interface DialogBodyProps {
  children: React.ReactNode;
  className?: string;
}

export interface DialogFooterProps {
  children: React.ReactNode;
  className?: string;
}

const Dialog: React.FC<DialogProps> = ({
  open,
  onClose,
  children,
  backdrop,
  className,
}) => {
  React.useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className={cn(dialogVariants({ backdrop }), className)}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      {children}
    </div>
  );
};

const DialogContent = React.forwardRef<HTMLDivElement, DialogContentProps>(
  ({ children, size, className, showClose = true, onClose }, ref) => (
    <div
      ref={ref}
      className={cn(dialogContentVariants({ size }), className)}
      onClick={(e) => e.stopPropagation()}
    >
      {showClose && onClose && (
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none"
          aria-label="Close dialog"
        >
          <X className="h-4 w-4" />
        </button>
      )}
      {children}
    </div>
  )
);
DialogContent.displayName = "DialogContent";

const DialogHeader: React.FC<DialogHeaderProps> = ({ children, className }) => (
  <div className={cn("flex flex-col space-y-1.5 px-6 pt-6", className)}>
    {children}
  </div>
);

const DialogTitle: React.FC<DialogTitleProps> = ({ children, className }) => (
  <h2
    className={cn(
      "text-lg font-semibold leading-none tracking-tight",
      className
    )}
  >
    {children}
  </h2>
);

const DialogDescription: React.FC<DialogDescriptionProps> = ({
  children,
  className,
}) => (
  <p className={cn("text-sm text-muted-foreground", className)}>{children}</p>
);

const DialogBody: React.FC<DialogBodyProps> = ({ children, className }) => (
  <div className={cn("px-6 py-4", className)}>{children}</div>
);

const DialogFooter: React.FC<DialogFooterProps> = ({
  children,
  className,
}) => (
  <div
    className={cn(
      "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 px-6 pb-6",
      className
    )}
  >
    {children}
  </div>
);

export {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
};
