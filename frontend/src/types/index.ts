/**
 * Global type definitions for the application
 */

// ============================================================================
// API Response Types
// ============================================================================

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ============================================================================
// Component Props Types
// ============================================================================

export interface BaseComponentProps {
  className?: string;
  children?: React.ReactNode;
}

export type Variant =
  | "default"
  | "primary"
  | "secondary"
  | "destructive"
  | "success"
  | "warning"
  | "info"
  | "ghost"
  | "link"
  | "outline";

export type Size = "sm" | "md" | "lg" | "xl" | "2xl";

export type Status = "idle" | "loading" | "success" | "error";

export type Theme = "light" | "dark" | "system";

// ============================================================================
// Form Types
// ============================================================================

export interface FormFieldProps {
  name: string;
  label?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  error?: string;
  helperText?: string;
}

export interface SelectOption<T = string> {
  label: string;
  value: T;
  disabled?: boolean;
}

// ============================================================================
// Table Types
// ============================================================================

export interface TableColumn<T = any> {
  key: string;
  header: string;
  accessor?: (row: T) => React.ReactNode;
  sortable?: boolean;
  width?: string | number;
  align?: "left" | "center" | "right";
}

export interface TableProps<T = any> {
  data: T[];
  columns: TableColumn<T>[];
  loading?: boolean;
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
}

export interface SortConfig {
  key: string;
  direction: "asc" | "desc";
}

// ============================================================================
// Modal/Dialog Types
// ============================================================================

export interface ModalProps extends BaseComponentProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  footer?: React.ReactNode;
  size?: Size;
}

// ============================================================================
// Toast/Notification Types
// ============================================================================

export type ToastType = "success" | "error" | "warning" | "info";

export interface ToastOptions {
  title?: string;
  description?: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

// ============================================================================
// Navigation Types
// ============================================================================

export interface NavItem {
  name: string;
  href: string;
  icon?: React.ComponentType<{ className?: string }>;
  badge?: string | number;
  children?: NavItem[];
}

export interface Breadcrumb {
  label: string;
  href?: string;
}

// ============================================================================
// User/Auth Types
// ============================================================================

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: UserRole;
  designation?: string;
  department?: string;
}

export type UserRole = "admin" | "teacher" | "student" | "staff";

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  register: (data: RegisterData) => Promise<void>;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData extends LoginCredentials {
  name: string;
  designation?: string;
}

// ============================================================================
// File/Upload Types
// ============================================================================

export interface FileUpload {
  file: File;
  progress: number;
  status: "pending" | "uploading" | "success" | "error";
  url?: string;
  error?: string;
}

export interface FilePreview {
  name: string;
  size: number;
  type: string;
  url: string;
}

// ============================================================================
// Date/Time Types
// ============================================================================

export interface DateRange {
  from: Date;
  to: Date;
}

export type TimeUnit = "second" | "minute" | "hour" | "day" | "week" | "month" | "year";

// ============================================================================
// Filter/Search Types
// ============================================================================

export interface FilterOption<T = string> {
  label: string;
  value: T;
  count?: number;
}

export interface SearchFilter {
  query: string;
  filters: Record<string, any>;
  sort?: SortConfig;
}

// ============================================================================
// Utility Types
// ============================================================================

export type Nullable<T> = T | null;
export type Optional<T> = T | undefined;
export type Maybe<T> = T | null | undefined;

export type DeepPartial<T> = T extends object
  ? {
      [P in keyof T]?: DeepPartial<T[P]>;
    }
  : T;

export type RequireAtLeastOne<T, Keys extends keyof T = keyof T> = Pick<T, Exclude<keyof T, Keys>> &
  {
    [K in Keys]-?: Required<Pick<T, K>> & Partial<Pick<T, Exclude<Keys, K>>>;
  }[Keys];

export type RequireOnlyOne<T, Keys extends keyof T = keyof T> = Pick<T, Exclude<keyof T, Keys>> &
  {
    [K in Keys]-?: Required<Pick<T, K>> & Partial<Record<Exclude<Keys, K>, undefined>>;
  }[Keys];

// ============================================================================
// Event Types
// ============================================================================

export type EventHandler<T = void> = (event: T) => void;
export type AsyncEventHandler<T = void> = (event: T) => Promise<void>;

// ============================================================================
// Generic Action Types
// ============================================================================

export interface Action<T = any> {
  type: string;
  payload?: T;
}

export type AsyncAction<T = any> = (...args: any[]) => Promise<T>;

// ============================================================================
// Error Types
// ============================================================================

export interface AppError {
  code: string;
  message: string;
  details?: any;
}

export interface ValidationError {
  field: string;
  message: string;
}

// ============================================================================
// Chart/Analytics Types
// ============================================================================

export interface ChartDataPoint {
  label: string;
  value: number;
  color?: string;
}

export interface ChartData {
  labels: string[];
  datasets: ChartDataset[];
}

export interface ChartDataset {
  label: string;
  data: number[];
  backgroundColor?: string | string[];
  borderColor?: string | string[];
}

// ============================================================================
// Dashboard/Stats Types
// ============================================================================

export interface StatCard {
  title: string;
  value: number | string;
  change?: number;
  changeType?: "increase" | "decrease";
  icon?: React.ComponentType<{ className?: string }>;
  color?: string;
}

export interface DashboardStats {
  counts: {
    students: number;
    courses: number;
    departments: number;
    classes: number;
  };
  recentStudents?: any[];
  upcomingClasses?: any[];
}

// ============================================================================
// Export all types
// ============================================================================
