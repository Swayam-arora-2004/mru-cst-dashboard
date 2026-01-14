"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const textareaVariants = cva(
  "flex min-h-[80px] w-full rounded-md border bg-background px-3 py-2 text-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "border-input",
        error: "border-destructive focus-visible:ring-destructive",
        success: "border-success focus-visible:ring-success",
      },
      resize: {
        none: "resize-none",
        vertical: "resize-y",
        horizontal: "resize-x",
        both: "resize",
      },
    },
    defaultVariants: {
      variant: "default",
      resize: "vertical",
    },
  }
);

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement>,
    VariantProps<typeof textareaVariants> {
  label?: string;
  error?: string;
  hint?: string;
  wrapperClassName?: string;
  maxLength?: number;
  showCount?: boolean;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      className,
      label,
      error,
      hint,
      variant,
      resize,
      wrapperClassName,
      id,
      maxLength,
      showCount = false,
      value,
      defaultValue,
      ...props
    },
    ref
  ) => {
    const textareaId = id || React.useId();
    const effectiveVariant = error ? "error" : variant;
    const [charCount, setCharCount] = React.useState(
      (value?.toString() || defaultValue?.toString() || "").length
    );

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      if (showCount) {
        setCharCount(e.target.value.length);
      }
      props.onChange?.(e);
    };

    return (
      <div className={cn("w-full space-y-2", wrapperClassName)}>
        <div className="flex items-center justify-between">
          {label && (
            <label
              htmlFor={textareaId}
              className="block text-sm font-medium leading-none"
            >
              {label}
              {props.required && <span className="text-destructive ml-1">*</span>}
            </label>
          )}
          {showCount && maxLength && (
            <span className="text-xs text-muted-foreground">
              {charCount}/{maxLength}
            </span>
          )}
        </div>
        <textarea
          id={textareaId}
          className={cn(
            textareaVariants({ variant: effectiveVariant, resize }),
            className
          )}
          ref={ref}
          aria-invalid={!!error}
          aria-describedby={
            error ? `${textareaId}-error` : hint ? `${textareaId}-hint` : undefined
          }
          maxLength={maxLength}
          value={value}
          defaultValue={defaultValue}
          onChange={handleChange}
          {...props}
        />
        {error && (
          <p id={`${textareaId}-error`} className="text-sm text-destructive">
            {error}
          </p>
        )}
        {hint && !error && (
          <p id={`${textareaId}-hint`} className="text-xs text-muted-foreground">
            {hint}
          </p>
        )}
      </div>
    );
  }
);

Textarea.displayName = "Textarea";

export { Textarea, textareaVariants };
