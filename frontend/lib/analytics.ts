// GA4 and GTM Analytics Helpers

declare global {
  interface Window {
    dataLayer?: any[];
    gtag?: (...args: any[]) => void;
  }
}

/**
 * Pushes custom events and parameters directly to Google Tag Manager dataLayer.
 */
export function pushToDataLayer(data: Record<string, any>) {
  if (typeof window !== "undefined") {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(data);
  }
}

/**
 * Pushes user_id to dataLayer and GA4 when a user successfully logs in.
 */
export function trackUserLogin(userId: string | number, role?: string) {
  if (typeof window === "undefined" || !userId) return;

  const idStr = String(userId);

  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({
    event: "login",
    user_id: idStr,
    user_role: role || undefined,
  });

  console.log('User-ID successfully pushed to dataLayer:', idStr);

  if (typeof window.gtag === "function") {
    window.gtag("set", "user_properties", {
      user_id: idStr,
    });
  }
}

/**
 * Sets user_id in dataLayer when an existing session is restored on page refresh or load.
 */
export function syncUserSessionToDataLayer(userId: string | number | undefined | null) {
  if (typeof window === "undefined" || !userId) return;

  const idStr = String(userId);

  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({
    user_id: idStr,
  });

  if (typeof window.gtag === "function") {
    window.gtag("set", "user_properties", {
      user_id: idStr,
    });
  }
}

/**
 * Clears user_id and fires a logout event when the user logs out.
 */
export function trackUserLogout() {
  if (typeof window === "undefined") return;

  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({
    event: "logout",
    user_id: null,
  });

  if (typeof window.gtag === "function") {
    window.gtag("set", "user_properties", {
      user_id: null,
    });
  }
}

/**
 * Fires Google Ads conversion and GA4 lead event ONLY after verified successful 2xx API response.
 */
export function trackLeadConversion(formName: string, details?: Record<string, any>) {
  if (typeof window === "undefined") return;

  // 1. Google Tag Manager dataLayer event
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({
    event: "generate_lead",
    event_category: "Leads",
    event_label: formName,
    form_name: formName,
    conversion_type: "lead_submission",
    ...details,
  });

  // 2. Direct GA4 & Google Ads gtag calls if gtag is present
  if (typeof window.gtag === "function") {
    window.gtag("event", "generate_lead", {
      event_category: "Leads",
      event_label: formName,
      form_name: formName,
      ...details,
    });

    window.gtag("event", "conversion", {
      send_to: details?.conversion_id,
      event_category: "Leads",
      event_label: formName,
    });
  }

  console.log(`[Analytics] Verified lead conversion fired for "${formName}".`);
}
