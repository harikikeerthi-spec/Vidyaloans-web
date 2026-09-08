import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateSiteSettingsDto } from './dto/update-site-settings.dto';
import { DISPOSABLE_DOMAINS } from './disposable-domains';
import * as fs from 'fs';
import * as path from 'path';

const DISPOSABLE_DOMAINS_SET = new Set(
  DISPOSABLE_DOMAINS.map((d: string) => d.toLowerCase().trim()),
);

const DEFAULT_SETTINGS = {
  id: 'default',
  // General Identity
  siteName: 'VidyaLoans',
  tagline: 'Overseas Education Financing & Study Abroad Loan Portal',
  metaTitle: 'VidyaLoans - Instant Education Loans for Overseas Studies',
  metaDescription: 'Compare and apply for top education loans with lowest interest rates, quick approval, and zero hidden charges.',
  supportEmail: 'support@vidyaloans.com',
  contactEmail: 'contact@vidyaloans.com',
  phone: '+91 1800-123-4567',
  tollFree: '1800-123-4567',
  address: 'VidyaLoans Financial Tower, Sector 44, Gurgaon, Haryana 122003, India',
  currency: 'INR',
  timezone: 'Asia/Kolkata',
  copyrightText: '© 2026 VidyaLoans Inc. All rights reserved.',

  // Social Media Links
  facebookUrl: 'https://facebook.com/vidyaloans',
  instagramUrl: 'https://instagram.com/vidyaloans',
  twitterUrl: 'https://x.com/vidyaloans',
  linkedinUrl: 'https://linkedin.com/company/vidyaloans',
  youtubeUrl: 'https://youtube.com/@vidyaloans',
  whatsappNumber: '+919876543210',
  telegramUrl: 'https://t.me/vidyaloans',

  // Branding Assets
  logoLightUrl: '/images/vidyaloans-logo-transparent.png',
  logoDarkUrl: '/images/vidyaloans-logo-transparent.png',
  faviconUrl: '/favicon.ico',
  appIconUrl: '/images/icon.png',
  primaryColor: '#6605c7',
  secondaryColor: '#4f46e5',
  darkThemeBg: '#0f172a',
  customCss: '/* Custom site overrides */\n:root {\n  --brand-primary: #6605c7;\n}',

  // Integrations & Analytics
  googleAnalyticsId: 'G-1Z8RYR9RBW',
  googleTagManagerId: 'GTM-PSHKZ8FK',
  facebookPixelId: '987654321098765',
  posthogApiKey: 'phc_vidyaloans_live_key_998877',
  mixpanelToken: 'mp_token_vidyaloans_production',
  hotjarSiteId: '3456789',
  customHeadScripts: '<!-- Google Tag Manager -->\n<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({\'gtm.start\':new Date().getTime(),event:\'gtm.js\'});})(window,document,\'script\',\'dataLayer\',\'GTM-PSHKZ8FK\');</script>\n<!-- Google tag (gtag.js) -->\n<script async src="https://www.googletagmanager.com/gtag/js?id=G-1Z8RYR9RBW"></script>\n<script>\n  window.dataLayer = window.dataLayer || [];\n  function gtag(){dataLayer.push(arguments);}\n  gtag(\'js\', new Date());\n\n  gtag(\'config\', \'G-1Z8RYR9RBW\');\n</script>',
  customBodyScripts: '<!-- Google Tag Manager (noscript) -->\n<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-PSHKZ8FK" height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>',
  webhookUrl: 'https://api.vidyaloans.com/v1/webhooks/events',

  // AI Service Settings
  openRouterApiKey: process.env.OPENROUTER_API_KEY || '',
  aiModel: 'google/gemini-2.0-flash-001',
  aiTemperature: 0.7,

  // Disposable Email Protection
  disposableEmailBlock: true,
  disposableBlockLevel: 'strict', // strict, warning, audit_only
  blockedDomains: DISPOSABLE_DOMAINS.join(', '),
  allowedDomains: 'gmail.com, yahoo.com, outlook.com, hotmail.com, icloud.com, proton.me, protonmail.com, vidyaloans.com',
  disposableApiKey: '',
  disposableProvider: 'builtin', // builtin, kickbox, zerobounce, debounce, hunter
  disposableAction: 'reject', // reject, otp_verify, flag_review

  // Email & AWS SES
  awsSesRegion: process.env.AWS_REGION || 'ap-south-1',
  awsSesAccessKey: process.env.SMTP_USER || process.env.AWS_ACCESS_KEY_ID || '',
  awsSesSecretKey: process.env.SMTP_PASS || process.env.AWS_SECRET_ACCESS_KEY || '',
  awsSesSenderEmail: process.env.EMAIL_FROM_ADDRESS || 'support@vidyaloans.in',
  smtpHost: process.env.SMTP_HOST || 'email-smtp.ap-south-1.amazonaws.com',
  smtpPort: Number(process.env.SMTP_PORT) || 587,
  smtpUser: process.env.SMTP_USER || '',
  smtpPassword: process.env.SMTP_PASS || '',

  // Mobile App Download Banner
  enableAppBanner: true,
  playStoreUrl: 'https://play.google.com/store/apps/details?id=in.vidyaloans.app&hl=en-US&ah=Vx9t8taW0pweH2uHyGVMktR2FLs',
  appStoreUrl: '',
};

