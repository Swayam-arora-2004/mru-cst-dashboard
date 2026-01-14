/**
 * Application-wide constants
 */

// ============================================================================
// API Configuration
// ============================================================================

export const API_CONFIG = {
  BASE_URL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001/api",
  FACE_API_MODEL_URL: process.env.NEXT_PUBLIC_FACE_API_MODEL_URL || "https://justadudewhohacks.github.io/face-api.js/models",
  TIMEOUT: 30000,
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000,
} as const;

// ============================================================================
// Authentication
// ============================================================================

export const AUTH_CONFIG = {
  TOKEN_KEY: "auth_token",
  USER_KEY: "auth_user",
  REFRESH_TOKEN_KEY: "refresh_token",
  TOKEN_EXPIRY_BUFFER: 300, // 5 minutes in seconds
} as const;

// ============================================================================
// Pagination
// ============================================================================

export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_PAGE_SIZE: 10,
  PAGE_SIZE_OPTIONS: [10, 20, 50, 100],
  MAX_PAGE_SIZE: 100,
} as const;

// ============================================================================
// Form Validation
// ============================================================================

export const VALIDATION = {
  MIN_PASSWORD_LENGTH: 8,
  MAX_PASSWORD_LENGTH: 128,
  MIN_USERNAME_LENGTH: 3,
  MAX_USERNAME_LENGTH: 20,
  MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
  ALLOWED_IMAGE_TYPES: ["image/jpeg", "image/png", "image/gif", "image/webp"],
  ALLOWED_DOCUMENT_TYPES: [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ],
} as const;

// ============================================================================
// UI Configuration
// ============================================================================

export const UI_CONFIG = {
  TOAST_DURATION: 3000,
  DEBOUNCE_DELAY: 300,
  THROTTLE_DELAY: 1000,
  ANIMATION_DURATION: 200,
  SKELETON_LINES: 3,
} as const;

// ============================================================================
// Breakpoints (Tailwind)
// ============================================================================

export const BREAKPOINTS = {
  SM: 640,
  MD: 768,
  LG: 1024,
  XL: 1280,
  "2XL": 1536,
} as const;

// ============================================================================
// Date Formats
// ============================================================================

export const DATE_FORMATS = {
  SHORT: "MMM dd, yyyy",
  LONG: "MMMM dd, yyyy",
  FULL: "EEEE, MMMM dd, yyyy",
  TIME: "HH:mm",
  DATETIME: "MMM dd, yyyy HH:mm",
  ISO: "yyyy-MM-dd",
} as const;

// ============================================================================
// Routes
// ============================================================================

export const ROUTES = {
  HOME: "/",
  LOGIN: "/login",
  REGISTER: "/register",
  DASHBOARD: "/dashboard",
  STUDENTS: "/dashboard/students",
  COURSES: "/dashboard/courses",
  FACE_RECOGNITION: "/dashboard/face-recognition",
  SETTINGS: "/dashboard/settings",
} as const;

// ============================================================================
// Error Messages
// ============================================================================

export const ERROR_MESSAGES = {
  GENERIC: "Something went wrong. Please try again.",
  NETWORK: "Network error. Please check your connection.",
  UNAUTHORIZED: "You are not authorized to perform this action.",
  NOT_FOUND: "The requested resource was not found.",
  VALIDATION: "Please check your input and try again.",
  SERVER: "Server error. Please try again later.",
} as const;

// ============================================================================
// Success Messages
// ============================================================================

export const SUCCESS_MESSAGES = {
  CREATED: "Created successfully!",
  UPDATED: "Updated successfully!",
  DELETED: "Deleted successfully!",
  SAVED: "Saved successfully!",
  COPIED: "Copied to clipboard!",
} as const;

// ============================================================================
// Status
// ============================================================================

export const STATUS = {
  IDLE: "idle",
  LOADING: "loading",
  SUCCESS: "success",
  ERROR: "error",
} as const;

// ============================================================================
// User Roles
// ============================================================================

export const ROLES = {
  ADMIN: "admin",
  TEACHER: "teacher",
  STUDENT: "student",
  STAFF: "staff",
} as const;

// ============================================================================
// File Upload
// ============================================================================

export const FILE_UPLOAD = {
  MAX_SIZE_MB: 5,
  CHUNK_SIZE: 1024 * 1024, // 1MB chunks
  ALLOWED_EXTENSIONS: {
    IMAGE: [".jpg", ".jpeg", ".png", ".gif", ".webp"],
    DOCUMENT: [".pdf", ".doc", ".docx", ".txt"],
    SPREADSHEET: [".xls", ".xlsx", ".csv"],
  },
} as const;

// ============================================================================
// Local Storage Keys
// ============================================================================

export const STORAGE_KEYS = {
  THEME: "theme",
  LANGUAGE: "language",
  SIDEBAR_STATE: "sidebar_state",
  USER_PREFERENCES: "user_preferences",
  RECENT_SEARCHES: "recent_searches",
} as const;

// ============================================================================
// Chart Colors
// ============================================================================

export const CHART_COLORS = {
  PRIMARY: "hsl(var(--primary))",
  SECONDARY: "hsl(var(--secondary))",
  SUCCESS: "hsl(var(--success))",
  WARNING: "hsl(var(--warning))",
  DANGER: "hsl(var(--destructive))",
  INFO: "hsl(var(--info))",
  MUTED: "hsl(var(--muted))",
} as const;

// ============================================================================
// Regex Patterns
// ============================================================================

export const REGEX_PATTERNS = {
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PHONE: /^[6-9]\d{9}$/,
  URL: /^https?:\/\/.+/,
  USERNAME: /^[a-zA-Z0-9_]{3,20}$/,
  SLUG: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
  HEX_COLOR: /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/,
  PAN: /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/,
  AADHAAR: /^\d{12}$/,
} as const;

// ============================================================================
// Time Constants
// ============================================================================

export const TIME = {
  SECOND: 1000,
  MINUTE: 60 * 1000,
  HOUR: 60 * 60 * 1000,
  DAY: 24 * 60 * 60 * 1000,
  WEEK: 7 * 24 * 60 * 60 * 1000,
} as const;

// ============================================================================
// Environment
// ============================================================================

export const ENV = {
  IS_DEVELOPMENT: process.env.NODE_ENV === "development",
  IS_PRODUCTION: process.env.NODE_ENV === "production",
  IS_TEST: process.env.NODE_ENV === "test",
} as const;
