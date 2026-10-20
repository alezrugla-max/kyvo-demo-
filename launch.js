/* Kyvo v8.0 — onboarding, "Jak korzystać", legal pages (Polish). Static, no tracking, no network calls. */
(function () {
  'use strict';
  const OB_KEY = 'kyvo_onboard_v8';
  const UPDATED = '20.10.2026';
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

  /* ---------------- Onboarding ---------------- */
  const CARDS = [
    {
      art: '<img src="icons/icon-192.png" width="112" height="112" alt="" class="ob-logo">',
      t: 'Witaj w Kyvo',
      p: 'Smart money i viralowe memecoiny w jednym miejscu. Dane na żywo z Solany, BSC i Robinhood Chain.',
      li: ['Za darmo, logowanie opcjonalne', 'Kyvo nie trzyma Twoich pieniędzy', 'Nigdy nie prosimy o seed ani klucz prywatny'],
    },
    {
      art: '<div class="ob-art"><span>New Pairs</span><span>Final Stretch</span><span>Migrated</span><span>Good Coins</span></div>',
      t: 'Pulse: coiny na żywo',
      p: 'Pulse pokazuje nowe pary, coiny blisko końca krzywej (Final Stretch) i te, które właśnie przeszły na DEX (Migrated). Good Coins to coiny po mocniejszych filtrach.',
      li: ['Przełącz sieć u góry: Solana · BSC · Robin · Wszystkie', '„Filtry” — ustaw MC, płynność, wolumen, wiek', '⏱ wiek coina i „na liście od” przy każdym wierszu'],
    },
    {
      art: '<div class="ob-art"><span>𝕏 Tematy → coiny</span><span>Tweety traderów</span><span>Ważne posty</span></div>',
      t: 'Viral z X',
      p: 'Popularne tematy z X i coiny, które do nich pasują. Gdy trader tweetuje o coinie, od razu masz link do jego strony w Kyvo.',
      li: ['Cytaty z linkiem do oryginału na X', 'Coiny dopasowane po adresie albo jednoznacznym $tickerze', 'Ten sam ticker może mieć kopie — sprawdzaj adres'],
    },
    {
      art: '<div class="ob-art"><span>🏆 Ranking</span><span>👤 Profil</span><span>PnL</span></div>',
      t: 'Ranking i Twój Profil',
      p: 'Ranking traderów z publicznych transakcji on-chain: PnL, win rate, ostatnie trade’y. W Profilu wklejasz publiczny adres portfela i widzisz swój PnL, pozycje i kartę do udostępnienia.',
      li: ['Tylko publiczne adresy (Solana, BSC, Robinhood)', 'Dane zostają w Twojej przeglądarce', 'Do 8 portfeli naraz'],
    },
    {
      art: '<div class="ob-art ob-ios"><span>Safari</span><span>⬆︎ Udostępnij</span><span>➕ Do ekranu początk.</span></div>',
      t: 'Dodaj Kyvo na ekran',
      p: 'iPhone: otwórz Kyvo w Safari → przycisk Udostępnij ⬆︎ → „Do ekranu początkowego”. Android/Chrome: menu ⋮ → „Dodaj do ekranu głównego”.',
      li: ['To nie jest porada finansowa — DYOR', 'Memecoiny są bardzo ryzykowne, możesz stracić wszystko'],
      last: true,
    },
  ];
  function closeOnboard() {
    const el = document.getElementById('kyvoOb');
    if (!el) return;
    try { localStorage.setItem(OB_KEY, String(Date.now())); } catch (e) {}
    el.classList.add('out');
    setTimeout(() => el.remove(), 220);
    document.documentElement.classList.remove('ob-lock');
    if (typeof onboardDone === 'function') { const f = onboardDone; onboardDone = null; setTimeout(f, 60); }
  }
  let onboardDone = null;
  function openOnboard() {
    if (document.getElementById('kyvoOb')) return;
    const el = document.createElement('div');
    el.id = 'kyvoOb';
    el.className = 'ob';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-label', 'Wprowadzenie do Kyvo');
    el.innerHTML = `
      <div class="ob-top"><span class="ob-step" id="obStep">1/${CARDS.length}</span><button type="button" class="ob-skip" id="obSkip">Pomiń</button></div>
      <div class="ob-track" id="obTrack">${CARDS.map((c, i) => `
        <section class="ob-card" data-i="${i}">
          <div class="ob-artwrap">${c.art}</div>
          <h2>${esc(c.t)}</h2>
          <p>${esc(c.p)}</p>
          <ul>${c.li.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
          ${c.last ? `<div class="ob-legal">Korzystając z Kyvo akceptujesz <a href="#legal/regulamin" data-obclose="1">Regulamin</a> i <a href="#legal/prywatnosc" data-obclose="1">Politykę prywatności</a>.</div>` : ''}
        </section>`).join('')}
      </div>
      <div class="ob-bot">
        <div class="ob-dots" id="obDots">${CARDS.map((_, i) => `<button type="button" data-d="${i}" aria-label="Karta ${i + 1}" class="${i ? '' : 'on'}"></button>`).join('')}</div>
        <button type="button" class="ob-next" id="obNext">Dalej</button>
      </div>`;
    document.body.appendChild(el);
    document.documentElement.classList.add('ob-lock');
    const track = el.querySelector('#obTrack');
    const next = el.querySelector('#obNext');
    let idx = 0;
    const go = (i) => { track.scrollTo({ left: i * track.clientWidth, behavior: 'smooth' }); };
    const sync = () => {
      const i = Math.round(track.scrollLeft / Math.max(1, track.clientWidth));
      if (i === idx && next.dataset.ready) return;
      idx = Math.max(0, Math.min(CARDS.length - 1, i));
      next.dataset.ready = '1';
      el.querySelector('#obStep').textContent = idx + 1 + '/' + CARDS.length;
      el.querySelectorAll('#obDots button').forEach((b, j) => b.classList.toggle('on', j === idx));
      next.textContent = idx === CARDS.length - 1 ? 'Zaczynamy' : 'Dalej';
    };
    track.addEventListener('scroll', () => requestAnimationFrame(sync), { passive: true });
    next.onclick = () => (idx >= CARDS.length - 1 ? closeOnboard() : go(idx + 1));
    el.querySelector('#obSkip').onclick = closeOnboard;
    el.querySelectorAll('#obDots button').forEach((b) => (b.onclick = () => go(+b.dataset.d)));
    el.querySelectorAll('[data-obclose]').forEach((a) => a.addEventListener('click', closeOnboard));
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeOnboard();
      if (e.key === 'ArrowRight') go(Math.min(CARDS.length - 1, idx + 1));
      if (e.key === 'ArrowLeft') go(Math.max(0, idx - 1));
    });
    sync();
    setTimeout(() => next.focus({ preventScroll: true }), 50);
  }
  function maybeOnboard(after) {
    let seen = null;
    try { seen = localStorage.getItem(OB_KEY); } catch (e) {}
    const h = (location.hash || '').slice(1);
    if (seen || /^(legal|help|login|kontakt|premium)/.test(h) || /[?&]noonboard/.test(location.search)) return false;
    onboardDone = after || null;
    openOnboard();
    return true;
  }

  /* ---------------- Help / FAQ ---------------- */
  const FAQ = [
    ['Start', [
      ['Czym jest Kyvo?', 'Darmowa aplikacja webowa (PWA), która zbiera w jednym miejscu publiczne dane o memecoinach: nowe pary, coiny przed migracją, coiny po migracji, ruchy publicznie znanych portfeli (smart money), ranking traderów i popularne tematy z X. Kyvo niczym nie handluje, nie trzyma środków i nigdy nie wysyła transakcji z Twojego portfela (logowanie portfelem to tylko podpis wiadomości).'],
      ['Czy muszę zakładać konto?', 'Nie. Logowanie jest opcjonalne — bez niego masz pełny dostęp. Ustawienia (sieć, filtry, Twoje publiczne adresy, nick, avatar) zapisują się tylko w pamięci tej przeglądarki (localStorage).'],
      ['Jak dodać Kyvo na ekran telefonu?', 'iPhone: otwórz stronę w Safari → Udostępnij ⬆︎ → „Do ekranu początkowego”. Android/Chrome: menu ⋮ → „Dodaj do ekranu głównego”. Po aktualizacji Kyvo zamknij apkę całkiem i otwórz ponownie, żeby wczytała nową wersję.'],
      ['Sieci: Solana · BSC · Robin · Wszystkie', 'Przełącznik pod wyszukiwarką wybiera sieć dla wszystkich list. „Robin” to Robinhood Chain. „Wszystkie” łączy trzy sieci — przy każdym coinie jest znaczek SOL / BSC / RH.'],
    ]],
    ['Logowanie, Premium i kontakt', [
      ['Czy muszę się logować?', 'Nie. „Kontynuuj bez logowania” daje pełny dostęp do wszystkiego. Logowanie zapisuje Twój portfel w Profilu i przygotowuje konto pod przyszłe Kyvo Premium.'],
      ['Jak działa logowanie portfelem?', 'Wybierasz Phantom / Solflare (Solana) albo MetaMask lub inny portfel EVM (BSC, Robinhood Chain). Portfel pokazuje wiadomość „Logowanie do Kyvo. To nie jest transakcja i nic nie kosztuje.” — podpisujesz tylko ją. To nie jest transakcja, nie ma opłat, Kyvo nie dostaje dostępu do środków. Podpis sprawdzamy na Twoim urządzeniu, a sesja zostaje w tej przeglądarce. Na iPhonie Kyvo otworzy się w przeglądarce w aplikacji portfela.'],
      ['Co jeśli portfel prosi o zatwierdzenie transakcji?', 'Odrzuć ją. Kyvo nigdy nie wysyła transakcji do podpisu — tylko wiadomość tekstową. Nikt z Kyvo nie poprosi też o seed phrase ani klucz prywatny.'],
      ['Google, e-mail i Apple', 'Logowanie przez Google i e-mail (link logowania wysyłany na maila — bez hasła) włączymy wkrótce; Apple — później. Do tego czasu przyciski są oznaczone „Wkrótce”.'],
      ['Jak się wylogować?', 'Profil → „Wyloguj”. Adres zostaje w Profilu, możesz go usunąć osobno. Więcej → „Wyczyść dane Kyvo” usuwa wszystko z tej przeglądarki.'],
      ['Kyvo Premium', 'Plan Premium jest w przygotowaniu — funkcje oznaczone „wkrótce” jeszcze nie działają i nic nie jest sprzedawane. Planowana cena: $9.99 / mies., cena startowa dla pierwszych użytkowników $3.99 / mies., 3 dni za darmo (z podpiętą kartą, Apple Pay lub Google Pay; BLIK nie działa dla subskrypcji). Premium będzie wymagać logowania. Wszystko, co działa dziś, zostaje za darmo.'],
      ['Kontakt', 'Chcesz pogadać, pomóc albo współpracować? Więcej → Kontakt (Discord).'],
    ]],
    ['Zakładki z coinami', [
      ['Pulse', 'Główny ekran. Na telefonie przełączasz New / Final Stretch / Migrated, na komputerze widzisz trzy kolumny obok siebie.'],
      ['New Pairs', 'Najnowsze pary na wybranej sieci. Domyślnie tylko coiny z market cap (MC) od $10k i młodsze niż 48 h, żeby odsiać śmieci.'],
      ['Final Stretch', 'Coiny wciąż na krzywej (bonding curve) pump.fun (Solana) lub four.meme (BSC), które są blisko „ukończenia” krzywej. Procent krzywej to estymacja: MC / ok. $69k — nie oficjalna wartość z platformy. Na Robinhood Chain ta zakładka jest niedostępna.'],
      ['Migrated', 'Coiny, które niedawno przeszły z krzywej na DEX (Solana: PumpSwap, Raydium, Meteora…; BSC: PancakeSwap).'],
      ['Good Coins', 'Lista po ostrzejszych filtrach: MC od $50k, płynność od $20k, wolumen 24h od $25k, wiek 2 h – 30 dni, min. 40% transakcji kupna w ostatniej godzinie i podane socials. Przycisk „Smart money” sortuje po zakupach znanych portfeli. To nadal nie są rekomendacje.'],
      ['Hot i Boosted', 'Hot — coiny z najnowszymi profilami i boostami na DexScreener, sortowane po wolumenie. Boosted — coiny, za których promocję ktoś zapłacił na DexScreener (boost to reklama, nie sygnał jakości).'],
      ['Filtry', 'Przycisk „Filtry” nad listą. MC min/max, płynność (Liq) min, wolumen 24h min, wiek min/max w godzinach, zmiana ceny Δ 5m i Δ 1h, „Buy ratio” (udział transakcji kupna w ostatniej godzinie, 0–1) i „Wymagaj socials”. Każda zakładka pamięta własne filtry; „Reset” przywraca domyślne.'],
      ['⏱ wiek i „na liście od”', '⏱ to wiek pary od jej utworzenia. „Na liście od X min” mówi, od kiedy ten coin jest w tej zakładce — liczone od momentu, gdy Twoja przeglądarka zobaczyła go tam pierwszy raz (więc na nowym telefonie licznik startuje od zera).'],
      ['Liq: krzywa', 'Coin jest jeszcze na bonding curve, więc nie ma klasycznej puli płynności na DEX.'],
    ]],
    ['Smart money i Ranking', [
      ['Co znaczy znaczek „SM: …”?', 'Ten coin kupił ostatnio co najmniej jeden z publicznie przypisanych portfeli (np. znani KOL-e / traderzy, których adresy są publiczne). Dane z publicznych transakcji Solany, odświeżane kilka razy dziennie — mogą być opóźnione o kilka godzin. Kupno przez znany portfel nie oznacza, że coin wzrośnie.'],
      ['Ranking — skąd PnL?', 'Liczymy zrealizowany PnL z publicznych transakcji: każda sprzedaż jest dopasowana do wcześniejszego kupna tego samego coina (metoda FIFO), a SOL przeliczamy po historycznym kursie SOL/USD. Okresy: Dzień, Tydzień, Miesiąc. Win rate = odsetek zamkniętych pozycji z zyskiem.'],
      ['Dlaczego czasem jest „—”?', 'Brak sprzedaży z dopasowanym kupnem w tym okresie — np. trader kupił wcześniej, niż sięga nasze okno danych. Wtedy wolimy pokazać „—” niż zmyśloną liczbę. Wyniki są przybliżone.'],
    ]],
    ['Profil', [
      ['Co wkleić?', 'Tylko publiczny adres portfela (Solana: ciąg base58; BSC / Robinhood: adres 0x…). Nigdy nie wklejaj seed phrase ani klucza prywatnego — Kyvo rozpozna takie dane, odrzuci je i nic nie zapisze. Nikt z Kyvo nigdy o nie nie poprosi.'],
      ['Okna PnL: 24h · 7 dni · 30 dni · Całość', 'PnL liczony z transakcji, które udało się pobrać z publicznych źródeł bezpośrednio w Twojej przeglądarce. Limity darmowych źródeł: Solana — ok. ostatnie 24 h (historia rośnie z każdym odświeżeniem na tym urządzeniu); BSC — ok. 24 h, przycisk „Starsze BSC” dociąga do 7 dni; Robinhood Chain — ok. 150 ostatnich transferów. Dlatego 30 dni i „Całość” mogą być niepełne.'],
      ['Pozycje i Aktywność', 'Pozycje — coiny kupione w oknie danych, z niezrealizowanym PnL po aktualnej cenie z DexScreener. Aktywność — lista kupna/sprzedaży.'],
      ['Karta PnL', 'Przycisk „Udostępnij” tworzy obrazek z Twoim wynikiem (generowany na telefonie, nigdzie nie wysyłany). Możesz go zapisać albo wysłać dalej.'],
      ['Jak usunąć moje dane?', 'Profil → usuń portfel, albo Więcej → „Wyczyść dane Kyvo”. Wszystko jest tylko w Twojej przeglądarce, więc to usuwa wszystko.'],
    ]],
    ['Viral z X i wykres', [
      ['Viral z X', 'Tematy → coiny: popularne tematy z X i coiny o pasującej nazwie z realnym wolumenem. Tweety traderów: posty znanych traderów, w których pada adres coina lub jednoznaczny $ticker. Ważne posty: duże posty, które ruszają rynek. Treści z X to krótkie cytaty z linkiem do oryginału. Na górze widać godzinę ostatniej aktualizacji — dane z X odświeżamy kilka razy dziennie, nie na żywo.'],
      ['Wykres coina', 'Interwały 1s, 15s, 30s, 1m, 5m, 15m i dłuższe. Świece 1s–30s budujemy z ostatnich publicznych transakcji puli, więc obejmują tylko krótki, świeży odcinek. Wykres: TradingView Lightweight Charts™, dane: GeckoTerminal.'],
      ['Przyciski FOMO / Axiom / Photon / GMGN', 'To zwykłe linki do zewnętrznych serwisów, z którymi Kyvo nie jest powiązane. Handel odbywa się tam, na Twoją odpowiedzialność.'],
    ]],
  ];
  function renderHelp(root, ctx) {
    root.innerHTML = `
      <div class="lg-head"><button type="button" class="back" data-back aria-label="Wstecz">‹</button><div class="h" style="margin:0">Jak korzystać z Kyvo</div></div>
      <div class="card hp-quick">
        <button type="button" class="pf-btn pf-share" id="hpTour">▶ Pokaż wprowadzenie</button>
        <a class="pf-btn" href="#legal/ryzyko">⚠️ Ryzyko</a>
        <a class="pf-btn" href="#kontakt">💬 Kontakt</a>
      </div>
      ${FAQ.map(([sec, items]) => `
        <div class="vsub" style="margin:14px 2px 6px">${esc(sec)}</div>
        <div class="card hp-list">${items.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('')}</div>`).join('')}`;
    wireBack(root, ctx);
    root.querySelector('#hpTour').onclick = openOnboard;
  }

  /* ---------------- Legal ---------------- */
  const LEGAL = {
    regulamin: {
      t: 'Regulamin',
      body: [
        ['1. Czym jest Kyvo', 'Kyvo to bezpłatna aplikacja internetowa (strona WWW / PWA), która prezentuje publicznie dostępne dane rynkowe o kryptowalutach typu memecoin, publiczną aktywność portfeli blockchain oraz cytaty z publicznych postów w serwisie X. Kyvo nie jest giełdą, kantorem, brokerem, doradcą inwestycyjnym ani portfelem.'],
        ['2. Brak porady finansowej', 'Żadna treść w Kyvo (listy, filtry, znaczki „smart money”, ranking, „Good Coins”, tematy z X, wykresy) nie jest poradą inwestycyjną, rekomendacją ani zachętą do kupna lub sprzedaży. Decyzje podejmujesz samodzielnie i na własne ryzyko. Zawsze rób własny research (DYOR).'],
        ['3. Ryzyko', 'Memecoiny są skrajnie ryzykowne i zmienne. Ich wartość może spaść do zera w kilka minut. Częste są oszustwa (rug pull, honeypot, fałszywe kopie tickerów). Możesz stracić wszystkie zainwestowane pieniądze. Inwestuj tylko kwoty, których utratę możesz zaakceptować.'],
        ['4. Środki i klucze', 'Kyvo nigdy nie przechowuje, nie przyjmuje ani nie przesyła Twoich środków. Kyvo nigdy nie poprosi o seed phrase (frazę odzyskiwania) ani klucz prywatny. Jeśli ktoś podszywa się pod Kyvo i o nie prosi — to oszustwo.'],
        ['5. Dane i ich dokładność', 'Dane pochodzą z zewnętrznych, publicznych źródeł (lista w „Źródła danych”). Mogą być opóźnione, niepełne lub błędne. Część wartości to estymacje (np. procent bonding curve, PnL z ograniczonego okna transakcji) i są tak oznaczone. Nie gwarantujemy dostępności ani poprawności danych.'],
        ['6. Linki zewnętrzne', 'Kyvo zawiera linki do zewnętrznych serwisów (np. DexScreener, X, eksploratory blockchain, terminale handlowe). Kyvo nie jest z nimi powiązane, nie odpowiada za ich treści ani działanie, a korzystanie z nich podlega ich regulaminom. Nazwy i znaki towarowe należą do ich właścicieli.'],
        ['7. Treści z X', 'Pokazujemy krótkie cytaty publicznych postów wraz z autorem i linkiem do oryginału, w celu informacyjnym. Prawa do treści należą do ich autorów. Jeśli jesteś autorem i chcesz usunięcia cytatu, skontaktuj się z nami — usuniemy go.'],
        ['7a. Logowanie', 'Logowanie jest dobrowolne — bez niego masz pełny dostęp. Logowanie portfelem polega wyłącznie na podpisaniu wiadomości tekstowej; to nie jest transakcja i nic nie kosztuje. Kyvo nigdy nie poprosi o podpisanie transakcji, seed phrase ani klucz prywatny. Sesja jest zapisana tylko w Twojej przeglądarce. Logowanie przez Google lub e-mail (gdy zostanie włączone) działa przez usługę Google Firebase. Wylogujesz się w Profilu; konto Kyvo (Google / e-mail) możesz tam też usunąć.'],
        ['7b. Kyvo Premium', 'Kyvo Premium jest w przygotowaniu i obecnie nie jest sprzedawane — nie pobieramy żadnych płatności. Ceny i funkcje pokazane na stronie Premium mają charakter zapowiedzi i mogą się zmienić. Premium będzie wymagało zalogowania.'],
        ['7c. Warunki subskrypcji (po uruchomieniu płatności)', 'Premium będzie subskrypcją miesięczną: cena regularna $9.99 / mies., dla pierwszych użytkowników cena startowa $3.99 / mies. Na start 3 dni za darmo — okres próbny wymaga podania metody płatności (karta, Apple Pay lub Google Pay; BLIK nie jest dostępny dla płatności cyklicznych). Jeśli nie anulujesz przed końcem okresu próbnego, subskrypcja zamieni się w płatną i będzie się automatycznie odnawiać co miesiąc. Anulować możesz w każdej chwili — Premium działa wtedy do końca opłaconego okresu. Płatności obsłuży zewnętrzny operator (Stripe); Kyvo nie widzi danych Twojej karty. Szczegóły, w tym prawo odstąpienia od umowy, podamy przed uruchomieniem płatności.'],
        ['8. Zasady korzystania', 'Nie wolno używać Kyvo do działań niezgodnych z prawem, do manipulacji rynkiem, oszustw ani do przeciążania usług, z których Kyvo korzysta. Kyvo jest przeznaczone dla osób pełnoletnich (18+).'],
        ['9. Odpowiedzialność', 'W najszerszym zakresie dopuszczalnym przez prawo twórca Kyvo nie odpowiada za straty finansowe wynikające z decyzji podjętych na podstawie treści w aplikacji ani za przerwy w działaniu lub błędy danych. Nie wyłącza to praw, których nie można wyłączyć na mocy przepisów, w tym praw konsumenta.'],
        ['10. Zmiany', 'Regulamin może się zmieniać wraz z rozwojem aplikacji. Aktualna wersja jest zawsze dostępna w Kyvo (Więcej → Regulamin).'],
        ['11. Kontakt', 'Pytania, zgłoszenia i prośby o usunięcie treści: Więcej → Kontakt.'],
      ],
    },
    prywatnosc: {
      t: 'Polityka prywatności',
      body: [
        ['W skrócie', 'Logowanie jest opcjonalne. Bez logowania Kyvo nie zbiera żadnych danych osobowych. Kyvo nie używa cookies reklamowych, analityki, pikseli ani trackingu i nie ma własnego serwera z bazą użytkowników. Logowanie portfelem zostaje na Twoim urządzeniu; logowanie Google / e-mail (gdy zostanie włączone) obsługuje Google Firebase.'],
        ['Co zapisuje się na Twoim urządzeniu', 'W pamięci przeglądarki (localStorage i pamięć podręczna aplikacji) zapisujemy tylko: wybraną sieć i filtry, ostatnie dane coinów (żeby apka szybciej startowała), informację „od kiedy coin jest na liście”, wybrane zakładki, publiczne adresy portfeli dodane w Profilu, nick i avatar (zdjęcie avatara zostaje na telefonie), pobraną historię transakcji tych adresów oraz to, że wprowadzenie zostało już pokazane. Te dane nie są nigdzie wysyłane przez Kyvo. Usuniesz je przyciskiem „Wyczyść dane Kyvo” (Więcej) albo czyszcząc dane strony w przeglądarce.'],
        ['Logowanie portfelem', 'Gdy logujesz się portfelem, Twój portfel podpisuje wiadomość tekstową. Podpis sprawdzamy na Twoim urządzeniu; sesja (publiczny adres, treść wiadomości i podpis) zostaje tylko w localStorage tej przeglądarki i nie trafia na żaden serwer Kyvo. Nie dostajemy dostępu do środków ani kluczy.'],
        ['Logowanie przez Google lub e-mail', 'GOOGLE_STATUS Gdy jest włączone, korzystamy z Firebase Authentication (Google): przy logowaniu Google przetwarzane są Twoje imię, adres e-mail, zdjęcie profilowe i identyfikator konta, a przy logowaniu e-mailem — adres e-mail (wysyłamy na niego jednorazowy link logowania); dane konta są przechowywane w projekcie Firebase Kyvo, a w Twojej przeglądarce — dane sesji. Używamy ich tylko do logowania (i w przyszłości do obsługi Premium). Konto usuniesz w Profilu („Usuń konto Kyvo”), a wylogujesz się przyciskiem „Wyloguj”.'],
        ['Płatności (w przyszłości)', 'Kyvo Premium nie jest jeszcze sprzedawane. Po uruchomieniu płatności obsłuży je Stripe — dane karty trafią bezpośrednio do Stripe, a Kyvo zobaczy tylko status subskrypcji.'],
        ['Nie sprzedajemy danych', 'Nie sprzedajemy, nie udostępniamy i nie wykorzystujemy Twoich danych do reklam.'],
        ['Zapytania do zewnętrznych API', 'Żeby pokazać dane na żywo, Twoja przeglądarka łączy się bezpośrednio z publicznymi usługami: DexScreener, GeckoTerminal, publiczne węzły RPC Solany (publicnode), BSC (bloXroute, 48 Club, BNB Chain) i Robinhood Chain, Blockscout (Robinhood Chain) oraz Binance (publiczne kursy). Gdy logowanie Google jest włączone — także z serwerami Google (Firebase). Obrazki coinów ładują się z serwerów tych usług. Jak przy każdym połączeniu w internecie, te serwisy widzą Twój adres IP i dane przeglądarki, a gdy sprawdzasz portfel w Profilu — także ten publiczny adres. Działają według własnych polityk prywatności.'],
        ['Hosting', 'Strona jest hostowana na GitHub Pages (GitHub, Inc.). GitHub może przetwarzać adres IP odwiedzających w logach serwera w celach bezpieczeństwa, zgodnie ze swoją polityką prywatności. Kyvo nie ma dostępu do tych logów.'],
        ['Kontakt przez Discord', 'Jeśli napiszesz do nas na Discordzie, rozmowa odbywa się w serwisie Discord według jego zasad. Kyvo nie ma formularzy kontaktowych ani newslettera.'],
        ['Treści z X', 'Posty z X pokazujemy jako cytaty z linkiem do oryginału. Kliknięcie linku otwiera serwis X, który działa według własnej polityki prywatności.'],
        ['Adresy portfeli', 'Adres portfela jest publiczny z natury blockchaina. Kyvo używa go tylko w Twojej przeglądarce do pobrania publicznych transakcji. Nigdy nie wklejaj seed phrase ani klucza prywatnego — Kyvo ich nie przyjmuje.'],
        ['Twoje prawa', 'Ponieważ nie zbieramy ani nie przechowujemy Twoich danych osobowych na naszych serwerach, wszystkie dane masz pod kontrolą na swoim urządzeniu. W sprawach prywatności możesz się z nami skontaktować; masz też prawo złożyć skargę do Prezesa UODO.'],
      ],
    },
    zrodla: {
      t: 'Źródła danych i licencje',
      body: [
        ['Dane rynkowe', 'DexScreener (publiczne API: pary, ceny, MC, płynność, wolumen, profile i boosty) · GeckoTerminal (publiczne API: nowe pule, świece OHLCV, transakcje — zapasowe źródło i wykresy).'],
        ['Blockchain', 'Solana: publiczne RPC (publicnode; do rankingu także api.mainnet-beta.solana.com) · BSC: publiczne RPC bloXroute, 48 Club i BNB Chain · Robinhood Chain: publiczne RPC oraz eksplorator Blockscout. Kursy SOL/BNB/ETH: publiczne notowania Binance.'],
        ['X (Twitter)', 'Publiczne posty pokazywane jako krótkie cytaty z autorem i linkiem do oryginału. Dane z X odświeżane kilka razy dziennie (godzina aktualizacji widoczna w zakładce Viral).'],
        ['Smart money i Ranking', 'Portfele publicznie przypisane do znanych traderów / KOL-i (publiczne źródła). PnL liczony przez Kyvo z publicznych transakcji metodą FIFO.'],
        ['Wykresy', 'TradingView Lightweight Charts™ — © TradingView, Inc., licencja Apache License 2.0 (kopia licencji: vendor/lightweight-charts/LICENSE). Logo atrybucji TradingView jest widoczne na wykresie.'],
        ['Znaki towarowe', 'Solana, BNB Chain/BSC, Robinhood, X, DexScreener, GeckoTerminal, pump.fun, four.meme, PancakeSwap, FOMO, Axiom, Photon, GMGN i inne nazwy należą do ich właścicieli. Kyvo nie jest z nimi powiązane ani przez nie wspierane.'],
        ['Kyvo', 'Wygląd, logo (duszek Kyvo) i kod aplikacji są oryginalne.'],
      ],
    },
    ryzyko: {
      t: 'Ryzyko — przeczytaj',
      body: [
        ['To nie jest porada finansowa', 'Kyvo pokazuje dane. Nie mówi, co kupić. Znaczek smart money, miejsce w rankingu czy viralowy temat nie oznaczają, że coin wzrośnie.'],
        ['Możesz stracić wszystko', 'Większość memecoinów traci prawie całą wartość. Ceny potrafią spaść o 90% w kilka minut. Wchodź tylko za kwoty, których utratę akceptujesz.'],
        ['Uważaj na oszustwa', 'Sprawdzaj adres kontraktu (CA), nie tylko ticker — kopie są bardzo częste. Uważaj na coiny z małą płynnością, nowe konta „insiderów” i obietnice pewnego zysku.'],
        ['Twoje klucze, Twoje środki', 'Nigdy nikomu nie podawaj seed phrase ani klucza prywatnego — ani Kyvo, ani „supportowi”, ani na stronach, do których prowadzą linki. Kyvo nigdy o nie nie prosi.'],
        ['DYOR', 'Do Your Own Research — sprawdź projekt, holderów, płynność i źródło informacji, zanim cokolwiek zrobisz.'],
      ],
    },
  };
  function legalLinks() {
    return `<a href="#help">Jak korzystać</a><a href="#legal/regulamin">Regulamin</a><a href="#legal/prywatnosc">Prywatność</a><a href="#legal/zrodla">Źródła danych</a><a href="#legal/ryzyko">Ryzyko</a><a href="#premium">Premium</a><a href="#kontakt">Kontakt</a>`;
  }
  function renderLegal(root, which, ctx) {
    const L = LEGAL[which] || LEGAL.regulamin;
    const gOn = window.KyvoAuth && window.KyvoAuth.googleReady && window.KyvoAuth.googleReady();
    const eOn = window.KyvoAuth && window.KyvoAuth.emailReady && window.KyvoAuth.emailReady();
    const fix = (t) => t.replace('GOOGLE_STATUS ', gOn || eOn ? 'Włączone. ' : 'Obecnie wyłączone (wkrótce). ');
    root.innerHTML = `
      <div class="lg-head"><button type="button" class="back" data-back aria-label="Wstecz">‹</button><div class="h" style="margin:0">${esc(L.t)}</div></div>
      <div class="mut" style="font-size:11.5px;margin:2px 2px 10px">Obowiązuje od ${UPDATED}</div>
      <div class="card lg-body">${L.body.map(([h, p]) => `<h3>${esc(h)}</h3><p>${esc(fix(p))}</p>`).join('')}</div>`;
    wireBack(root, ctx);
  }
  function wireBack(root, ctx) {
    const b = root.querySelector('[data-back]');
    if (b) b.onclick = () => (history.length > 1 ? history.back() : ctx && ctx.home ? ctx.home() : (location.hash = 'pulse'));
  }
  /* ---------------- Premium ---------------- */
  const PREMIUM_ROWS = [
    ['Pulse na żywo (Solana · BSC · Robinhood)', 'free', 'free'],
    ['Good Coins, Final Stretch, Migrated + filtry', 'free', 'free'],
    ['Viral z X (aktualizacja kilka razy dziennie)', 'free', 'free'],
    ['Ranking traderów i profile', 'free', 'free'],
    ['Profil: do 8 portfeli + karta PnL', 'free', 'free'],
    ['Alerty smart money na żywo (push)', '—', 'soon'],
    ['Do 25 portfeli w Profilu', '—', 'soon'],
    ['Dłuższa historia PnL (90 dni)', '—', 'soon'],
    ['Własne zapisane filtry i presety Pulse', '—', 'soon'],
    ['Viral z X częściej + wcześniejszy dostęp', '—', 'soon'],
    ['Watchlista z alertami ceny', '—', 'soon'],
  ];
  function renderPremium(root, ctx) {
    const C = Object.assign({ enabled: false, regularPrice: '$9.99', promoPrice: '$3.99', promoActive: true, period: 'mies.', trialDays: 3 }, window.KYVO_PREMIUM_CONFIG || {});
    const link = C.promoActive ? C.stripePaymentLinkPromo : C.stripePaymentLinkRegular;
    const live = !!(C.enabled && /^https:\/\//.test(link || ''));
    const S = window.KyvoAuth && window.KyvoAuth.session();
    const cell = (v) => (v === 'free' ? '<span class="pm-ok">✓</span>' : v === 'soon' ? '<span class="pm-soon">wkrótce</span>' : '<span class="mut">—</span>');
    const price = C.promoActive
      ? `<span class="pm-old">${esc(C.regularPrice)}</span><b>${esc(C.promoPrice)}</b><span>/ ${esc(C.period)}</span>`
      : `<b>${esc(C.regularPrice)}</b><span>/ ${esc(C.period)}</span>`;
    root.innerHTML = `
      <div class="lg-head"><button type="button" class="back" data-back aria-label="Wstecz">‹</button><div class="h" style="margin:0">Kyvo Premium</div></div>
      <div class="pm-hero">
        <img src="icons/icon-192.png" width="64" height="64" alt="">
        <div class="pm-badge">✦ PREMIUM · WKRÓTCE</div>
        <h1>Więcej sygnałów, mniej szumu</h1>
        ${C.promoActive ? '<div class="pm-promo">Cena startowa dla pierwszych użytkowników</div>' : ''}
        <div class="pm-price">${price}</div>
        <div class="pm-trial">${esc(C.trialDays)} dni za darmo, potem ${esc(C.promoActive ? C.promoPrice : C.regularPrice)} / ${esc(C.period)} · anulujesz kiedy chcesz</div>
        ${S ? `<button type="button" class="pm-cta" id="pmCta">Rozpocznij ${esc(C.trialDays)} dni za darmo</button>`
            : `<button type="button" class="pm-cta" id="pmCta" disabled style="opacity:.55">Rozpocznij ${esc(C.trialDays)} dni za darmo</button><a class="pm-login" href="#login">🔑 Zaloguj się, żeby włączyć Premium</a>`}
        <div class="pm-note" id="pmNote">${live ? 'Płatność obsługuje zewnętrzny operator płatności (Stripe).' : 'Premium jeszcze nie ruszyło — nic nie sprzedajemy i niczego nie pobieramy.'}</div>
        <div class="pm-pay">Okres próbny wymaga podpięcia karty, Apple Pay lub Google Pay. BLIK nie jest dostępny dla subskrypcji. Bez anulowania przed końcem ${esc(C.trialDays)} dni subskrypcja odnowi się automatycznie co miesiąc.</div>
      </div>
      <div class="card pm-tbl">
        <div class="pm-row pm-h"><div>Funkcja</div><div>Free</div><div class="pm-pcol">Premium</div></div>
        ${PREMIUM_ROWS.map(([f, a, b]) => `<div class="pm-row"><div>${esc(f)}</div><div>${cell(a)}</div><div class="pm-pcol">${cell(b)}</div></div>`).join('')}
      </div>
      <div class="mut" style="font-size:11.5px;line-height:1.5;margin:6px 2px 12px">„Wkrótce” = funkcja w przygotowaniu, jeszcze nie działa. Wszystko z kolumny Free działa już dziś i zostaje za darmo. Cena i lista funkcji mogą się zmienić przed startem. Premium to nie porada finansowa.</div>`;
    wireBack(root, ctx);
    const cta = root.querySelector('#pmCta');
    if (S && cta) cta.onclick = () => {
      if (live) { window.open(link, '_blank', 'noopener'); return; }
      const n = root.querySelector('#pmNote');
      n.innerHTML = '<b>Wkrótce — zapisz się na listę.</b> Napisz na Discordzie, a dam znać, gdy Premium ruszy.';
      n.classList.add('on');
      cta.textContent = 'Wkrótce';
      setTimeout(() => (location.hash = 'kontakt'), 1600);
    };
  }

  /* ---------------- Kontakt ---------------- */
  function renderContact(root, ctx) {
    const C = window.KYVO_CONTACT || {};
    const h = String(C.DISCORD_HANDLE || '').trim();
    const has = h && !/^todo$/i.test(h);
    const inv = String(C.DISCORD_INVITE_URL || '').trim();
    root.innerHTML = `
      <div class="lg-head"><button type="button" class="back" data-back aria-label="Wstecz">‹</button><div class="h" style="margin:0">Kontakt</div></div>
      <div class="card ct-card">
        <div class="ct-ic">💬</div>
        <h2>Chcesz pogadać, pomóc albo współpracować?</h2>
        <p>Napisz do mnie na Discordzie.</p>
        ${has ? `<div class="ct-handle"><span class="mono">${esc(h)}</span><button type="button" class="pf-btn" id="ctCopy">Kopiuj</button></div>` : '<div class="ct-handle mut">Nick na Discordzie pojawi się tu wkrótce.</div>'}
        ${/^https:\/\/(discord\.gg|discord\.com)\//.test(inv) ? `<a class="pm-cta" style="display:block;margin-top:12px" href="${esc(inv)}" target="_blank" rel="noopener noreferrer">Dołącz do Discorda ↗</a>` : ''}
        <div class="mut" style="font-size:11.5px;margin-top:12px;line-height:1.45">Nie mamy formularzy kontaktowych ani newslettera. Nigdy nie wysyłaj nikomu seed phrase ani klucza prywatnego, także „supportowi Kyvo”.</div>
      </div>`;
    wireBack(root, ctx);
    const b = root.querySelector('#ctCopy');
    if (b) b.onclick = async () => {
      try { await navigator.clipboard.writeText(h); b.textContent = 'Skopiowano ✓'; } catch (e) { b.textContent = h; }
    };
  }

  async function clearData() {
    if (!confirm('Usunąć wszystkie dane Kyvo z tej przeglądarki? (portfele w Profilu, nick, filtry, cache)')) return false;
    try { Object.keys(localStorage).filter((k) => k.startsWith('kyvo_')).forEach((k) => localStorage.removeItem(k)); } catch (e) {}
    try { if (window.caches) for (const k of await caches.keys()) await caches.delete(k); } catch (e) {}
    try { localStorage.setItem(OB_KEY, String(Date.now())); } catch (e) {}
    return true;
  }

  window.KyvoLaunch = { renderPremium, renderContact, openOnboard, maybeOnboard, closeOnboard, renderHelp, renderLegal, legalLinks, clearData, isIOS, standalone };
})();
