export interface PasswordPolicyResult {
  isValid: boolean;
  length: boolean;
  hasUppercase: boolean;
  hasNumber: boolean;
  hasSpecial: boolean;
  errors: string[];
}

export const SPECIAL_CHARACTERS_REGEX = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/;

/**
 * Validates a password against Enterprise Password Policy Compliance:
 * 1. At least 10 characters in length
 * 2. At least one uppercase letter (A-Z)
 * 3. At least one number (0-9)
 * 4. At least one special character (!@#$%^&* etc.)
 */
export function validatePasswordPolicy(password: string): PasswordPolicyResult {
  const length = password.length >= 10;
  const hasUppercase = /[A-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = SPECIAL_CHARACTERS_REGEX.test(password);

  const errors: string[] = [];
  if (!length) errors.push('At least 10 characters in length');
  if (!hasUppercase) errors.push('At least one uppercase letter (A-Z)');
  if (!hasNumber) errors.push('At least one number (0-9)');
  if (!hasSpecial) errors.push('At least one special character (!@#$%^&* etc.)');

  const isValid = length && hasUppercase && hasNumber && hasSpecial;

  return {
    isValid,
    length,
    hasUppercase,
    hasNumber,
    hasSpecial,
    errors,
  };
}

/**
 * Generates an Enterprise-Compliant temporary or default password
 */
export function generateCompliantPassword(): string {
  const uppers = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lowers = 'abcdefghjkmnpqrstuvwxyz';
  const numbers = '23456789';
  const specials = '!@#$%^&*_-';

  let pass = 'TnK';
  // Pick uppercase
  pass += uppers.charAt(Math.floor(Math.random() * uppers.length));
  // Pick lowercase
  pass += lowers.charAt(Math.floor(Math.random() * lowers.length));
  pass += lowers.charAt(Math.floor(Math.random() * lowers.length));
  // Pick numbers
  pass += numbers.charAt(Math.floor(Math.random() * numbers.length));
  pass += numbers.charAt(Math.floor(Math.random() * numbers.length));
  // Pick special chars
  pass += specials.charAt(Math.floor(Math.random() * specials.length));
  pass += specials.charAt(Math.floor(Math.random() * specials.length));
  // Fill to 12 chars
  pass += uppers.charAt(Math.floor(Math.random() * uppers.length));
  pass += '2026';

  return pass;
}

/**
 * Generates a 6-digit numeric verification OTP code for password resets
 */
export function generateVerificationOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}
