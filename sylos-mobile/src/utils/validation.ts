// Input validation and sanitization utilities
import { z } from 'zod';

// Common validation schemas
export const emailSchema = z.string().email('Invalid email format');

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password too long')
  .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain at least one uppercase letter, one lowercase letter, and one number');

export const walletNameSchema = z
  .string()
  .min(1, 'Wallet name is required')
  .max(50, 'Wallet name too long')
  .regex(/^[a-zA-Z0-9\s\-_]+$/, 'Wallet name can only contain letters, numbers, spaces, hyphens, and underscores');

export const mnemonicSchema = z
  .string()
  .min(1, 'Mnemonic is required')
  .refine(
    (value) => {
      const words = value.trim().split(/\s+/);
      return words.length >= 12 && words.length <= 24;
    },
    { message: 'Mnemonic must have between 12 and 24 words' }
  );

export const addressSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address format');

export const amountSchema = z
  .string()
  .refine(
    (value) => {
      const num = parseFloat(value);
      return !isNaN(num) && num > 0;
    },
    { message: 'Amount must be a positive number' }
  );

export const transactionDataSchema = z
  .string()
  .max(100000, 'Transaction data too large')
  .refine(
    (value) => {
      // Check if it's valid hex
      return /^0x[0-9a-fA-F]*$/.test(value) || value === '';
    },
    { message: 'Transaction data must be valid hexadecimal' }
  );

// Input sanitization functions
export const sanitizeInput = (input: string, maxLength: number = 100): string => {
  if (typeof input !== 'string') {
    return '';
  }
  
  return input
    .trim()
    .replace(/[<>\"'&]/g, '') // Remove potentially dangerous characters
    .slice(0, maxLength);
};

export const sanitizeAddress = (address: string): string => {
  return sanitizeInput(address, 42);
};

export const sanitizeMnemonic = (mnemonic: string): string => {
  return sanitizeInput(mnemonic.toLowerCase(), 500);
};

export const sanitizePassword = (password: string): string => {
  // Don't actually sanitize password content, just trim and limit length
  return password.trim().slice(0, 128);
};

export const sanitizeAmount = (amount: string): string => {
  // Allow only numbers, decimal points, and remove other characters
  return amount.replace(/[^0-9.]/g, '').slice(0, 20);
};

// Validation functions
export const validateInput = <T>(schema: z.ZodSchema<T>, data: unknown): { success: true; data: T } | { success: false; errors: string[] } => {
  try {
    const validatedData = schema.parse(data);
    return { success: true, data: validatedData };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = error.errors.map(err => `${err.path.join('.')}: ${err.message}`);
      return { success: false, errors };
    }
    return { success: false, errors: ['Validation failed'] };
  }
};

// Sanitize and validate in one step
export const sanitizeAndValidate = <T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  sanitizer?: (value: string) => string
): { success: true; data: T } | { success: false; errors: string[] } => {
  // Apply sanitization if sanitizer is provided
  let sanitizedData = data;
  if (typeof data === 'string' && sanitizer) {
    sanitizedData = sanitizer(data);
  }

  return validateInput(schema, sanitizedData);
};

// Phone number validation (for future use)
export const phoneNumberSchema = z
  .string()
  .regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number format');

// URL validation (for API endpoints)
export const urlSchema = z
  .string()
  .url('Invalid URL format')
  .refine(
    (url) => {
      const allowedProtocols = ['https:', 'http:'];
      try {
        const parsedUrl = new URL(url);
        return allowedProtocols.includes(parsedUrl.protocol);
      } catch {
        return false;
      }
    },
    { message: 'Only HTTP and HTTPS protocols are allowed' }
  );

// File name validation
export const fileNameSchema = z
  .string()
  .min(1, 'File name is required')
  .max(255, 'File name too long')
  .regex(/^[a-zA-Z0-9._-]+$/, 'File name can only contain letters, numbers, dots, hyphens, and underscores');

// Integer validation with bounds
export const boundedIntegerSchema = (min: number, max: number) =>
  z.number().int().min(min).max(max);

// Array validation
export const arraySchema = <T>(itemSchema: z.ZodSchema<T>, minLength: number = 0, maxLength: number = 100) =>
  z.array(itemSchema).min(minLength).max(maxLength);

// UUID validation
export const uuidSchema = z
  .string()
  .uuid('Invalid UUID format');

// Export commonly used validation functions
export const validators = {
  email: (email: string) => validateInput(emailSchema, email),
  password: (password: string) => validateInput(passwordSchema, sanitizePassword(password)),
  walletName: (name: string) => validateInput(walletNameSchema, sanitizeInput(name, 50)),
  mnemonic: (mnemonic: string) => validateInput(mnemonicSchema, sanitizeMnemonic(mnemonic)),
  address: (address: string) => validateInput(addressSchema, sanitizeAddress(address)),
  amount: (amount: string) => validateInput(amountSchema, sanitizeAmount(amount)),
  phone: (phone: string) => validateInput(phoneNumberSchema, sanitizeInput(phone, 20)),
  url: (url: string) => validateInput(urlSchema, sanitizeInput(url, 2048)),
  fileName: (fileName: string) => validateInput(fileNameSchema, sanitizeInput(fileName, 255)),
};