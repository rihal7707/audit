export interface BrandConfig {
  name: string;
  legalEntityName: string;
  wordmark: string;
  tagline: string;
  productTitle: string;
  contactEmail: string;
  bookingUrl: string;
  appUrl: string;
  crawlerUserAgentName: string;
  colors: {
    navy950: string;
    navy900: string;
    navy800: string;
    emerald500: string;
    emerald400: string;
    teal700: string;
  };
  displayFontName: string;
}

export const brandConfig: BrandConfig = {
  name: 'AMARKETING',
  legalEntityName: 'Amarketing Advertising',
  wordmark: 'AMARKETING',
  tagline: 'Free AI Business Audit by Amarketing Advertising',
  productTitle: 'AMARKETING – Free AI Business Audit',
  contactEmail: process.env.BUSINESS_CONTACT_EMAIL || 'hello@amarketing.example',
  bookingUrl: process.env.NEXT_PUBLIC_BOOKING_URL || '',
  appUrl: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  crawlerUserAgentName: 'AmarketingAuditBot/1.0',
  colors: {
    navy950: '#070F1E',
    navy900: '#0B1730',
    navy800: '#12233F',
    emerald500: '#10B981',
    emerald400: '#34D399',
    teal700: '#0F766E',
  },
  displayFontName: 'Fraunces',
};

export function getCrawlerUserAgent(): string {
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || brandConfig.appUrl).replace(/\/+$/, '');
  return `${brandConfig.crawlerUserAgentName} (+${baseUrl}/how-we-inspect)`;
}

