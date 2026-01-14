/**
 * Validation utilities
 * Provides common validation functions for forms and data
 */

/**
 * Validates an email address
 * @param email - Email to validate
 * @returns True if valid, false otherwise
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validates a phone number (Indian format)
 * @param phone - Phone number to validate
 * @returns True if valid, false otherwise
 */
export function isValidPhone(phone: string): boolean {
  const phoneRegex = /^[6-9]\d{9}$/;
  return phoneRegex.test(phone.replace(/[^0-9]/g, ""));
}

/**
 * Validates a URL
 * @param url - URL to validate
 * @returns True if valid, false otherwise
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validates a strong password
 * Requirements: min 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special char
 * @param password - Password to validate
 * @returns True if valid, false otherwise
 */
export function isValidPassword(password: string): boolean {
  const minLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

  return minLength && hasUppercase && hasLowercase && hasNumber && hasSpecialChar;
}

/**
 * Gets password strength
 * @param password - Password to check
 * @returns Strength level: weak, medium, strong
 */
export function getPasswordStrength(
  password: string
): "weak" | "medium" | "strong" {
  let strength = 0;

  if (password.length >= 8) strength++;
  if (password.length >= 12) strength++;
  if (/[a-z]/.test(password)) strength++;
  if (/[A-Z]/.test(password)) strength++;
  if (/\d/.test(password)) strength++;
  if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) strength++;

  if (strength <= 2) return "weak";
  if (strength <= 4) return "medium";
  return "strong";
}

/**
 * Validates a PAN card number (Indian)
 * @param pan - PAN number to validate
 * @returns True if valid, false otherwise
 */
export function isValidPAN(pan: string): boolean {
  const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
  return panRegex.test(pan.toUpperCase());
}

/**
 * Validates an Aadhaar number (Indian)
 * @param aadhaar - Aadhaar number to validate
 * @returns True if valid, false otherwise
 */
export function isValidAadhaar(aadhaar: string): boolean {
  const aadhaarRegex = /^\d{12}$/;
  return aadhaarRegex.test(aadhaar.replace(/\s/g, ""));
}

/**
 * Validates a credit card number using Luhn algorithm
 * @param cardNumber - Card number to validate
 * @returns True if valid, false otherwise
 */
export function isValidCreditCard(cardNumber: string): boolean {
  const sanitized = cardNumber.replace(/\s/g, "");
  if (!/^\d+$/.test(sanitized)) return false;

  let sum = 0;
  let isEven = false;

  for (let i = sanitized.length - 1; i >= 0; i--) {
    let digit = parseInt(sanitized[i], 10);

    if (isEven) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }

    sum += digit;
    isEven = !isEven;
  }

  return sum % 10 === 0;
}

/**
 * Validates a date is in the past
 * @param date - Date to validate
 * @returns True if in the past, false otherwise
 */
export function isPastDate(date: Date | string): boolean {
  const dateObj = typeof date === "string" ? new Date(date) : date;
  return dateObj < new Date();
}

/**
 * Validates a date is in the future
 * @param date - Date to validate
 * @returns True if in the future, false otherwise
 */
export function isFutureDate(date: Date | string): boolean {
  const dateObj = typeof date === "string" ? new Date(date) : date;
  return dateObj > new Date();
}

/**
 * Validates minimum age
 * @param birthDate - Birth date
 * @param minAge - Minimum age required
 * @returns True if meets minimum age, false otherwise
 */
export function meetsMinimumAge(birthDate: Date | string, minAge: number): boolean {
  const birth = typeof birthDate === "string" ? new Date(birthDate) : birthDate;
  const today = new Date();
  const age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    return age - 1 >= minAge;
  }

  return age >= minAge;
}

/**
 * Validates a string matches a pattern
 * @param value - Value to validate
 * @param pattern - Regex pattern
 * @returns True if matches, false otherwise
 */
export function matchesPattern(value: string, pattern: RegExp): boolean {
  return pattern.test(value);
}

/**
 * Validates string length
 * @param value - String to validate
 * @param min - Minimum length
 * @param max - Maximum length
 * @returns True if valid, false otherwise
 */
export function isValidLength(value: string, min: number, max?: number): boolean {
  if (value.length < min) return false;
  if (max && value.length > max) return false;
  return true;
}

/**
 * Validates a number is within range
 * @param value - Number to validate
 * @param min - Minimum value
 * @param max - Maximum value
 * @returns True if in range, false otherwise
 */
export function isInRange(value: number, min: number, max: number): boolean {
  return value >= min && value <= max;
}

/**
 * Validates a file size
 * @param file - File to validate
 * @param maxSizeMB - Maximum size in MB
 * @returns True if valid, false otherwise
 */
export function isValidFileSize(file: File, maxSizeMB: number): boolean {
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  return file.size <= maxSizeBytes;
}

/**
 * Validates a file type
 * @param file - File to validate
 * @param allowedTypes - Array of allowed MIME types
 * @returns True if valid, false otherwise
 */
export function isValidFileType(file: File, allowedTypes: string[]): boolean {
  return allowedTypes.includes(file.type);
}

/**
 * Sanitizes HTML to prevent XSS attacks
 * @param html - HTML string to sanitize
 * @returns Sanitized HTML string
 */
export function sanitizeHtml(html: string): string {
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#x27;",
    "/": "&#x2F;",
  };
  const reg = /[&<>"'/]/gi;
  return html.replace(reg, (match) => map[match]);
}

/**
 * Validates a JSON string
 * @param jsonString - JSON string to validate
 * @returns True if valid, false otherwise
 */
export function isValidJson(jsonString: string): boolean {
  try {
    JSON.parse(jsonString);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validates alphabetic characters only
 * @param value - String to validate
 * @returns True if alphabetic, false otherwise
 */
export function isAlphabetic(value: string): boolean {
  return /^[a-zA-Z]+$/.test(value);
}

/**
 * Validates alphanumeric characters only
 * @param value - String to validate
 * @returns True if alphanumeric, false otherwise
 */
export function isAlphanumeric(value: string): boolean {
  return /^[a-zA-Z0-9]+$/.test(value);
}

/**
 * Validates numeric characters only
 * @param value - String to validate
 * @returns True if numeric, false otherwise
 */
export function isNumeric(value: string): boolean {
  return /^[0-9]+$/.test(value);
}

/**
 * Validates a hex color code
 * @param color - Color code to validate
 * @returns True if valid, false otherwise
 */
export function isValidHexColor(color: string): boolean {
  return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color);
}

/**
 * Validates an IP address (v4)
 * @param ip - IP address to validate
 * @returns True if valid, false otherwise
 */
export function isValidIPv4(ip: string): boolean {
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (!ipv4Regex.test(ip)) return false;

  const parts = ip.split(".");
  return parts.every((part) => {
    const num = parseInt(part, 10);
    return num >= 0 && num <= 255;
  });
}

/**
 * Validates a username
 * @param username - Username to validate
 * @returns True if valid, false otherwise
 */
export function isValidUsername(username: string): boolean {
  // 3-20 characters, alphanumeric and underscores only
  return /^[a-zA-Z0-9_]{3,20}$/.test(username);
}

/**
 * Validates a slug (URL-friendly string)
 * @param slug - Slug to validate
 * @returns True if valid, false otherwise
 */
export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
}
