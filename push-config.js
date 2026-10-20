/* Kyvo v8.2 — background push (app CLOSED). DISABLED until Alez sets it up — see kyvo_launch/push_plan.md.
   Only PUBLIC identifiers belong here (OneSignal App ID, Firebase web config, VAPID *public* key).
   NEVER put the OneSignal REST API key, a Firebase service-account JSON or a VAPID *private* key here —
   those live only in GitHub → Settings → Secrets and variables → Actions. */
window.KYVO_PUSH_CONFIG = {
  enabled: false,              // true only after push_plan.md steps are done
  provider: 'onesignal',       // 'onesignal' (recommended) or 'fcm'
  onesignalAppId: '',          // public App ID from OneSignal dashboard
  fcm: {                       // public Firebase web config (only if provider === 'fcm')
    apiKey: '', authDomain: '', projectId: '', messagingSenderId: '', appId: '',
    vapidPublicKey: '',        // Web Push certificate (PUBLIC key) from Firebase → Cloud Messaging
  },
};
