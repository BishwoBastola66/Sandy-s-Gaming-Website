import { z } from 'zod';

export const contactFormSchema = z.object({
  name: z
    .string()
    .trim()
    .max(100, 'Name must be 100 characters or fewer')
    .optional()
    .nullable()
    .transform((val) => (val && val.length > 0 ? val : null)),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('Please enter a valid email address')
    .max(254, 'Email must be 254 characters or fewer'),
  phone: z
    .string()
    .trim()
    .min(7, 'Phone number must be at least 7 characters')
    .max(25, 'Phone number must be 25 characters or fewer')
    .regex(/^\+?[0-9\s\-()]+$/, 'Please enter a valid phone number with country code (e.g. +1 555 123 4567)'),
  message: z
    .string()
    .trim()
    .min(10, 'Message must be at least 10 characters long')
    .max(5000, 'Message must be 5000 characters or fewer'),
  honeypot: z.string().max(0, 'Spam bot detected').optional().default(''),
});

export type ContactFormData = z.infer<typeof contactFormSchema>;
