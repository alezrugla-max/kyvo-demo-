/* Kyvo Premium — payment stub. NOTHING is sold yet (enabled:false → CTA shows "Wkrótce").
   Later: Stripe Payment Links (Stripe account of an adult / legal guardian or a company), subscription with
   a 3-day trial that requires a payment method (card, Apple Pay, Google Pay; BLIK is not available for
   recurring payments). Payment Links are public URLs — NEVER put a Stripe secret key (sk_...) here.
   Entitlement check (who is Premium) needs a backend later, e.g. Firebase + Stripe webhook / extension. */
window.KYVO_PREMIUM_CONFIG = {
  enabled: false,
  currency: 'USD',
  regularPrice: '$9.99',
  promoPrice: '$3.99',
  promoActive: true,                    // "Cena startowa dla pierwszych użytkowników" (no deadline / seat count)
  period: 'mies.',
  trialDays: 3,
  stripePaymentLinkPromo: '',           // e.g. https://buy.stripe.com/xxxx  (only used when enabled:true)
  stripePaymentLinkRegular: '',         // e.g. https://buy.stripe.com/yyyy
  manageUrl: '',
  popupAfterLogin: true,                // v8.2: show the Premium pop-up after login / "continue without login" (max once per session and per day)                        // Stripe customer portal link (cancel / change card)
};

/* v8.4: entitlement hook used by notifications (free = 2/day, Premium = all). Until a real backend exists
   nobody is Premium. Later: set from Firebase/Stripe entitlement (never trust a value the user can type). */
window.KyvoPremium = window.KyvoPremium || {
  isActive() {
    const C = window.KYVO_PREMIUM_CONFIG || {};
    if (!C.enabled) return false;
    try { const u = +localStorage.getItem('kyvo_premium_until') || 0; return u > Date.now(); } catch (e) { return false; }
  },
};
