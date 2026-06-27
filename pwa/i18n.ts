/**
 * Tiny UI-i18n for Learny. The UI language follows the user's *native* language
 * (settings.native) — your mother tongue is the app's language. `de` and `en`
 * are authored in full; `fr`/`es`/`nl` fall back to `en` until translated.
 *
 * Usage:  t('tab.home')               → "Home"
 *         t('home.dayStreak', {n: 5}) → "Tag 5 — stark!"  (de) / "Day 5 — great!" (en)
 *
 * Components read t() during render; the language is set once per render at the
 * App root via setUiLang(settings.native), so any settings change re-renders the
 * whole tree in the right language.
 */

type Dict = Record<string, string>;

const de: Dict = {
  // shared
  'common.next': 'Weiter →',
  'common.back': '← zurück',
  'common.start': "Los geht's",

  // tab bar
  'tab.home': 'Home',
  'tab.archive': 'Archiv',
  'tab.stream': 'Stream',
  'tab.report': 'Report',
  'tab.more': 'Mehr',

  // onboarding
  'onb.welcome': 'Willkommen bei Learny',
  'onb.uiH': 'In welcher Sprache möchtest du Learny nutzen?',
  'onb.uiP': 'Das ist die Sprache der App und deiner Übersetzungen — deine Muttersprache.',
  'onb.langH': 'Welche Sprache möchtest du lernen?',
  'onb.langP': 'Lies jeden Tag echte Texte — vereinfacht auf dein Sprachniveau.',
  'onb.levelH': 'Wie gut bist du schon?',
  'onb.levelP': 'Kein Stress — du kannst dein Sprachniveau jederzeit ändern.',
  'onb.hint.A1': 'Ganz neu — erste Wörter & Sätze',
  'onb.hint.A2': 'Anfänger:in — einfache Sätze',
  'onb.hint.B1': 'Mittelstufe — Alltagstexte',
  'onb.hint.B2': 'Fortgeschritten — komplexere Texte',
  'onb.hint.C1': 'Sehr gut — anspruchsvolle Texte',

  // settings
  'set.title': 'Einstellungen',
  'set.uiLang': 'App-Sprache',
  'set.uiLangHint': 'Sprache der App & Übersetzungen (deine Muttersprache).',
  'set.learn': 'Sprache lernen',
  'set.level': 'Sprachniveau',
  'set.theme': 'Theme',
  'set.backup': 'Daten · Sicherung',
  'set.backupHint':
    'Dein Fortschritt (Streak, Route, Vokabeln) liegt nur auf diesem Gerät. Exportiere ihn vor App-Löschen oder Handywechsel — und importiere ihn am neuen Gerät.',
  'set.export': '⤓ Exportieren',
  'set.import': '⤒ Importieren',
  'set.app': 'App',
  'set.version': 'Version',
  'set.update.idle': 'Auf Updates prüfen',
  'set.update.checking': 'Suche …',
  'set.update.current': 'Aktuell ✓',
  'set.foot': 'Learny · Teil der Sidelearn-Familie · Texte: Wikipedia (CC BY-SA)',
  'set.importOk': 'Importiert ✓ — die App wird neu geladen.',
  'set.importFail': 'Import fehlgeschlagen — ist das eine Learny-Sicherung (.json)?',

  // home
  'home.welcomeBack': 'Willkommen zurück!',
  'home.dayN': 'Tag {n} — stark!',
  'home.aufstiegReady': 'Aufstiegstest bereit · Level {level}',
  'home.subStage': '{stage} · {cleared}/{goal} neue Wörter',
  'home.subQuest': ' · Tagesquest {done}/{total}',
  'home.empty': 'Heute noch keine Lektion für {lang}. Schau später wieder vorbei.',
  'home.questTitle': 'Tagesquest',
  'home.questDoneTitle': 'Tagesquest geschafft!',
  'home.credit': 'Aus den meistgelesenen Wikipedia-Artikeln des Tages · CC BY-SA',
  'home.yourPath': 'Dein Lernpfad',
  'home.learnWords': 'Lerne neue Wörter',
  'home.reviewVocab': 'Wortschatz wiederholen · tippen',
  'home.weekWords': '{cleared}/{goal} diese Woche · tippen',
  'home.unlocked': 'freigeschaltet · tippen',
  'home.fromWords': 'ab {goal} Wörtern',
  'home.seeFullPath': 'Ganzen Lernpfad ansehen →',
  'home.bubbleDone': 'Tagesquest geschafft — Gurki ist stolz!',
  'home.bubbleOne': 'Stark — noch eine Aufgabe!',
  // quest tasks
  'quest.cloze': 'Mach einen Lückentext',
  'quest.vocab': 'Mach einen Vokabeltest',
  'quest.rubrik': 'Lies einen Rubrik-Artikel',
  'quest.articlePlus1': 'Lies einen +1-Artikel',
  'quest.article': 'Lies einen Artikel',
  // tiles
  'tile.topics': 'Artikelrubriken',
  'tile.cloze': 'Lückentext',
  'tile.vocab': 'Vokabeltest',
  'tile.dict': 'Wörterbuch',
  // tests
  'test.aufstieg': 'Aufstiegstest',
  'test.etappe': 'Etappen-Check',
  // route label (also shown on home)
  'route.labelAufstieg': '{level} · Aufstieg',
  'route.labelEtappe': '{level} · Etappe {n}/{total}',
  // hype bubbles
  'hype.0': "Bereit? Heute wird's gut!",
  'hype.1': 'Schön, dass du da bist!',
  'hype.2': 'Komm, wir lesen was Neues.',
  'hype.3': 'Gurki glaubt an dich.',
  'hype.4': 'Kleine Schritte, große Wirkung.',
  'hype.5': 'Ein Häppchen Wissen gefällig?',
  'hype.6': 'Heute schon schlauer als gestern.',
  'hype.7': 'Lesen macht stark — wie eine Gurke.',

  // shared
  'common.backAria': 'Zurück',
  'common.backBtn': 'Zurück',
  'common.continue': 'Weiter',
  'common.doneCheck': 'Fertig ✓',
  'common.readDone': 'gelesen ✓',
  'common.readGo': 'lesen ›',
  'common.readStart': 'Start ›',
  'common.readMore': 'weiter ›',
  'common.also': 'auch: {alt}',
  'common.paragraphs': '{n} Absätze',

  // rubric / area names (shared by Artikelrubriken + Stream)
  'rubrik.all': 'Alle',
  'rubrik.technik': 'Technik',
  'rubrik.technik.sub': 'Erfindungen, Computer …',
  'rubrik.sport': 'Sport',
  'rubrik.sport.sub': 'Fußball, Olympia …',
  'rubrik.geschichte': 'Geschichte',
  'rubrik.geschichte.sub': 'Antike, Mittelalter …',
  'rubrik.gesellschaft': 'Stars & Gesellschaft',
  'rubrik.gesellschaft.sub': 'Promis, Musik, TV …',
  'rubrik.natur': 'Natur & Tiere',
  'rubrik.natur.sub': 'Tiere, Pflanzen …',
  'rubrik.kultur': 'Kultur',
  'rubrik.kultur.sub': 'Musik, Film, Kunst …',
  'rubrik.wissenschaft': 'Wissenschaft',
  'rubrik.wissenschaft.sub': 'Weltraum, Physik …',

  // trainer (Vokabeltest)
  'trainer.title': 'Vokabeltest',
  'trainer.allReviewedH': 'Alles wiederholt!',
  'trainer.allReviewedP': 'Gerade sind keine Wörter fällig. Lies eine Lektion und komm später wieder — die Wiederholungen kommen über die Tage verteilt.',
  'trainer.doneH': 'Session fertig',
  'trainer.doneP': '{score} von {total} richtig.',
  'trainer.qProgress': 'Frage {n} / {total}',
  'trainer.promptPre': 'Was bedeutet ',
  'trainer.promptPost': '?',
  'trainer.dontKnow': 'Weiß nicht',
  'trainer.resOk': 'Aaah — richtig!',
  'trainer.resDunno': 'Schau’s dir an — nächstes Mal sitzt’s!',
  'trainer.resNo': 'Ohh — leider nicht.',
  'trainer.logDetail': '{score}/{total} richtig',

  // surprise (Artikelrubriken)
  'surprise.howRead': 'Wie möchtest du lesen?',
  'surprise.fullArticle': 'Ganzer Artikel',
  'surprise.fullArticleSub': '8 Absätze · mit Quiz pro Absatz',
  'surprise.digest': 'Kurzfassung',
  'surprise.digestSub': 'kompakte Summary · 3 Fragen am Ende',
  'surprise.backToList': 'Zurück zur Liste',
  'surprise.loading': 'Wir suchen einen {area}-Artikel und vereinfachen ihn auf {level} … einen Moment.',
  'surprise.surpriseBtn': 'Überraschung — neuer Artikel',
  'surprise.error': 'Das hat nicht geklappt. Bitte nochmal versuchen.',
  'surprise.empty': 'Hier ist noch nichts vorbereitet — hol dir oben eine Überraschung.',
  'surprise.last14': 'Aus den letzten 14 Tagen',
  'surprise.chooseArea': 'Wähle einen Bereich.',
  'surprise.intro': 'Frisch aus Wikipedia, auf dein Sprachniveau gebracht — die zuletzt vorbereiteten Artikel der Rubrik plus jederzeit eine neue Überraschung.',

  // relative time (stream dividers)
  'time.justNow': 'gerade eben',
  'time.minAgo': 'vor {n} Min',
  'time.hourAgo': 'vor {n} Std',
  'time.dayAgo': 'vor {n} Tg',
};

