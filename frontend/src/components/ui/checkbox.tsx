"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: string;
  description?: string;
  error?: string;
  wrapperClassName?: string;
  onCheckedChange?: (checked: boolean) => void;
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  (
    {
      className,
      label,
      description,
      error,
      wrapperClassName,
      id,
      checked,
      defaultChecked,
      onChange,
      onCheckedChange,
      ...props
    },
    ref
  ) => {
    const checkboxId = id || React.useId();
    const [isChecked, setIsChecked] = React.useState(
      checked ?? defaultChecked ?? false
    );

    React.useEffect(() => {
      if (checked !== undefined) {
        setIsChecked(checked);
      }
    }, [checked]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newChecked = e.target.checked;
      if (checked === undefined) {
        setIsChecked(newChecked);
      }
      onChange?.(e);
      onCheckedChange?.(newChecked);
    };

    return (
      <div className={cn("space-y-2", wrapperClassName)}>
        <div className="flex items-start space-x-3">
          <div className="relative flex items-center">
            <input
              id={checkboxId}
              type="checkbox"
              ref={ref}
              checked={checked ?? isChecked}
              onChange={handleChange}
              className="peer sr-only"
              aria-invalid={!!error}
              aria-describedby={
                error
                  ? `${checkboxId}-error`
                  : description
                  ? `${checkboxId}-description`
                  : undefined
              }
              {...props}
            />
            <div
              className={cn(
                "h-5 w-5 rounded border-2 border-input transition-all duration-200",
                "peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2",
                "peer-checked:bg-primary peer-checked:border-primary",
                "peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
                error && "border-destructive",
                className
              )}
            >
              {(checked ?? isChecked) && (
                <Check className="h-full w-full text-primary-foreground p-0.5" />
              )}
            </div>
          </div>
          {(label || description) && (
            <div className="flex-1">
              {label && (
                <label
                  htmlFor={checkboxId}
                  className="text-sm font-medium leading-none cursor-pointer peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  {label}
                  {props.required && <span className="text-destructive ml-1">*</span>}
                </label>
              )}
              {description && (
                <p
                  id={`${checkboxId}-description`}
                  className="text-xs text-muted-foreground mt-1"
                >
                  {description}
                </p>
              )}
            </div>
          )}
        </div>
        {error && (
          <p id={`${checkboxId}-error`} className="text-sm text-destructive">
            {error}
          </p>
        )}
      </div>
    );
  }
);

Checkbox.displayName = "Checkbox";

export { Checkbox };
