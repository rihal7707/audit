import { z } from 'zod';
import {
  BUSINESS_SIZE_OPTIONS,
  CHALLENGE_OPTIONS,
  GOAL_OPTIONS,
  INDUSTRY_VALUES,
  TIMEFRAME_OPTIONS,
  VOLUME_RANGE_OPTIONS,
} from '@/lib/config/industries';
import { COUNTRIES } from '@/lib/config/countries';
import { normalizeUserWebsiteInput } from './url-normalize';
import { detectSensitiveFreeText } from '@/lib/security/pii-scrub';

export const CONSENT_VERSION = '2026-11-v1';

const validCountryCodesOrNames = new Set<string>(
  COUNTRIES.flatMap((c) => [c.code.toLowerCase(), c.name.toLowerCase()]),
);

export const AuditSubmissionSchema = z.object({
  // Step 1
  website: z
    .string()
    .trim()
    .min(3, 'Please enter your business website URL.')
    .max(300, 'Website URL is too long.')
    .transform((v) => normalizeUserWebsiteInput(v))
    .refine((v) => {
      try {
        const u = new URL(v);
        return (
          (u.protocol === 'http:' || u.protocol === 'https:') &&
          u.hostname.includes('.')
        );
      } catch {
        return false;
      }
    }, 'Please enter a valid domain or website URL (for example, example.com).'),
  businessName: z
    .string()
    .trim()
    .min(2, 'Please enter your business name.')
    .max(120, 'Business name must be 120 characters or fewer.'),
  industry: z.enum(INDUSTRY_VALUES, {
    message: 'Please select an industry.',
  }),
  country: z
    .string()
    .trim()
    .min(2, 'Please select your country.')
    .max(80)
    .refine(
      (v) => validCountryCodesOrNames.has(v.toLowerCase()),
      'Please select a valid country from the list.',
    ),
  location: z.string().trim().max(120).optional().or(z.literal('')),
  businessSize: z
    .enum(BUSINESS_SIZE_OPTIONS)
    .optional()
    .or(z.literal('')),

  // Step 2
  businessDescription: z
    .string()
    .trim()
    .min(15, 'Please briefly describe what your business offers (at least 15 characters).')
    .max(1500, 'Description must be 1,500 characters or fewer.')
    .refine(
      (v) => !detectSensitiveFreeText(v).hasSensitiveData,
      'Please remove personal emails, phone numbers, or card/ID numbers from the business description.',
    ),
  challenges: z
    .array(z.enum(CHALLENGE_OPTIONS))
    .min(1, 'Please select at least one operational challenge.')
    .max(12),
  toolsUsed: z
    .string()
    .trim()
    .max(500, 'Tools description must be 500 characters or fewer.')
    .optional()
    .or(z.literal(''))
    .refine(
      (v) => !v || !detectSensitiveFreeText(v).hasSensitiveData,
      'Please remove personal emails, phone numbers, or credentials from the tools field.',
    ),

  // Step 3
  goals: z
    .array(z.enum(GOAL_OPTIONS))
    .min(1, 'Please select at least one improvement goal.')
    .max(8),
  enquiryVolume: z.enum(VOLUME_RANGE_OPTIONS).optional().or(z.literal('')),
  phoneVolume: z.enum(VOLUME_RANGE_OPTIONS).optional().or(z.literal('')),
  teamSize: z.string().trim().max(60).optional().or(z.literal('')),
  manualProcesses: z
    .string()
    .trim()
    .max(1200, 'Manual processes text must be 1,200 characters or fewer.')
    .optional()
    .or(z.literal(''))
    .refine(
      (v) => !v || !detectSensitiveFreeText(v).hasSensitiveData,
      'Please remove personal emails, phone numbers, or card/ID numbers from manual processes.',
    ),
  timeframe: z.enum(TIMEFRAME_OPTIONS).optional().or(z.literal('')),

  // Step 4
  contactName: z
    .string()
    .trim()
    .min(2, 'Please enter your full name.')
    .max(100),
  contactEmail: z
    .string()
    .trim()
    .email('Please enter a valid business email address.')
    .max(160),
  contactPhone: z
    .string()
    .trim()
    .max(40, 'Phone number is too long.')
    .optional()
    .or(z.literal('')),
  contactRole: z.string().trim().max(80).optional().or(z.literal('')),
  consent: z.literal(true, {
    message: 'Audit consent is required to prepare and share your report.',
  }),
  processingNoticeAck: z.literal(true, {
    message: 'Please acknowledge how your website and business details are processed.',
  }),
  marketingConsent: z.boolean().default(false),

  // Abuse protection fields
  websiteConfirmHp: z.string().max(100).optional().default(''),
  formStartedAt: z.number().int().positive(),
  turnstileToken: z.string().optional(),
  allowCrossDomainRedirect: z.boolean().optional().default(true),
});

export type AuditSubmissionInput = z.infer<typeof AuditSubmissionSchema>;

export const AUDIT_REQUIRED_CONSENT_TEXT =
  'I agree that Amarketing may use the business information I provide to prepare my free AI Business Audit and contact me regarding its findings.';

export const AUDIT_PROCESSING_NOTICE_TEXT =
  "Your website's public content and the business details you provide (not your contact details) are processed by Google's Gemini AI service to prepare your audit.";

export const AUDIT_SENSITIVE_DATA_WARNING =
  'Please do not submit patient information, medical records, passwords, financial account information or other confidential personal data.';
