import { IsOptional, IsString, IsBoolean, IsNumber } from 'class-validator';

export class UpdateSiteSettingsDto {
  // General Identity & Branding
  @IsOptional()
  @IsString()
  siteName?: string;

  @IsOptional()
  @IsString()
  tagline?: string;

  @IsOptional()
  @IsString()
  metaTitle?: string;

  @IsOptional()
  @IsString()
  metaDescription?: string;

  @IsOptional()
  @IsString()
  supportEmail?: string;

  @IsOptional()
  @IsString()
  contactEmail?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  tollFree?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsString()
  copyrightText?: string;

  @IsOptional()
  @IsString()
  logoLightUrl?: string;

  @IsOptional()
  @IsString()
  logoDarkUrl?: string;

  @IsOptional()
  @IsString()
  faviconUrl?: string;

  @IsOptional()
  @IsString()
  appIconUrl?: string;

  @IsOptional()
  @IsString()
  primaryColor?: string;

  @IsOptional()
  @IsString()
  secondaryColor?: string;

  @IsOptional()
  @IsString()
  darkThemeBg?: string;

  @IsOptional()
  @IsString()
  customCss?: string;

  // Payments & Ads
  @IsOptional()
  @IsString()
  razorpayKeyId?: string;

  @IsOptional()
  @IsString()
  razorpayKeySecret?: string;

  @IsOptional()
  @IsString()
  stripePublishableKey?: string;

  @IsOptional()
  @IsString()
  stripeSecretKey?: string;

  @IsOptional()
  @IsString()
  googleAdsId?: string;

  // AI Integration
  @IsOptional()
  @IsString()
  openRouterApiKey?: string;

  @IsOptional()
  @IsString()
  aiModel?: string;

  @IsOptional()
  @IsNumber()
  aiTemperature?: number;

  // Security, SEO & Disposable Email Protection
  @IsOptional()
  @IsBoolean()
  disposableEmailBlock?: boolean;

  @IsOptional()
  @IsString()
  disposableBlockLevel?: string;

  @IsOptional()
  @IsString()
  blockedDomains?: string;

  @IsOptional()
  @IsString()
  allowedDomains?: string;

  @IsOptional()
  @IsString()
  disposableApiKey?: string;

  @IsOptional()
  @IsString()
  disposableProvider?: string;

  @IsOptional()
  @IsString()
  disposableAction?: string;

  @IsOptional()
  @IsBoolean()
  enableRecaptcha?: boolean;

  @IsOptional()
  @IsString()
  recaptchaSiteKey?: string;

  // Amber HQ Leads API
  @IsOptional()
  @IsString()
  amberApiKey?: string;

  @IsOptional()
  @IsString()
  amberApiSecret?: string;

  @IsOptional()
  @IsString()
  amberWebhookUrl?: string;

  // Google & Social Discovery
  @IsOptional()
  @IsString()
  googleAnalyticsId?: string;

  @IsOptional()
  @IsString()
  googleTagManagerId?: string;

  @IsOptional()
  @IsString()
  facebookPixelId?: string;

  @IsOptional()
  @IsString()
  facebookUrl?: string;

  @IsOptional()
  @IsString()
  instagramUrl?: string;

  @IsOptional()
  @IsString()
  twitterUrl?: string;

  @IsOptional()
  @IsString()
  linkedinUrl?: string;

  @IsOptional()
  @IsString()
  youtubeUrl?: string;

  @IsOptional()
  @IsString()
  whatsappNumber?: string;

  @IsOptional()
  @IsString()
  telegramUrl?: string;

  @IsOptional()
  @IsString()
  posthogApiKey?: string;

  @IsOptional()
  @IsString()
  mixpanelToken?: string;

  @IsOptional()
  @IsString()
  hotjarSiteId?: string;

  @IsOptional()
  @IsString()
  customHeadScripts?: string;

  @IsOptional()
  @IsString()
  customBodyScripts?: string;

  @IsOptional()
  @IsString()
  webhookUrl?: string;

  // Email & AWS SES
  @IsOptional()
  @IsString()
  awsSesRegion?: string;

  @IsOptional()
  @IsString()
  awsSesAccessKey?: string;

  @IsOptional()
  @IsString()
  awsSesSecretKey?: string;

  @IsOptional()
  @IsString()
  awsSesSenderEmail?: string;

  @IsOptional()
  @IsString()
  smtpHost?: string;

  @IsOptional()
  @IsNumber()
  smtpPort?: number;

  @IsOptional()
  @IsString()
  smtpUser?: string;

  @IsOptional()
  @IsString()
  smtpPassword?: string;

  // Event Scraper
  @IsOptional()
  @IsString()
  eventScraperCron?: string;

  @IsOptional()
  @IsBoolean()
  eventScraperEnabled?: boolean;

  @IsOptional()
  @IsString()
  eventScraperSource?: string;

  // Mobile App Download Banner
  @IsOptional()
  @IsBoolean()
  enableAppBanner?: boolean;

  @IsOptional()
  @IsString()
  playStoreUrl?: string;

  @IsOptional()
  @IsString()
  appStoreUrl?: string;
}