const PRISMA_SITE_SETTING_FIELDS = new Set([
  'siteName',
  'tagline',
  'metaTitle',
  'metaDescription',
  'supportEmail',
  'contactEmail',
  'phone',
  'tollFree',
  'address',
  'currency',
  'timezone',
  'copyrightText',
  'facebookUrl',
  'instagramUrl',
  'twitterUrl',
  'linkedinUrl',
  'youtubeUrl',
  'whatsappNumber',
  'telegramUrl',
  'logoLightUrl',
  'logoDarkUrl',
  'faviconUrl',
  'appIconUrl',
  'primaryColor',
  'secondaryColor',
  'darkThemeBg',
  'customCss',
  'googleAnalyticsId',
  'googleTagManagerId',
  'facebookPixelId',
  'posthogApiKey',
  'mixpanelToken',
  'hotjarSiteId',
  'customHeadScripts',
  'customBodyScripts',
  'webhookUrl',
  'openRouterApiKey',
  'aiModel',
  'aiTemperature',
  'disposableEmailBlock',
  'disposableBlockLevel',
  'blockedDomains',
  'allowedDomains',
  'disposableApiKey',
  'disposableProvider',
  'disposableAction',
]);

function filterPrismaSiteSettingFields(data: any): Record<string, any> {
  if (!data || typeof data !== 'object') return {};
  const filtered: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    if (PRISMA_SITE_SETTING_FIELDS.has(key)) {
      filtered[key] = value;
    }
  }
  return filtered;
}

const PERSISTENT_SETTINGS_PATH = path.join(process.cwd(), 'scratch', 'site_settings.json');

// In-memory fallback
let memorySettingsStore: any = { ...DEFAULT_SETTINGS };