const en: Dict = {
  'common.next': 'Next →',
  'common.back': '← back',
  'common.start': "Let's go",

  'tab.home': 'Home',
  'tab.archive': 'Archive',
  'tab.stream': 'Stream',
  'tab.report': 'Report',
  'tab.more': 'More',

  'onb.welcome': 'Welcome to Learny',
  'onb.uiH': 'Which language should Learny be in?',
  'onb.uiP': 'This is the language of the app and your translations — your native language.',
  'onb.langH': 'Which language do you want to learn?',
  'onb.langP': 'Read real texts every day — simplified to your level.',
  'onb.levelH': 'How good are you already?',
  'onb.levelP': 'No stress — you can change your level anytime.',
  'onb.hint.A1': 'Brand new — first words & sentences',
  'onb.hint.A2': 'Beginner — simple sentences',
  'onb.hint.B1': 'Intermediate — everyday texts',
  'onb.hint.B2': 'Advanced — more complex texts',
  'onb.hint.C1': 'Very good — demanding texts',

  'set.title': 'Settings',
  'set.uiLang': 'App language',
  'set.uiLangHint': 'Language of the app & translations (your native language).',
  'set.learn': 'Learning language',
  'set.level': 'Level',
  'set.theme': 'Theme',
  'set.backup': 'Data · Backup',
  'set.backupHint':
    'Your progress (streak, route, vocabulary) lives only on this device. Export it before deleting the app or switching phones — and import it on the new one.',
  'set.export': '⤓ Export',
  'set.import': '⤒ Import',
  'set.app': 'App',
  'set.version': 'Version',
  'set.update.idle': 'Check for updates',
  'set.update.checking': 'Checking …',
  'set.update.current': 'Up to date ✓',
  'set.foot': 'Learny · part of the Sidelearn family · Texts: Wikipedia (CC BY-SA)',
  'set.importOk': 'Imported ✓ — the app will reload.',
  'set.importFail': 'Import failed — is this a Learny backup (.json)?',

  // home
  'home.welcomeBack': 'Welcome back!',
  'home.dayN': 'Day {n} — great!',
  'home.aufstiegReady': 'Level-up test ready · Level {level}',
  'home.subStage': '{stage} · {cleared}/{goal} new words',
  'home.subQuest': ' · Daily quest {done}/{total}',
  'home.empty': 'No lesson yet for {lang} today. Check back later.',
  'home.questTitle': 'Daily quest',
  'home.questDoneTitle': 'Daily quest done!',
  'home.credit': "From the day's most-read Wikipedia articles · CC BY-SA",
  'home.yourPath': 'Your learning path',
  'home.learnWords': 'Learn new words',
  'home.reviewVocab': 'Review vocabulary · tap',
  'home.weekWords': '{cleared}/{goal} this week · tap',
  'home.unlocked': 'unlocked · tap',
  'home.fromWords': 'from {goal} words',
  'home.seeFullPath': 'See the whole path →',
  'home.bubbleDone': 'Daily quest done — Gurki is proud!',
  'home.bubbleOne': 'Nice — one more task!',
  'quest.cloze': 'Do a cloze exercise',
  'quest.vocab': 'Do a vocab quiz',
  'quest.rubrik': 'Read a topic article',
  'quest.articlePlus1': 'Read a +1 article',
  'quest.article': 'Read an article',
  'tile.topics': 'Article topics',
  'tile.cloze': 'Cloze',
  'tile.vocab': 'Vocab quiz',
  'tile.dict': 'Dictionary',
  'test.aufstieg': 'Level-up test',
  'test.etappe': 'Stage check',
  'route.labelAufstieg': '{level} · Level-up',
  'route.labelEtappe': '{level} · Stage {n}/{total}',
  'hype.0': "Ready? Today's gonna be good!",
  'hype.1': 'Good to see you!',
  'hype.2': "Let's read something new.",
  'hype.3': 'Gurki believes in you.',
  'hype.4': 'Small steps, big effect.',
  'hype.5': 'A little bite of knowledge?',
  'hype.6': 'Smarter today than yesterday.',
  'hype.7': 'Reading makes you strong — like a pickle.',

  'common.backAria': 'Back',
  'common.backBtn': 'Back',
  'common.continue': 'Continue',
  'common.doneCheck': 'Done ✓',
  'common.readDone': 'read ✓',
  'common.readGo': 'read ›',
  'common.readStart': 'Start ›',
  'common.readMore': 'continue ›',
  'common.also': 'also: {alt}',
  'common.paragraphs': '{n} paragraphs',

  'rubrik.all': 'All',
  'rubrik.technik': 'Tech',
  'rubrik.technik.sub': 'Inventions, computers …',
  'rubrik.sport': 'Sport',
  'rubrik.sport.sub': 'Football, Olympics …',
  'rubrik.geschichte': 'History',
  'rubrik.geschichte.sub': 'Antiquity, Middle Ages …',
  'rubrik.gesellschaft': 'Stars & society',
  'rubrik.gesellschaft.sub': 'Celebs, music, TV …',
  'rubrik.natur': 'Nature & animals',
  'rubrik.natur.sub': 'Animals, plants …',
  'rubrik.kultur': 'Culture',
  'rubrik.kultur.sub': 'Music, film, art …',
  'rubrik.wissenschaft': 'Science',
  'rubrik.wissenschaft.sub': 'Space, physics …',

  'trainer.title': 'Vocab quiz',
  'trainer.allReviewedH': 'All reviewed!',
  'trainer.allReviewedP': 'No words are due right now. Read a lesson and come back later — reviews are spread out over the days.',
  'trainer.doneH': 'Session done',
  'trainer.doneP': '{score} of {total} correct.',
  'trainer.qProgress': 'Question {n} / {total}',
  'trainer.promptPre': 'What does ',
  'trainer.promptPost': ' mean?',
  'trainer.dontKnow': "Don't know",
  'trainer.resOk': 'Yesss — correct!',
  'trainer.resDunno': 'Take a look — you’ll get it next time!',
  'trainer.resNo': 'Ohh — not quite.',
  'trainer.logDetail': '{score}/{total} correct',

  'surprise.howRead': 'How would you like to read?',
  'surprise.fullArticle': 'Full article',
  'surprise.fullArticleSub': '8 paragraphs · quiz after each',
  'surprise.digest': 'Summary',
  'surprise.digestSub': 'compact summary · 3 questions at the end',
  'surprise.backToList': 'Back to the list',
  'surprise.loading': 'Finding a {area} article and simplifying it to {level} … one moment.',
  'surprise.surpriseBtn': 'Surprise — new article',
  'surprise.error': "That didn't work. Please try again.",
  'surprise.empty': 'Nothing prepared here yet — grab a surprise above.',
  'surprise.last14': 'From the last 14 days',
  'surprise.chooseArea': 'Choose a topic.',
  'surprise.intro': 'Fresh from Wikipedia, brought to your level — the most recently prepared articles of the topic plus a new surprise anytime.',

  'time.justNow': 'just now',
  'time.minAgo': '{n} min ago',
  'time.hourAgo': '{n} h ago',
  'time.dayAgo': '{n} d ago',
};

const DICTS: Record<string, Dict> = { de, en };

let current = 'de';

/** Set the active UI language (call once per render at the App root). */
export function setUiLang(lang: string): void {
  current = lang;
}

export function uiLang(): string {
  return current;
}

/** Translate a key, interpolating {placeholders}. Falls back current → en → de → key. */
export function t(key: string, vars?: Record<string, string | number>): string {
  const s = DICTS[current]?.[key] ?? en[key] ?? de[key] ?? key;
  if (!vars) return s;
  return s.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : `{${k}}`));
}
