export class UpdateSiteSettingsDto {
  // General Identity & Branding
  siteName?: string;
  tagline?: string;
  metaTitle?: string;
  metaDescription?: string;
  supportEmail?: string;
  contactEmail?: string;
  phone?: string;
  tollFree?: string;
  address?: string;
  currency?: string;
  timezone?: string;
  copyrightText?: string;
  logoLightUrl?: string;
  logoDarkUrl?: string;
  faviconUrl?: string;
  appIconUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
  darkThemeBg?: string;
  customCss?: string;

  // Payments & Ads
  razorpayKeyId?: string;
  razorpayKeySecret?: string;
  stripePublishableKey?: string;
  stripeSecretKey?: string;
  googleAdsId?: string;

  // AI Integration
  openRouterApiKey?: string;
  aiModel?: string;
  aiTemperature?: number;

  // Security, SEO & Disposable Email Protection
  disposableEmailBlock?: boolean;
  disposableBlockLevel?: string;
  blockedDomains?: string;
  allowedDomains?: string;
  disposableApiKey?: string;
  disposableProvider?: string;
  disposableAction?: string;
  enableRecaptcha?: boolean;
  recaptchaSiteKey?: string;

  // Amber HQ Leads API
  amberApiKey?: string;
  amberApiSecret?: string;
  amberWebhookUrl?: string;

  // Google & Social Discovery
  googleAnalyticsId?: string;
  googleTagManagerId?: string;
  facebookPixelId?: string;
  facebookUrl?: string;
  instagramUrl?: string;
  twitterUrl?: string;
  linkedinUrl?: string;
  youtubeUrl?: string;
  whatsappNumber?: string;
  telegramUrl?: string;
  posthogApiKey?: string;
  mixpanelToken?: string;
  hotjarSiteId?: string;
  customHeadScripts?: string;
  customBodyScripts?: string;
  webhookUrl?: string;

  // Email & AWS SES
  awsSesRegion?: string;
  awsSesAccessKey?: string;
  awsSesSecretKey?: string;
  awsSesSenderEmail?: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPassword?: string;

  // Event Scraper
  eventScraperCron?: string;
  eventScraperEnabled?: boolean;
  eventScraperSource?: string;

  // Mobile App Download Banner
  enableAppBanner?: boolean;
  playStoreUrl?: string;
  appStoreUrl?: string;
}

