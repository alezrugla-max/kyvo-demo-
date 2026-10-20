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
  manageUrl: '',                        // Stripe customer portal link (cancel / change card)
};
