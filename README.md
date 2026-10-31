# kyvo-demo-: stara strona, tylko przekierowanie (v8.25)

Kyvo działa teraz pod adresem **https://kyvo-app.github.io/**, a kod jest w repo kyvo-app/kyvo-app.github.io.

Każdy adres tutaj przenosi na nowy adres z tą samą ścieżką i hashem. Na przykład stare linki z Discorda i pushy `#coin/...` nadal działają.

`sw.js` oraz `OneSignalSDK*Worker.js` to service workery, które same się wyrejestrowują i czyszczą stare cache.

W tym repo nie ma workflowów (`.github/workflows`), więc stara pętla nie wysyła już pushy.
