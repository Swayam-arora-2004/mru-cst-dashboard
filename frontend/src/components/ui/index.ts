/**
 * UI Components Barrel Export
 * 
 * Centralized export for all UI components
 * Enables clean imports: import { Button, Card } from '@/components/ui'
 */

// Form Components
export { Button, buttonVariants } from "./button";
export type { ButtonProps } from "./button";

export { Input, inputVariants } from "./input";
export type { InputProps } from "./input";

export { Label } from "./label";
export type { LabelProps } from "./label";

export { Textarea, textareaVariants } from "./textarea";
export type { TextareaProps } from "./textarea";

export { Checkbox } from "./checkbox";
export type { CheckboxProps } from "./checkbox";

export { 
  Select, 
  SelectTrigger, 
  SelectValue, 
  SelectContent, 
  SelectItem 
} from "./select";
export type { SelectProps } from "./select";

// Layout Components
export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
  cardVariants,
} from "./card";
export type { CardProps } from "./card";

export {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
} from "./dialog";
export type {
  DialogProps,
  DialogContentProps,
  DialogHeaderProps,
  DialogTitleProps,
  DialogDescriptionProps,
  DialogBodyProps,
  DialogFooterProps,
} from "./dialog";

export { Modal } from "./modal";
export type { ModalProps } from "./modal";

// Feedback Components
export { Alert, AlertTitle, AlertDescription, alertVariants } from "./alert";
export type { AlertProps } from "./alert";

export { Badge } from "./badge";
export type { BadgeProps } from "./badge";

export { Spinner } from "./spinner";
export type { SpinnerProps } from "./spinner";

export {
  Skeleton,
  SkeletonGroup,
  SkeletonCard,
  SkeletonTable,
  skeletonVariants,
} from "./skeleton";
export type { SkeletonProps } from "./skeleton";

// Data Display
export { Avatar, AvatarImage, AvatarFallback } from "./avatar";
export type { AvatarProps } from "./avatar";

export { EmptyState } from "./empty-state";
export type { EmptyStateProps } from "./empty-state";

export { ThemeToggle } from "./theme-toggle";
