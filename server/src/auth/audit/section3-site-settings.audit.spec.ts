import { SiteSettingsService, cleanPlaceholderSettings } from '../../site-settings/site-settings.service';

describe('Section 3: Site Settings Placeholder & Hydration Audit', () => {
  let service: SiteSettingsService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      siteSetting: {
        findUnique: jest.fn(),
        create: jest.fn(),
        upsert: jest.fn(),
      },
      withRetry: jest.fn((cb) => cb()),
    };
    service = new SiteSettingsService(mockPrisma as any);
  });

  describe('cleanPlaceholderSettings', () => {
    it('should replace legacy placeholder phone, email, whatsapp, address, social URLs, and webhook', () => {
      const dummySettings = {
        phone: '+91 1800-123-4567',
        tollFree: '1800-123-4567',
        supportEmail: 'support@vidyaloans.com',
        contactEmail: 'contact@vidyaloans.com',
        whatsappNumber: '+919876543210',
        address: 'VidyaLoans Financial Tower, Sector 44, Gurgaon, Haryana 122003, India',
        instagramUrl: 'https://instagram.com/vidyaloans',
        twitterUrl: 'https://x.com/vidyaloans',
        webhookUrl: 'https://api.vidyaloans.com/v1/webhooks/events',
        posthogApiKey: 'phc_vidyaloans_live_key_998877',
        mixpanelToken: 'mp_token_vidyaloans_production',
        hotjarSiteId: '3456789',
        enableAppBanner: true,
      };

      const cleaned = cleanPlaceholderSettings(dummySettings);

      expect(cleaned.phone).toBe('+91 81437 97779');
      expect(cleaned.tollFree).toBe('+91 81437 97779');
      expect(cleaned.supportEmail).toBe('support@vidyaloans.in');
      expect(cleaned.contactEmail).toBe('contact@vidyaloans.in');
      expect(cleaned.whatsappNumber).toBe('+918143797779');
      expect(cleaned.address).toBe('Jyothi Bose Complex, Bus Stand Road (Opposite to Municipal Office), Nuzvid, Krishna District, Andhra Pradesh 521201, India');
      expect(cleaned.instagramUrl).toBe('https://www.instagram.com/vidya_loans/');
      expect(cleaned.twitterUrl).toBe('https://x.com/VidyaLoans07');
      expect(cleaned.webhookUrl).toBe('https://api.vidyaloans.in/v1/webhooks/events');
      expect(cleaned.posthogApiKey).toBe('');
      expect(cleaned.mixpanelToken).toBe('');
      expect(cleaned.hotjarSiteId).toBe('');
      expect(cleaned.enableAppBanner).toBe(false);
    });

    it('should replace empty or missing contact values with correct production defaults', () => {
      const emptySettings = {
        phone: '',
        supportEmail: '',
        contactEmail: '',
        whatsappNumber: '',
        address: '',
      };

      const cleaned = cleanPlaceholderSettings(emptySettings);

      expect(cleaned.phone).toBe('+91 81437 97779');
      expect(cleaned.supportEmail).toBe('support@vidyaloans.in');
      expect(cleaned.contactEmail).toBe('contact@vidyaloans.in');
      expect(cleaned.whatsappNumber).toBe('+918143797779');
      expect(cleaned.address).toBe('Jyothi Bose Complex, Bus Stand Road (Opposite to Municipal Office), Nuzvid, Krishna District, Andhra Pradesh 521201, India');
    });
  });

  describe('SiteSettingsService.getPublicSettings', () => {
    it('should return valid company contact details and disabled app banner', async () => {
      mockPrisma.siteSetting.findUnique.mockResolvedValue(null);
      mockPrisma.siteSetting.create.mockImplementation(({ data }: any) => Promise.resolve(data));

      const publicSettings = await service.getPublicSettings();

      expect(publicSettings.phone).toBe('+91 81437 97779');
      expect(publicSettings.supportEmail).toBe('support@vidyaloans.in');
      expect(publicSettings.contactEmail).toBe('contact@vidyaloans.in');
      expect(publicSettings.whatsappNumber).toBe('+918143797779');
      expect(publicSettings.address).toBe('Jyothi Bose Complex, Bus Stand Road (Opposite to Municipal Office), Nuzvid, Krishna District, Andhra Pradesh 521201, India');
      expect(publicSettings.instagramUrl).toBe('https://www.instagram.com/vidya_loans/');
      expect(publicSettings.twitterUrl).toBe('https://x.com/VidyaLoans07');
      expect(publicSettings.enableAppBanner).toBe(false);

      // Verify server secrets are stripped from public settings
      expect((publicSettings as any).openRouterApiKey).toBeUndefined();
      expect((publicSettings as any).awsSesSecretKey).toBeUndefined();
      expect((publicSettings as any).smtpPassword).toBeUndefined();
    });
  });
});

