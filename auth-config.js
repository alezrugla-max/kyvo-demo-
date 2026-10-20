/* Kyvo — login configuration (public, no secrets).
   Google + e-mail sign-in use Firebase Authentication. The Firebase *web* config is public by design,
   but this bundle ships PLACEHOLDERS only. To enable: follow firebase_setup_pl.md, paste the values from
   Firebase console → Project settings → Your apps → Web app, then flip the providers to enabled: true. */
window.KYVO_AUTH_CONFIG = {
  wallet: { enabled: true },            // Phantom / Solflare / MetaMask — message signing only, works now
  firebase: {
    apiKey: 'PASTE_FIREBASE_API_KEY',
    authDomain: 'PASTE_PROJECT_ID.firebaseapp.com',
    projectId: 'PASTE_PROJECT_ID',
    appId: 'PASTE_FIREBASE_APP_ID',
  },
  sdkVersion: '10.14.1',                // loaded from https://www.gstatic.com/firebasejs/<v>/ only when a Firebase provider is enabled
  google: { enabled: false },           // Firebase → Authentication → Sign-in method → Google
  email: { enabled: false },            // Firebase → Authentication → Sign-in method → Email/Password + "Email link (passwordless sign-in)"
  apple: { enabled: false },            // shown as "Wkrótce"
};