// Try loading persisted file on startup
try {
  if (fs.existsSync(PERSISTENT_SETTINGS_PATH)) {
    const raw = fs.readFileSync(PERSISTENT_SETTINGS_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    memorySettingsStore = { ...DEFAULT_SETTINGS, ...parsed };
  }
} catch (e) {
  // ignore
}

@Injectable()
export class SiteSettingsService {
  private readonly logger = new Logger(SiteSettingsService.name);

  constructor(private readonly prisma: PrismaService) { }

  private persistToFile(settings: any) {
    try {
      const dir = path.dirname(PERSISTENT_SETTINGS_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(PERSISTENT_SETTINGS_PATH, JSON.stringify(settings, null, 2), 'utf8');
    } catch (e) {
      this.logger.warn(`Failed to persist site settings to file: ${e.message}`);
    }
  }

  async getSettings() {
    try {
      if ((this.prisma as any).siteSetting) {
        const settings = await (this.prisma as any).siteSetting.findUnique({
          where: { id: 'default' },
        });

        if (settings) {
          memorySettingsStore = {
            ...DEFAULT_SETTINGS,
            ...settings,
            openRouterApiKey: settings.openRouterApiKey || process.env.OPENROUTER_API_KEY || '',
            awsSesRegion: settings.awsSesRegion || process.env.AWS_REGION || 'ap-south-1',
            awsSesSenderEmail: settings.awsSesSenderEmail || process.env.EMAIL_FROM_ADDRESS || 'support@vidyaloans.in',
            awsSesAccessKey: settings.awsSesAccessKey || process.env.SMTP_USER || process.env.AWS_ACCESS_KEY_ID || '',
            awsSesSecretKey: settings.awsSesSecretKey || process.env.SMTP_PASS || process.env.AWS_SECRET_ACCESS_KEY || '',
            smtpHost: settings.smtpHost || process.env.SMTP_HOST || 'email-smtp.ap-south-1.amazonaws.com',
            smtpPort: Number(settings.smtpPort) || Number(process.env.SMTP_PORT) || 587,
            smtpUser: settings.smtpUser || process.env.SMTP_USER || '',
            smtpPassword: settings.smtpPassword || process.env.SMTP_PASS || '',
          };
          this.persistToFile(memorySettingsStore);
          return memorySettingsStore;
        }

        // If not found in DB, seed default entry
        const created = await (this.prisma as any).siteSetting.create({
          data: {
            id: 'default',
            ...filterPrismaSiteSettingFields(DEFAULT_SETTINGS),
          },
        });
        memorySettingsStore = { ...DEFAULT_SETTINGS, ...created };
        this.persistToFile(memorySettingsStore);
        return memorySettingsStore;
      }
    } catch (e) {
      this.logger.warn(`Database query for siteSetting failed, using fallback: ${e.message}`);
    }

    return memorySettingsStore;
  }

  async getPublicSettings() {
    const settings = await this.getSettings();
    // Strip confidential server secrets from public API responses
    const {
      razorpayKeySecret,
      stripeSecretKey,
      openRouterApiKey,
      groqApiKey,
      awsSesSecretKey,
      awsSesAccessKey,
      smtpPassword,
      amberApiKey,
      amberApiSecret,
      ...publicSettings
    } = settings;

    return publicSettings;
  }

  async updateSettings(dto: UpdateSiteSettingsDto) {
    try {
      if ((this.prisma as any).siteSetting) {
        const dbUpdateData = filterPrismaSiteSettingFields(dto);
        const dbCreateData = {
          id: 'default',
          ...filterPrismaSiteSettingFields(DEFAULT_SETTINGS),
          ...dbUpdateData,
        };

        const updated = await (this.prisma as any).siteSetting.upsert({
          where: { id: 'default' },
          update: dbUpdateData,
          create: dbCreateData,
        });
        memorySettingsStore = {
          ...memorySettingsStore,
          ...dto,
          ...updated,
          updatedAt: new Date(),
        };
        this.persistToFile(memorySettingsStore);
        return memorySettingsStore;
      }
    } catch (e) {
      this.logger.warn(`Database update for siteSetting failed, falling back to memory/file store: ${e.message}`);
    }

    memorySettingsStore = {
      ...memorySettingsStore,
      ...dto,
      updatedAt: new Date(),
    };
    this.persistToFile(memorySettingsStore);

    return memorySettingsStore;
  }

  async resetDefaults() {
    try {
      if ((this.prisma as any).siteSetting) {
        const dbData = {
          id: 'default',
          ...filterPrismaSiteSettingFields(DEFAULT_SETTINGS),
        };

        const reset = await (this.prisma as any).siteSetting.upsert({
          where: { id: 'default' },
          update: filterPrismaSiteSettingFields(DEFAULT_SETTINGS),
          create: dbData,
        });
        memorySettingsStore = {
          ...DEFAULT_SETTINGS,
          ...reset,
          updatedAt: new Date(),
        };
        this.persistToFile(memorySettingsStore);
        return memorySettingsStore;
      }
    } catch (e) {
      this.logger.warn(`Database reset failed, resetting memory store: ${e.message}`);
    }

    memorySettingsStore = { ...DEFAULT_SETTINGS, updatedAt: new Date() };
    this.persistToFile(memorySettingsStore);
    return memorySettingsStore;
  }

  /**
   * Dynamically check whether an email address is blocked or disposable based on the
   * current settings stored in the database / admin configuration.
   */
  async checkDisposableEmail(email: string): Promise<{
    email: string;
    domain: string;
    isDisposable: boolean;
    blocked: boolean;
    whitelisted: boolean;
    protectionEnabled: boolean;
    blockLevel: string;
    action: string;
    reason: string;
  }> {
    const settings = await this.getSettings();
    const cleanEmail = (email || '').trim().toLowerCase();

    if (!cleanEmail || !cleanEmail.includes('@')) {
      return {
        email: cleanEmail,
        domain: '',
        isDisposable: false,
        blocked: true,
        whitelisted: false,
        protectionEnabled: !!settings.disposableEmailBlock,
        blockLevel: settings.disposableBlockLevel || 'strict',
        action: 'reject',
        reason: 'Please enter a valid email address with @ symbol',
      };
    }

    const emailParts = cleanEmail.split('@');
    const username = emailParts[0];
    const domain = emailParts[1].toLowerCase().trim();

    const parseList = (str: string | undefined | null): string[] => {
      if (!str) return [];
      return str
        .split(/[\n,;\s]+/)
        .map((d: string) => d.trim().toLowerCase())
        .filter(Boolean);
    };

    const allowedList = parseList(settings.allowedDomains);
    const blockedList = parseList(settings.blockedDomains);

    // 1. Check explicit whitelist first (whitelist always overrides any block)
    const isWhitelisted = allowedList.some((item: string) => {
      const normalized = item.replace(/^[@*.]+/g, '').trim();
      return (
        cleanEmail === item ||
        domain === normalized ||
        domain.endsWith('.' + normalized)
      );
    });

    if (isWhitelisted) {
      return {
        email: cleanEmail,
        domain,
        isDisposable: false,
        blocked: false,
        whitelisted: true,
        protectionEnabled: !!settings.disposableEmailBlock,
        blockLevel: settings.disposableBlockLevel || 'strict',
        action: 'allow',
        reason: 'Email domain is explicitly whitelisted in security settings',
      };
    }

    // If master shield is disabled by admin in Site Settings, allow the email
    if (!settings.disposableEmailBlock) {
      return {
        email: cleanEmail,
        domain,
        isDisposable: false,
        blocked: false,
        whitelisted: false,
        protectionEnabled: false,
        blockLevel: settings.disposableBlockLevel || 'strict',
        action: 'allow',
        reason: 'Disposable email shield protection is disabled in site settings',
      };
    }

    // 2. Check dynamic blocked list configured by admin (supports exact emails, domains, subdomains, wildcards)
    const isDynamicBlocked = blockedList.some((item: string) => {
      const normalized = item.replace(/^[@*.]+/g, '').trim();
      return (
        cleanEmail === item ||
        domain === normalized ||
        domain.endsWith('.' + normalized)
      );
    });

    // 3. Check built-in disposable domain dataset and disposable patterns
    const isBuiltinDisposable =
      DISPOSABLE_DOMAINS_SET.has(domain) ||
      domain.includes('tempmail') ||
      domain.includes('temp-mail') ||
      domain.includes('disposable') ||
      domain.includes('throwaway') ||
      domain.includes('10minutemail') ||
      domain.includes('fakeinbox') ||
      domain.includes('yopmail') ||
      domain.includes('mailinator') ||
      domain.includes('guerrillamail') ||
      domain.includes('sharklasers') ||
      domain.includes('dispostable') ||
      domain.includes('getnada') ||
      domain.includes('trashmail') ||
      domain.includes('burnermail') ||
      domain.includes('maildrop');

    const isBlocked = isDynamicBlocked || isBuiltinDisposable;

    if (isBlocked) {
      const isStrict = (settings.disposableBlockLevel || 'strict') === 'strict';
      return {
        email: cleanEmail,
        domain,
        isDisposable: true,
        blocked: isStrict,
        whitelisted: false,
        protectionEnabled: true,
        blockLevel: settings.disposableBlockLevel || 'strict',
        action: isStrict ? (settings.disposableAction || 'reject') : 'warning',
        reason: isDynamicBlocked
          ? `The email or domain '@${domain}' has been blocked by administrator policy. Temporary/disposable email addresses are not permitted.`
          : `The domain '@${domain}' is a temporary/disposable email provider. Please use your official personal email (e.g. Gmail, Yahoo, Outlook).`,
      };
    }

    return {
      email: cleanEmail,
      domain,
      isDisposable: false,
      blocked: false,
      whitelisted: false,
      protectionEnabled: true,
      blockLevel: settings.disposableBlockLevel || 'strict',
      action: 'allow',
      reason: 'Email domain passed all security and disposable validation checks',
    };
  }
}
