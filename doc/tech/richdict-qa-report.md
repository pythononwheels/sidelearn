# richdict — LLM-Inhalts-QA (gemini-3.5-flash)

Stand: 2026-06-30. **276 Findings** über 25 Sprachpaare (Stichprobe ~40 Einträge/Dict).

## Nach Fehlertyp

- **MEANING** (wrong_meaning): 118
- **EXAMPLE** (bad_example): 75
- **POS** (wrong_pos): 49
- **EXD** (bad_exd): 29
- **ORDER** (wrong_sense_order): 5

## Nach Sprachpaar

- de-en: 11
- de-es: 15
- de-fr: 11
- de-it: 23
- de-nl: 9
- en-de: 12
- en-es: 10
- en-fr: 9
- en-it: 13
- en-nl: 10
- es-de: 10
- es-en: 9
- es-it: 9
- fr-de: 12
- fr-en: 9
- fr-es: 11
- fr-it: 9
- fr-nl: 11
- it-de: 10
- it-nl: 14
- nl-de: 9
- nl-en: 10
- nl-es: 10
- nl-fr: 9
- nl-it: 11

---

## de-en  (11)

### `zu` — POS
- **aktuell:** to, too (preposition) | closed (adjective)
- **Problem:** The English translation 'too' is an adverb, but it is grouped under the part of speech 'preposition' along with 'to'.
- **Fix:** Separate 'to' (preposition) and 'too' (adverb) into two distinct senses with their respective parts of speech.

### `fahr` — EXAMPLE
- **aktuell:** drive (verb) | go (verb)
- **Problem:** The example 'Kannst du das Auto fahren?' uses the infinitive verb form 'fahren' instead of the imperative headword 'fahr'.
- **Fix:** Change the example to use the imperative form, for example: 'Fahr bitte langsamer!' (Please drive slower!).

### `offenbar` — POS
- **aktuell:** obviously (adverb) | manifestly (adverb)
- **Problem:** In the second sense ('manifestly'), the example 'Die Wahrheit ist offenbar' uses 'offenbar' as a predicate adjective, but the part of speech is listed as 'adverb'.
- **Fix:** Change the part of speech for the second sense to 'adjective'.

### `liebes` — EXAMPLE
- **aktuell:** dear (adjective) | beloved (adjective)
- **Problem:** The German example 'Er traf seine liebes Kind.' is grammatically incorrect because 'Kind' is neuter and requires the possessive determiner 'sein', not 'seine'.
- **Fix:** Change the example to 'Er traf sein liebes Kind.'

### `idioten` — EXAMPLE
- **aktuell:** idiots (noun) | fools (noun)
- **Problem:** The second example 'Er benahm sich wie ein Idiot.' uses the singular form 'Idiot' instead of the plural headword 'Idioten'.
- **Fix:** Change the example to use the plural form, e.g., 'Sie benahmen sich wie Idioten.' (They behaved like fools.).

### `regel` — MEANING
- **aktuell:** rule (noun) | mainstream (noun)
- **Problem:** The German word 'Regel' (rule) does not mean 'mainstream', and the example 'Das Buch war kein Mainstream.' does not even contain the headword.
- **Fix:** Remove this sense entirely, or replace it with a correct secondary meaning of 'Regel' (such as 'period/menstruation' or 'norm') and provide a matching example.

### `hosen` — POS
- **aktuell:** trousers (noun)
- **Problem:** The headword is lowercase and in the plural form. German nouns must be capitalized, and the standard dictionary lemma should be singular ('Hose').
- **Fix:** Change the headword to 'Hose'.

### `daheim` — MEANING
- **aktuell:** at home (adverb)
- **Problem:** The alternative translation 'homeward' indicates direction (towards home), whereas 'daheim' strictly means 'at home' (location).
- **Fix:** Remove 'homeward' from the alternative translations.

### `schließ` — POS
- **aktuell:** closure (noun)
- **Problem:** The headword 'schließ' is a verb stem/imperative, but the definition 'closure' and the example sentence use the noun 'Schließung'.
- **Fix:** Change the headword to 'Schließung' (capitalized noun).

### `absolute` — EXAMPLE
- **aktuell:** absolute (adjective) | complete (adjective)
- **Problem:** The German example 'Das ist absolute Unsinn.' is grammatically incorrect because 'Unsinn' is masculine, requiring the strong masculine ending 'absoluter'. Additionally, the lemma should be the uninflected adjective 'absolut'.
- **Fix:** Change the headword to 'absolut' and the example to 'Das ist absoluter Unsinn.'

### `donner` — POS
- **aktuell:** Thunder (noun) | To thunder (verb)
- **Problem:** The second sense lists 'To thunder' as a verb, but 'Donner' is a noun. The German verb is 'donnern'. Also, the headword 'donner' must be capitalized as 'Donner'.
- **Fix:** Capitalize the headword to 'Donner' and remove the verb sense (or change it to a noun sense).

## de-es  (15)

### `passen` — MEANING
- **aktuell:** quedar bien (verbo) | convenir (verbo) | pasar (verbo)
- **Problem:** The third sense 'pasar' with the example 'Die Zeit passt schnell' is incorrect. 'passen' cannot be used to express the passage of time; the correct German verb is 'vergehen' ('Die Zeit vergeht schnell').
- **Fix:** Remove the third sense 'pasar' and its corresponding example.

### `eis` — MEANING
- **aktuell:** hielo (sustantivo)
- **Problem:** The translation given is 'hielo' (ice), but the example 'Ich möchte ein Eis' and its translation 'Quiero un helado' refer to 'helado' (ice cream).
- **Fix:** Change the translation to 'helado' (or 'hielo, helado') or change the example to one illustrating 'hielo' (e.g., 'Ich möchte Eis in mein Getränk').

### `jahre` — POS
- **aktuell:** años (sustantivo)
- **Problem:** German nouns must always be capitalized. The headword 'jahre' should be capitalized as 'Jahre' (or preferably use the singular lemma 'Jahr'). This capitalization error also applies to other nouns in the list: 'schwester', 'rede', 'onkel', 'monate', 'eis', 'soldat', 'trottel', 'pizza', and 'schnee'.
- **Fix:** Capitalize the headword to 'Jahre' (or change to 'Jahr') and ensure all German nouns are capitalized.

### `zahle` — POS
- **aktuell:** números (sustantivo)
- **Problem:** The headword 'zahle' is a verb form, but it is translated as the plural noun 'números'. German nouns must be capitalized and in the singular lemma form.
- **Fix:** Change the headword to 'Zahl' (noun, capitalized) and the translation to 'número' (singular).

### `ratte` — POS
- **aktuell:** rata (sustantivo)
- **Problem:** German nouns must be capitalized. 'ratte' should be 'Ratte'.
- **Fix:** Capitalize the headword to 'Ratte'.

### `doctor` — MEANING
- **aktuell:** doctor (sustantivo)
- **Problem:** The German word is spelled 'Doktor' (with a 'k' and capitalized), not 'doctor'.
- **Fix:** Change the headword to 'Doktor'.

### `pilot` — POS
- **aktuell:** piloto (sustantivo)
- **Problem:** German nouns must be capitalized. 'pilot' should be 'Pilot'.
- **Fix:** Capitalize the headword to 'Pilot'.

### `audrey` — POS
- **aktuell:** Audrey (nombre propio)
- **Problem:** German proper nouns must be capitalized. 'audrey' should be 'Audrey'.
- **Fix:** Capitalize the headword to 'Audrey'.

### `orte` — POS
- **aktuell:** lugares (sustantivo)
- **Problem:** The headword 'orte' is plural and lowercase. German nouns must be capitalized and in their singular lemma form.
- **Fix:** Change the headword to 'Ort' and the translation to 'lugar' (singular).

### `aktion` — POS
- **aktuell:** acción (sustantivo) | oferta (sustantivo)
- **Problem:** German nouns must be capitalized. 'aktion' should be 'Aktion'.
- **Fix:** Capitalize the headword to 'Aktion'.

### `blume` — POS
- **aktuell:** flor (sustantivo) | espuma (sustantivo)
- **Problem:** German nouns must be capitalized. 'blume' should be 'Blume'.
- **Fix:** Capitalize the headword to 'Blume'.

### `sprung` — POS
- **aktuell:** salto (sustantivo)
- **Problem:** German nouns must be capitalized. 'sprung' should be 'Sprung'.
- **Fix:** Capitalize the headword to 'Sprung'.

### `leine` — POS
- **aktuell:** cuerda (sustantivo) | correa (sustantivo)
- **Problem:** German nouns must be capitalized. 'leine' should be 'Leine'.
- **Fix:** Capitalize the headword to 'Leine'.

### `trinkgeld` — POS
- **aktuell:** propina (sustantivo)
- **Problem:** German nouns must be capitalized. 'trinkgeld' should be 'Trinkgeld'.
- **Fix:** Capitalize the headword to 'Trinkgeld'.

### `wellen` — POS
- **aktuell:** olas (sustantivo)
- **Problem:** The headword 'wellen' is plural and lowercase. German nouns must be capitalized and in their singular lemma form.
- **Fix:** Change the headword to 'Welle' and the translation to 'ola' (singular).

## de-fr  (11)

### `zu` — MEANING
- **aktuell:** à (préposition) | trop (adverbe) | fermement (adverbe)
- **Problem:** In the third sense, 'zu' in 'Die Tür ist zu' means 'fermé' (closed), not 'fermement' (firmly).
- **Fix:** Change the translation to 'fermé' and the part of speech to 'adjectif'.

### `ihre` — POS
- **aktuell:** son, sa, ses (pronom possessif) | leur, leurs (pronom possessif)
- **Problem:** 'son, sa, ses' and 'leur, leurs' are possessive determiners (déterminants possessifs), not possessive pronouns (pronoms possessifs).
- **Fix:** Change the part of speech to 'déterminant possessif'.

### `ihre` — EXAMPLE
- **aktuell:** son, sa, ses (pronom possessif) | leur, leurs (pronom possessif)
- **Problem:** The German example 'Das ist ihre Kinder.' is grammatically incorrect because 'Kinder' is plural.
- **Fix:** Change the example to 'Das sind ihre Kinder.' and the translation to 'Ce sont leurs enfants.'

### `stimmt` — MEANING
- **aktuell:** c'est exact (interjection) | avoir raison (verbe)
- **Problem:** 'Du stimmst' is not correct German for 'Tu as raison' (which is 'Du hast recht'). 'Stimmen' cannot be used with a person as the subject to mean 'to be right'.
- **Fix:** Remove the second sense or replace it with a correct meaning of 'stimmen' (e.g., 'voter' or 'accorder').

### `jack` — MEANING
- **aktuell:** veste (nom)
- **Problem:** The headword is written as 'jack', but the German word for 'veste' is 'Jacke'.
- **Fix:** Change the headword to 'Jacke'.

### `schluss` — EXAMPLE
- **aktuell:** fin (nom) | fermeture (nom) | conclusion (nom)
- **Problem:** The example 'Das ist das Ende.' does not contain the headword 'Schluss'.
- **Fix:** Change the example to 'Jetzt ist Schluss!' (C'est fini !).

### `fern` — POS
- **aktuell:** lointain (adjectif) | télévision (nom)
- **Problem:** 'fern' is not a noun meaning 'télévision'. In 'Ich sehe fern', 'fern' is a verbal particle belonging to the separable verb 'fernsehen'.
- **Fix:** Remove this sense, as 'fern' as an independent word does not mean 'télévision'.

### `aufnahme` — MEANING
- **aktuell:** début (nom) | réception (nom) | enregistrement (nom)
- **Problem:** The translation 'début' for 'Aufnahme' in the context of a film is incorrect. 'Aufnahme des Films' refers to the shooting or recording of the film (tournage/enregistrement).
- **Fix:** Change the translation to 'tournage' or 'enregistrement' and update the French example translation accordingly.

### `steele` — MEANING
- **aktuell:** acier (nom)
- **Problem:** The German word for steel is 'Stahl'. 'Steele' is not a German noun.
- **Fix:** Change the headword to 'Stahl', the translation to 'acier', and the example to 'Das Messer ist aus Stahl gemacht.'

### `vorgehen` — MEANING
- **aktuell:** procéder (verbe) | continuer (verbe) | arriver (verbe)
- **Problem:** The translations 'continuer' and 'arriver' are incorrect. Additionally, the examples use the capitalized noun 'Vorgehen' (procedure/approach) while the part of speech is listed as 'verbe'.
- **Fix:** Remove these incorrect senses. If keeping the noun 'Vorgehen', list it as a noun meaning 'procédure' or 'approche'.

### `gerechnet` — EXAMPLE
- **aktuell:** calculé (participe passé) | inclus (préposition)
- **Problem:** The German example 'Wir fahren 2023 gerechnet' is ungrammatical and does not make sense in German.
- **Fix:** Remove this sense or replace it with a natural expression, such as 'mit etwas gerechnet' (expected) or 'ab heute gerechnet' (counting from today).

## de-it  (23)

### `ihrer` — EXAMPLE
- **aktuell:** di lei (pronome) | lei (pronome)
- **Problem:** The German sentence 'Ich kenne sie, aber nicht ihrer.' is ungrammatical. The verb 'kennen' requires the accusative case ('sie'), not the genitive ('ihrer').
- **Fix:** Remove the second sense or use a correct genitive example, such as 'Wir gedachten ihrer.' (Ci ricordammo di lei).

### `jack` — MEANING
- **aktuell:** giacca (sostantivo)
- **Problem:** The headword is misspelled and lowercase. It should be 'Jacke' (noun, capitalized) to match the translation 'giacca' and the example sentence.
- **Fix:** Change the headword to 'Jacke'.

### `indem` — MEANING
- **aktuell:** mentre (congiunzione)
- **Problem:** The Italian translation 'mentre' (while) is incorrect or obsolete for 'indem'. 'indem' is a modal conjunction meaning 'by doing something' or 'in that', typically translated into Italian using a gerund (as correctly done in the example 'usando').
- **Fix:** Change the translation to 'attraverso il fatto che' or indicate that it corresponds to a gerund construction.

### `weiße` — EXAMPLE
- **aktuell:** bianco/a (aggettivo)
- **Problem:** The German example 'Das ist ein weiße Haus.' is grammatically incorrect. It should be 'Das ist ein weißes Haus.' (neuter nominative with indefinite article).
- **Fix:** Change the example to 'Das ist ein weißes Haus.' or use 'weiße' with a feminine noun, e.g., 'Das ist eine weiße Katze.'

### `ted` — MEANING
- **aktuell:** tedesco (nome)
- **Problem:** The headword 'ted' is not a German word. The German word for 'tedesco' (German language) is 'Deutsch'. The example 'Er spricht Ted.' is completely incorrect.
- **Fix:** Change the headword to 'Deutsch' and the example to 'Er spricht Deutsch.'

### `montag` — MEANING
- **aktuell:** lunedì (sostantivo)
- **Problem:** In German, all nouns must be capitalized. The headword should be 'Montag'.
- **Fix:** Change the headword to 'Montag'.

### `besseren` — MEANING
- **aktuell:** migliorare (verbo)
- **Problem:** The headword 'besseren' is an inflected form of the adjective 'besser'. However, the translation 'migliorare' and the example sentence use the verb 'verbessern'.
- **Fix:** Change the headword to 'verbessern'.

### `laß` — POS
- **aktuell:** lascia (verbo)
- **Problem:** The headword is an inflected verb form in outdated spelling. The lemma should be the infinitive 'lassen'.
- **Fix:** lassen

### `linie` — EXAMPLE
- **aktuell:** linea (sostantivo) | fila (sostantivo)
- **Problem:** German nouns must be capitalized ('Linie'). Furthermore, 'Linie' is not used for a queue of people; 'Schlange' or 'Reihe' is correct. 'In einer langen Linie anstehen' is unnatural.
- **Fix:** Linie

### `carol` — MEANING
- **aktuell:** carol (nome proprio)
- **Problem:** 'Carol' is an English proper name, not a standard German vocabulary word.
- **Fix:** remove the entry

### `widerstand` — POS
- **aktuell:** resistenza (sostantivo) | opposizione (sostantivo)
- **Problem:** German nouns must be capitalized.
- **Fix:** Widerstand

### `schnapp` — MEANING
- **aktuell:** schiocco (sostantivo)
- **Problem:** 'Schnapp' is not a standard German noun meaning 'schiocco'. The example sentence 'Mit einem Schnapp...' is unnatural.
- **Fix:** schnappen

### `rad` — POS
- **aktuell:** bicicletta (sostantivo) | ruota (sostantivo)
- **Problem:** German nouns must be capitalized.
- **Fix:** Rad

### `persönlichen` — POS
- **aktuell:** personale (aggettivo)
- **Problem:** The headword is an inflected adjective form. The lemma should be 'persönlich'.
- **Fix:** persönlich

### `toast` — POS
- **aktuell:** toast (sostantivo)
- **Problem:** German nouns must be capitalized.
- **Fix:** Toast

### `teenager` — POS
- **aktuell:** adolescente (sostantivo)
- **Problem:** German nouns must be capitalized.
- **Fix:** Teenager

### `arten` — POS
- **aktuell:** tipi (sostantivo) | specie (sostantivo)
- **Problem:** The headword is plural and lowercase. The lemma should be the singular capitalized noun 'Art'.
- **Fix:** Art

### `beschreibung` — POS
- **aktuell:** descrizione (sostantivo)
- **Problem:** German nouns must be capitalized.
- **Fix:** Beschreibung

### `rannte` — POS
- **aktuell:** corse (verbo)
- **Problem:** The headword is an inflected verb form (past tense). The lemma should be the infinitive 'rennen'.
- **Fix:** rennen

### `erhält` — POS
- **aktuell:** riceve (verbo) | ottiene (verbo)
- **Problem:** The headword is an inflected verb form. The lemma should be the infinitive 'erhalten'.
- **Fix:** erhalten

### `stella` — MEANING
- **aktuell:** stella (sostantivo)
- **Problem:** The German headword is written as 'stella' (which is Italian), but the German word is 'Stern'.
- **Fix:** Stern

### `angehalten` — POS
- **aktuell:** fermato (verbo) | sospeso (verbo)
- **Problem:** The headword is a past participle. The lemma should be the infinitive 'anhalten'.
- **Fix:** anhalten

### `schadet` — POS
- **aktuell:** danneggiare (verbo)
- **Problem:** The headword is an inflected verb form. The lemma should be the infinitive 'schaden'.
- **Fix:** schaden

## de-nl  (9)

### `wirklich` — MEANING
- **aktuell:** echt (bijwoord) | werkelijk (bijwoord) | daadwerkelijk (bijwoord)
- **Problem:** The Dutch adverb 'daadwerkelijk' cannot be used as an interjection/discourse marker to translate 'wirklich' in the sentence 'Wirklich, ich meine es ernst.'
- **Fix:** Replace 'daadwerkelijk' with 'echt' or 'werkelijk' and update the example translation to 'Echt, ik meen het serieus.'

### `fahre` — EXAMPLE
- **aktuell:** ik rijd (werkwoord) | ik ga (werkwoord)
- **Problem:** The second example 'Wir fahren in den Urlaub.' uses the plural form 'fahren' instead of the singular headword form 'fahre'.
- **Fix:** Change the German example to 'Ich fahre in den Urlaub.' and the Dutch translation to 'Ik ga op vakantie.'

### `passen` — EXAMPLE
- **aktuell:** passen (werkwoord) | passen op (werkwoord)
- **Problem:** The German example 'Kannst du auf das Kind passen?' is incorrect. The correct verb for looking after someone is 'aufpassen' ('Kannst du auf das Kind aufpassen?').
- **Fix:** Change the example to 'Kannst du auf das Kind aufpassen?' and update the headword to 'aufpassen', or use a different example for 'passen' (e.g., 'Diese Hose passt mir nicht.').

### `schaffst` — EXAMPLE
- **aktuell:** slagen (werkwoord) | creëren (werkwoord)
- **Problem:** The second example 'Er schafft neue Welten.' uses the third-person singular form 'schafft' instead of the second-person singular headword 'schaffst'.
- **Fix:** Change the German example to 'Du schaffst neue Welten.' and the Dutch translation to 'Jij creëert nieuwe werelden.'

### `kim` — MEANING
- **aktuell:** horizon (zelfstandig naamwoord)
- **Problem:** The German word for horizon (nautical) is spelled 'Kimm' (with double 'm' and capitalized). 'kim' is not a correct German word.
- **Fix:** Change the headword to 'Kimm'.

### `staub` — MEANING
- **aktuell:** stof (zelfstandig naamwoord) | poeder (zelfstandig naamwoord)
- **Problem:** The translation 'poeder' for 'Staub' is incorrect. 'Staub' means 'dust' ('stof'). 'Staubzucker' is a compound word meaning 'powdered sugar', but 'Staub' itself does not mean 'powder'.
- **Fix:** Remove the second sense ('poeder') and its example.

### `derselben` — EXAMPLE
- **aktuell:** dezelfde (voornaamwoord)
- **Problem:** The German example 'Das ist das Buch derselben Autors.' is grammatically incorrect because 'Autors' is masculine genitive and requires 'desselben'. 'derselben' requires a feminine genitive noun.
- **Fix:** Change the example to 'Das ist das Buch derselben Autorin.' and the Dutch translation to 'Dit is het boek van dezelfde auteur.'

### `hielten` — EXAMPLE
- **aktuell:** hielden vast (werkwoord) | hielden tegen (werkwoord)
- **Problem:** The German example 'Die Polizei hielten den Verkehr an.' is grammatically incorrect because 'Die Polizei' is a singular noun in German and requires the singular verb form 'hielt'.
- **Fix:** Change the subject to plural, e.g., 'Die Polizisten hielten den Verkehr an.'

### `verschafft` — MEANING
- **aktuell:** bezorgd (werkwoord) | verzekerd (werkwoord)
- **Problem:** The Dutch translations 'bezorgd' and 'verzekerd' are incorrect for 'verschafft'. 'sich Zugang verschaffen' translates to 'zich toegang verschaften' (not bezorgd), and 'sich Respekt verschaffen' translates to 'respect afdwingen' (not verzekeren).
- **Fix:** Change the translations to 'verschaft' and 'dwingt af' respectively.

## en-de  (12)

### `chris` — MEANING
- **aktuell:** Christus (Eigenname)
- **Problem:** Chris is a common short name for Christopher or Christine, not 'Christus' (which translates to 'Christ' in English).
- **Fix:** Change the German translation to 'Chris' and adjust the example translation.

### `lf` — EXAMPLE
- **aktuell:** linke Seite (Substantiv)
- **Problem:** The headword 'lf' is not a standard English word, and the example sentence uses 'left side' instead of 'lf'.
- **Fix:** Change the headword to 'left' or 'left side' and update the entry.

### `los` — MEANING
- **aktuell:** verlieren (Verb) | los (Adjektiv)
- **Problem:** The headword 'los' is a typo for the English word 'lose' (or 'loose'). 'los' is not an English word.
- **Fix:** Change the headword to 'lose' and remove the incorrect German adjective sense 'los'.

### `accepted` — EXD
- **aktuell:** akzeptiert (Partizip II) | zugesagt (Partizip II)
- **Problem:** The German translation 'Sie sagte die Einladung zu' is ungrammatical because 'zusagen' requires the dative case ('der Einladung').
- **Fix:** Change the German translation of the example to 'Sie nahm die Einladung an' or 'Sie sagte der Einladung zu'.

### `arrived` — MEANING
- **aktuell:** ankam (Präteritum)
- **Problem:** The German translation 'ankam' is a subordinate-clause verb form. The standard translation for 'arrived' should be 'kam an' or 'ist angekommen'.
- **Fix:** Change the German translation to 'kam an' or 'angekommen'.

### `bitch` — EXAMPLE
- **aktuell:** Hündin (Substantiv) | Miststück (Substantiv)
- **Problem:** The phrase 'female bitch' in the English example is redundant and unnatural, as 'bitch' already means a female canine.
- **Fix:** Change the example to 'The dog is a bitch.' or another natural sentence.

### `program` — EXD
- **aktuell:** Programm (Substantiv) | Sendung (Substantiv)
- **Problem:** The German translation 'auf der Fernsehsendung' is incorrect. It should be 'im Fernsehen' or 'im Fernsehprogramm'.
- **Fix:** Change 'auf der Fernsehsendung' to 'im Fernsehen' or 'im Fernsehprogramm'.

### `partners` — EXAMPLE
- **aktuell:** Partner (Substantiv) | Mitglied (Substantiv)
- **Problem:** The headword 'partners' is plural, but the first example uses the singular 'partner'. Additionally, 'partners in the same club' in the second sense is unnatural English.
- **Fix:** Change the first example to use the plural form: 'They are business partners.' (German: 'Sie sind Geschäftspartner.') and revise or remove the second sense.

### `occurred` — EXD
- **aktuell:** geschah (Verb) | passierte (Verb)
- **Problem:** The German translation 'Es passierte mir, dass...' is incorrect for 'It occurred to me' (which means 'Es fiel mir ein' or 'Mir kam der Gedanke').
- **Fix:** Change the German translation of the example to: 'Es fiel mir ein, dass ich meine Schlüssel vergessen hatte.'

### `concept` — EXD
- **aktuell:** Begriff (Substantiv) | Vorstellung (Substantiv)
- **Problem:** The German translation 'Das ist ein schwieriger Begriff zu verstehen' is ungrammatical and a literal translation of the English structure.
- **Fix:** Change the German translation to: 'Dies ist ein schwer zu verstehender Begriff.' or 'Dieser Begriff ist schwer zu verstehen.'

### `planets` — EXAMPLE
- **aktuell:** Planeten (Substantiv)
- **Problem:** The headword 'planets' is plural, but the example 'Mars is a red planet' uses the singular form.
- **Fix:** Change the example to use the plural form: 'There are eight planets in our solar system.' (German: 'Es gibt acht Planeten in unserem Sonnensystem.')

### `mates` — EXAMPLE
- **aktuell:** Freunde (Substantiv) | Partner (Substantiv)
- **Problem:** The collocation 'business mate' is unnatural in English; 'business partner' is the correct term.
- **Fix:** Change the second sense example to a natural context, such as 'They have been mates since childhood.' with the German translation 'Sie sind seit der Kindheit Kumpel.'

## en-es  (10)

### `like` — EXAMPLE
- **aktuell:** gustar (verbo) | como (preposición) | similar (adjetivo)
- **Problem:** The example 'They are much alike.' uses the word 'alike' instead of the headword 'like'.
- **Fix:** Use an example containing 'like' as an adjective, such as 'They are of like mind.', or remove this sense.

### `play` — EXD
- **aktuell:** jugar (verbo) | tocar (verbo) | actuar (verbo)
- **Problem:** The Spanish translation 'Él actuará en el personaje principal' is grammatically incorrect and unnatural.
- **Fix:** Change the translation to 'Él interpretará al personaje principal' or 'Él hará el papel del personaje principal'.

### `spot` — ORDER
- **aktuell:** localizar (verbo) | lugar (sustantivo)
- **Problem:** The noun sense 'lugar' is much more common and learned earlier than the verb sense 'localizar'.
- **Fix:** Move the noun sense 'lugar' to the first position.

### `russian` — POS
- **aktuell:** ruso (adjetivo) | ruso/a (sustantivo)
- **Problem:** The parts of speech are mismatched with the examples: 'He speaks Russian' uses 'Russian' as a noun, but it is labeled as an adjective. 'She is Russian' uses 'Russian' as an adjective, but it is labeled as a noun.
- **Fix:** Swap the parts of speech or adjust the examples to match the correct grammatical category.

### `desert` — ORDER
- **aktuell:** abandonar (verbo) | desierto (sustantivo)
- **Problem:** The noun sense 'desierto' is the dominant everyday sense and should precede the verb sense 'abandonar'.
- **Fix:** Move the noun sense 'desierto' to the first position.

### `falling` — MEANING
- **aktuell:** caer (verbo)
- **Problem:** The translation 'caer' is the infinitive, which translates 'fall', not 'falling'.
- **Fix:** Change the headword to 'fall', or change the translation of 'falling' to 'cayendo' (gerund) or 'caída' (noun).

### `kissing` — MEANING
- **aktuell:** besos (sustantivo)
- **Problem:** The translation 'besos' means 'kisses' (plural noun). 'Kissing' refers to the action of kissing, which is translated as 'besarse' or 'el besar'.
- **Fix:** Change the translation to 'besarse' (verbo) or 'el besar' (sustantivo).

### `marine` — EXAMPLE
- **aktuell:** marino (adjetivo) | infante de marina (sustantivo)
- **Problem:** The sentence 'He served as a marine in the army' is contradictory because marines serve in the Marine Corps or Navy, not the Army.
- **Fix:** Change the example to 'He served as a marine in the Marine Corps.' and update the translation to 'Sirvió como infante de marina en el Cuerpo de Marines.'

### `believing` — EXAMPLE
- **aktuell:** creyendo (verbo)
- **Problem:** The verb 'believe' is a stative verb and is grammatically incorrect or highly unnatural when used in the progressive form ('was believing') in this context.
- **Fix:** Use a natural sentence where 'believing' is a gerund, such as 'Believing in yourself is important.' (Creer en uno mismo es importante.)

### `piper` — MEANING
- **aktuell:** flautista (sustantivo) | tubería (sustantivo)
- **Problem:** The second sense 'tubería' is incorrect. 'Piper' is a person who plays a pipe (flautista/gaitero). 'Tubería' is the translation of 'pipe'.
- **Fix:** Remove the second sense entirely, or change the headword to 'pipe' if 'tubería' is intended.

## en-fr  (9)

### `couldn` — EXAMPLE
- **aktuell:** ne pas pouvoir (verbe)
- **Problem:** The example sentence uses 'couldn't' instead of the headword 'couldn'.
- **Fix:** couldn't

### `condition` — MEANING
- **aktuell:** condition (nom) | état (nom) | situation (nom)
- **Problem:** The French translation 'condition' is incorrect for the sense of physical state (e.g., 'in good condition'), which should be 'état'.
- **Fix:** état

### `military` — MEANING
- **aktuell:** militaire (nom)
- **Problem:** The French noun 'militaire' means 'soldier'. 'The military' as an institution translates to 'l'armée'.
- **Fix:** armée

### `louis` — MEANING
- **aktuell:** nom propre (nom propre)
- **Problem:** The translation 'nom propre' is a grammatical label, not the French translation of the name 'Louis'.
- **Fix:** Louis

### `chat` — MEANING
- **aktuell:** bavarder (verbe) | babil (nom)
- **Problem:** The French noun 'babil' is archaic and literary. The common everyday translation for 'chat' is 'bavardage'.
- **Fix:** bavardage

### `acts` — MEANING
- **aktuell:** actions (nom) | jouer un rôle (verbe) | agir (verbe)
- **Problem:** In the second sense, the translation 'jouer un rôle' does not match the example 'She acts like she knows everything' (translated as 'Elle agit...'). Additionally, the third example uses the infinitive 'act' instead of the headword 'acts'.
- **Fix:** Change the translation of the second sense to 'agir' or 'se comporter', and ensure all examples use the inflected form 'acts' (or change the headword to the lemma 'act').

### `waiter` — ORDER
- **aktuell:** garçon (nom) | serveur (nom)
- **Problem:** 'serveur' is the dominant everyday translation for 'waiter' in modern French. 'garçon' is dated or specific to certain traditional cafés.
- **Fix:** Move the sense 'serveur' to the first position.

### `marine` — MEANING
- **aktuell:** naval (adjectif) | sea (nom)
- **Problem:** The translation for the second sense is 'sea', which is an English word, not French. Additionally, the part of speech is listed as 'nom' but 'marine' is used as an adjective in 'marine life'.
- **Fix:** Change the translation to 'marin' or 'maritime' and the part of speech to 'adjectif'.

### `psycho` — EXD
- **aktuell:** psychopathe (nom) | dingue (adjectif)
- **Problem:** The French translation 'Il agit complètement dingue' is ungrammatical.
- **Fix:** Change the translation of the example to 'Il se comporte de manière complètement dingue après la rupture.'

## en-it  (13)

### `uh` — MEANING
- **aktuell:** boh (interiezione)
- **Problem:** The interjection 'uh' represents hesitation and is translated as 'ehm' or 'uhm', whereas 'boh' means 'I don't know' or 'who knows'.
- **Fix:** Change the translation to 'ehm' and the example translation to 'Ehm, non lo so.'

### `looks` — EXAMPLE
- **aktuell:** aspetto (sostantivo)
- **Problem:** The sentence 'She has a beautiful looks' is ungrammatical because 'looks' (meaning physical appearance) is a plural noun and cannot be preceded by the indefinite article 'a'.
- **Fix:** Change the example to 'She has good looks.' and the Italian translation to 'Ha un bell'aspetto.'

### `letter` — MEANING
- **aktuell:** lettera (sostantivo) | carattere (sostantivo)
- **Problem:** The letter of the alphabet (as in 'letter A') is translated as 'lettera' in Italian, not 'carattere' (which means character/font).
- **Fix:** Change the translation of the second sense to 'lettera'.

### `board` — ORDER
- **aktuell:** imbarcarsi (verbo) | tavola (sostantivo) | comitato (sostantivo)
- **Problem:** The noun senses of 'board' (such as 'lavagna' or 'consiglio') are far more common and dominant in everyday English than the verb sense 'imbarcarsi', and should be listed first.
- **Fix:** Reorder the senses so that the noun meanings ('lavagna', 'consiglio/comitato') appear before the verb meaning ('imbarcarsi').

### `board` — MEANING
- **aktuell:** imbarcarsi (verbo) | tavola (sostantivo) | comitato (sostantivo)
- **Problem:** In the second sense, 'board' in the context of writing a message is 'lavagna' (blackboard/whiteboard), not 'tavola' (plank/board).
- **Fix:** Change the translation of the second sense to 'lavagna'.

### `duty` — MEANING
- **aktuell:** dovere (sostantivo) | tassa (sostantivo) | attività (sostantivo)
- **Problem:** In the phrase 'on duty', 'duty' translates to 'servizio' or 'turno', not 'attività'.
- **Fix:** Change the translation of the third sense to 'servizio'.

### `alan` — MEANING
- **aktuell:** Alano (sostantivo)
- **Problem:** 'alan' is a proper noun (name) in English, not the translation of the dog breed 'Alano' (which is 'Great Dane').
- **Fix:** Remove this entry entirely as 'Alan' is a proper name, or change the headword to 'Great Dane'.

### `switch` — EXD
- **aktuell:** cambiare (verbo) | interruttore (sostantivo) | scambiare (verbo)
- **Problem:** The phrasal verb 'switch off' means 'spegnere', not 'cambiare'. The example 'Please switch off the lights' is incorrectly translated as 'Per favore, cambia le luci.'
- **Fix:** Change the translation of the example to 'Per favore, spegni le luci.' and map it to a sense meaning 'spegnere'.

### `score` — MEANING
- **aktuell:** punteggio (sostantivo) | punteggiare (verbo) | raggiungere (verbo)
- **Problem:** The verb 'score' in the context of sports ('scored two goals') translates to 'segnare', not 'punteggiare' (which means to punctuate or dot).
- **Fix:** Change the translation of the second sense to 'segnare'.

### `district` — MEANING
- **aktuell:** distretto (sostantivo) | municipio (sostantivo)
- **Problem:** 'district' means 'distretto', 'quartiere', or 'zona'. It does not mean 'municipio' (which is town hall or municipality).
- **Fix:** Change the translation of the second sense to 'quartiere' or 'zona'.

### `prayer` — POS
- **aktuell:** preghiera (sostantivo) | pregare (verbo)
- **Problem:** The word 'prayer' is strictly a noun in English. The verb is 'pray'. The second sense incorrectly lists 'prayer' as a verb and uses it ungrammatically in the example 'He will prayer for your health'.
- **Fix:** Remove the second sense (verb) entirely, as 'prayer' cannot be used as a verb.

### `proposal` — MEANING
- **aktuell:** proposta (sostantivo) | accordo (sostantivo)
- **Problem:** The word 'proposal' means 'proposta', not 'accordo' (which translates to 'agreement' or 'deal'). The example 'The proposal was accepted' should translate to 'La proposta è stata accettata', not 'L'accordo...'.
- **Fix:** Remove the second sense 'accordo' as it is a duplicate of the first sense 'proposta' with an incorrect translation.

### `chi` — MEANING
- **aktuell:** chi (pronome interrogativo)
- **Problem:** The English headword 'chi' (referring to the Greek letter or the vital life force) has been completely confused with the Italian interrogative pronoun 'chi' (meaning 'who'). Consequently, the example sentence is written in Italian and its translation is in English.
- **Fix:** Remove the entry, or redefine 'chi' with its correct English meaning (e.g., 'energia vitale' or 'lettera greca') and provide a proper English example.

## en-nl  (10)

### `this` — POS
- **aktuell:** dit (voornaamwoord) | deze (lidwoord)
- **Problem:** The part of speech for 'deze' is listed as 'lidwoord' (article), but it is a pronoun ('voornaamwoord').
- **Fix:** Change 'lidwoord' to 'voornaamwoord'.

### `also` — EXD
- **aktuell:** ook (bijwoord)
- **Problem:** The Dutch translation 'Ze leest graag en ook graag schrijven.' is ungrammatical.
- **Fix:** Change the translation to 'Ze leest graag en schrijft ook graag.'

### `offer` — EXD
- **aktuell:** aanbieden (werkwoord) | aanbieding (zelfstandig naamwoord) | voorstellen (werkwoord)
- **Problem:** The example translation for the sense 'voorstellen' uses 'aanbieden' ('Hij zal zijn hulp aanbieden') instead of 'voorstellen'.
- **Fix:** Change the example to 'He offered a suggestion.' and the translation to 'Hij stelde een suggestie voor.'

### `solid` — EXD
- **aktuell:** stevig (bijvoeglijk naamwoord) | degelijk (bijvoeglijk naamwoord) | vast (bijvoeglijk naamwoord)
- **Problem:** The example translation for 'stevig' uses 'massief' ('massief hout') instead of 'stevig'.
- **Fix:** Change the example to 'This is a solid table.' and the translation to 'Dit is een stevige tafel.'

### `conscience` — EXD
- **aktuell:** geweten (zelfstandig naamwoord)
- **Problem:** The Dutch translation 'schuldig geweten' is a literal translation of 'guilty conscience'. In standard Dutch, 'slecht geweten' is used.
- **Fix:** Change 'schuldig geweten' to 'slecht geweten' in the Dutch example translation.

### `sets` — EXAMPLE
- **aktuell:** stellen, zetten (werkwoord) | sets, reeksen (zelfstandig naamwoord) | vaststellen, bepalen (werkwoord)
- **Problem:** The example 'He bought a new set of tools' uses the singular 'set', whereas the headword is 'sets'.
- **Fix:** Change the example to 'He bought two new sets of tools.' and the Dutch translation to 'Hij kocht twee nieuwe sets gereedschap.'

### `occurred` — MEANING
- **aktuell:** voorkwam (werkwoord)
- **Problem:** The Dutch translation 'voorkwam' means 'prevented' (past tense of voorkómen). The past tense of 'vóórkomen' (to occur) is 'kwam voor'.
- **Fix:** Change the translation 'voorkwam' to 'kwam voor' or 'gebeurde'.

### `fridge` — POS
- **aktuell:** koelkast (de)
- **Problem:** The part of speech is listed as 'de' instead of 'zelfstandig naamwoord'.
- **Fix:** Change 'de' to 'zelfstandig naamwoord'.

### `drain` — EXD
- **aktuell:** afvoer (zelfstandig naamwoord) | afvoeren (werkwoord) | uitputten (werkwoord)
- **Problem:** The Dutch translation 'Het water begon uit het bad af te voeren' is ungrammatical because 'afvoeren' is transitive in this sense. It should be 'weg te lopen' or 'weg te stromen'.
- **Fix:** Change 'af te voeren' to 'weg te lopen' in the Dutch example translation.

### `thompson` — POS
- **aktuell:** Thompson (eigennamen)
- **Problem:** The part of speech 'eigennamen' is plural; it should be the singular 'eigennaam'.
- **Fix:** Change 'eigennamen' to 'eigennaam'.

## es-de  (10)

### `guste` — MEANING
- **aktuell:** mögen (Verb)
- **Problem:** The headword is a conjugated subjunctive form ('guste'), but the translation 'mögen' is in the infinitive. The dictionary should use the infinitive headword 'gustar' with the translation 'gefallen' or 'mögen'.
- **Fix:** Change the headword to 'gustar' and the translation to 'gefallen' or 'mögen'.

### `marcha` — EXD
- **aktuell:** Marsch (Substantiv) | Gang (Substantiv) | Betrieb (Substantiv)
- **Problem:** The German translation 'Die Armee ist im Marsch' is unidiomatic.
- **Fix:** Change 'im Marsch' to 'auf dem Marsch'.

### `unidad` — MEANING
- **aktuell:** Einheit (Substantiv) | Gemeinschaft (Substantiv)
- **Problem:** The German translation 'Gemeinschaft' (community) is incorrect for 'unidad' (unity). 'unidad' in this context means 'Einigkeit' or 'Zusammenhalt'.
- **Fix:** Change the translation to 'Einigkeit' and the example translation to 'Sie lebten in großer Einigkeit.'

### `gracia` — EXD
- **aktuell:** Gnade (Substantiv) | Witz (Substantiv) | Anmut (Substantiv)
- **Problem:** The German translation 'Er erzählte einen Witz mit viel Witz' is tautological and stylistically poor.
- **Fix:** Change the translation of the example to 'Er erzählte einen Witz mit viel Humor' or 'Er erzählte einen sehr lustigen Witz'.

### `cadena` — EXAMPLE
- **aktuell:** Kette (Substantiv)
- **Problem:** The Spanish sentence 'Lleva un collar en la cadena' is unnatural because a 'collar' (necklace) is not worn on a 'cadena' (chain). It should be 'colgante' (pendant).
- **Fix:** Change 'collar' to 'colgante' and update the German translation to 'Sie trägt einen Anhänger an der Kette.'

### `podria` — MEANING
- **aktuell:** (ich/er) könnte (Verb)
- **Problem:** The headword is misspelled; it lacks the required written accent on the 'i'. It should be 'podría'.
- **Fix:** podría

### `decide` — MEANING
- **aktuell:** entscheiden (Verb)
- **Problem:** The Spanish headword 'decide' is conjugated (3rd person singular), but the German translation 'entscheiden' is in the infinitive.
- **Fix:** entscheidet

### `bajas` — EXAMPLE
- **aktuell:** niedrig (Adjektiv) | herunternehmen (Verb)
- **Problem:** The Spanish example 'Ella bajas las escaleras con cuidado.' contains a grammatical error: the subject 'Ella' (3rd person singular) does not agree with the verb 'bajas' (2nd person singular).
- **Fix:** Ella baja las escaleras con cuidado.

### `bajas` — MEANING
- **aktuell:** niedrig (Adjektiv) | herunternehmen (Verb)
- **Problem:** The German translation 'herunternehmen' is in the infinitive, whereas the Spanish headword 'bajas' is conjugated (2nd person singular).
- **Fix:** du steigst hinunter / du bringst hinunter

### `encuentres` — EXD
- **aktuell:** finden (Verb)
- **Problem:** The German translation of the example 'Ich hoffe, du findest dich gut.' is incorrect. In this context, 'encontrarse bien' means to feel well or be doing well.
- **Fix:** Ich hoffe, es geht dir gut.

## es-en  (9)

### `número` — MEANING
- **aktuell:** number (noun) | amount (noun)
- **Problem:** The translation 'amount' for 'número' is incorrect; 'amount' corresponds to 'cantidad', whereas 'número' means 'number'.
- **Fix:** Remove the 'amount' sense or change the translation to 'number' (e.g., 'a large number of...').

### `llamar` — MEANING
- **aktuell:** call (verb) | summon (verb) | hit (verb)
- **Problem:** The translation 'hit' for 'llamar' in the context of 'llamar a la puerta' is incorrect; it means 'knock'.
- **Fix:** Change the translation from 'hit' to 'knock'.

### `evitar` — EXAMPLE
- **aktuell:** avoid (verb) | evade (verb)
- **Problem:** The example sentence for the second sense uses the verb 'evadir' instead of the headword 'evitar'.
- **Fix:** Change the example sentence to use 'evitar', for example: 'Intentó evitar la pregunta.'

### `in` — MEANING
- **aktuell:** in (preposition) | at (preposition) | on (preposition)
- **Problem:** The headword is incorrectly written as the English preposition 'in' instead of the Spanish preposition 'en'.
- **Fix:** Change the headword to 'en'.

### `vaso` — MEANING
- **aktuell:** glass (noun) | vase (noun)
- **Problem:** The translation 'vase' for 'vaso' is a false friend; 'vase' translates to 'florero' or 'jarrón' in Spanish, whereas 'vaso' is a drinking glass.
- **Fix:** Remove the 'vase' sense or replace it with 'vessel' (e.g., blood vessel).

### `sienten` — MEANING
- **aktuell:** they feel (verb) | they smell (verb)
- **Problem:** The verb 'sentir' does not mean 'to smell' (emit an odor). The Spanish verb for this is 'oler'. Consequently, 'Las flores sienten muy bien' is incorrect Spanish.
- **Fix:** Remove the 'they smell' sense and its corresponding example.

### `west` — MEANING
- **aktuell:** west (noun) | western (adjective)
- **Problem:** 'West' is an English word, not Spanish. The Spanish word for 'west' is 'oeste'. The sentences 'El sol se pone en el west' and 'Es una película west' are incorrect Spanish.
- **Fix:** Change the headword to 'oeste', with the translation 'west', and use correct Spanish examples like 'El sol se pone en el oeste'.

### `preocuparme` — MEANING
- **aktuell:** worry about myself (verb)
- **Problem:** The translation 'worry about myself' is incorrect. 'Preocuparse' (and its first-person form 'preocuparme') simply means 'to worry'. 'Worry about myself' would be 'preocuparme por mí mismo'.
- **Fix:** Change the translation to 'to worry'.

### `casco` — EXAMPLE
- **aktuell:** helmet (noun) | city center (noun)
- **Problem:** The example sentence contains a typo: 'Leva' instead of 'Lleva'. Additionally, mixing the imperative 'Lleva' with the indicative 'montas' is grammatically awkward; it should use the subjunctive 'montes'.
- **Fix:** Change the example to: 'Lleva un casco cuando montes en bicicleta.'

## es-it  (9)

### `tengo` — MEANING
- **aktuell:** avere (verbo)
- **Problem:** The conjugated form 'tengo' (1st person singular) is translated as the infinitive 'avere' instead of 'ho'.
- **Fix:** ho

### `hacerte` — MEANING
- **aktuell:** fare (verbo) | causare (verbo)
- **Problem:** The translation 'fare' misses the clitic pronoun 'te'. It should be translated as 'farti'.
- **Fix:** farti

### `escuche` — MEANING
- **aktuell:** ascoltare (verbo)
- **Problem:** The conjugated form 'escuche' (subjunctive/formal imperative) is translated as the infinitive 'ascoltare' instead of 'ascolti'.
- **Fix:** ascolti

### `jurado` — POS
- **aktuell:** giuria (sostantivo) | giurato (aggettivo)
- **Problem:** In the second sense, 'jurado' (giurato) in the example 'Fue un jurado difícil' is used as a noun (juror), not an adjective.
- **Fix:** sostantivo

### `intentarlo` — MEANING
- **aktuell:** provarlo (verbo)
- **Problem:** 'intentarlo' means 'provarci' or 'tentare'. 'provarlo' is the translation of 'probarlo' (to test/taste something).
- **Fix:** provarci

### `traiga` — EXD
- **aktuell:** portare (con sé) (verbo)
- **Problem:** The Spanish example uses the formal imperative 'traiga' (usted), but the Italian translation uses the informal 'porta' (tu) instead of 'porti'.
- **Fix:** Change 'porta' to 'porti' in the Italian translation.

### `adulto` — POS
- **aktuell:** adulto (sostantivo)
- **Problem:** In the example 'Es un hombre adulto', 'adulto' is used as an adjective, but the part of speech is listed as 'sostantivo'.
- **Fix:** Change the part of speech to 'aggettivo' or change the example to one where 'adulto' is a noun, such as 'El precio es diferente para un adulto'.

### `finales` — MEANING
- **aktuell:** finali (sostantivo) | ultimi (aggettivo)
- **Problem:** The translation 'ultimi' is incorrect for 'finales' (which means 'finali'). Additionally, the example translation uses 'finali' rather than 'ultimi'.
- **Fix:** Change the translation 'ultimi' to 'finali'.

### `joy` — EXAMPLE
- **aktuell:** gioia (sostantivo)
- **Problem:** The headword 'joy' is English, and it is incorrectly used in the Spanish example sentence 'Sentí una gran joy al verla' instead of 'alegría' or 'gozo'.
- **Fix:** Remove the entry or change the headword to 'alegría' and update the example sentence.

## fr-de  (12)

### `sur` — ORDER
- **aktuell:** sauer (Adjektiv)
- **Problem:** The dominant everyday sense of 'sur' is the preposition 'on' ('auf', 'über'). The adjective 'sur' meaning 'sour' ('sauer') is extremely rare and not appropriate as the primary definition for A1.
- **Fix:** Change the primary sense to the preposition 'auf' / 'über' (e.g., 'sur la table' -> 'auf dem Tisch').

### `dès` — MEANING
- **aktuell:** ab (Präposition) | seit (Präposition) | sofort (Adverb)
- **Problem:** The translation 'sofort' (Adverb) for 'dès' is incorrect. 'dès' is a preposition meaning 'starting from' or 'as early as'. 'dès maintenant' means 'ab sofort', but 'dès' itself does not mean 'sofort'.
- **Fix:** Remove the 'sofort' sense or change it to 'ab' / 'von ... an' with a correct example.

### `manque` — MEANING
- **aktuell:** Mangel (Substantiv) | Fehler (Substantiv)
- **Problem:** The translation 'Fehler' for 'manque' is incorrect. 'manque' means 'Mangel' (lack/shortage). The example 'C'est un manque de respect' translates to 'Das ist ein Mangel an Respekt', not 'Fehler'.
- **Fix:** Remove the 'Fehler' sense or replace it with 'Fehlen' / 'Mangel'.

### `douce` — EXAMPLE
- **aktuell:** sanft (Adjektiv) | süß (Adjektiv)
- **Problem:** The French example 'Ce fruit est très douce.' is grammatically incorrect because 'fruit' is masculine, so the adjective must be masculine ('doux'), not feminine ('douce').
- **Fix:** Change the example to use a feminine noun, e.g., 'Cette poire est très douce.' (Diese Birne ist sehr süß).

### `angeles` — MEANING
- **aktuell:** (Los) Angeles (Eigenname)
- **Problem:** 'angeles' is not a valid French headword. The proper noun is 'Los Angeles'.
- **Fix:** Remove the entry or change the headword to 'Los Angeles'.

### `portait` — EXAMPLE
- **aktuell:** er/sie/es trug (Verb) | er/sie/es schilderte (Verb)
- **Problem:** The French sentence 'Le tableau portait une scène.' is unnatural and incorrect for 'The painting depicted a scene'. 'porter' does not mean 'schildern' (to depict).
- **Fix:** Remove this sense or use a correct example for 'porter' meaning 'to bear' (e.g., 'Le document portait sa signature.' -> 'Das Dokument trug seine Unterschrift.').

### `port` — EXAMPLE
- **aktuell:** Hafen (Substantiv) | Tragen (Verb) | Hafenstadt (Substantiv)
- **Problem:** The sentence 'Il doit port ses bagages' is grammatically incorrect (it should be 'porter'). Additionally, 'Tragen' as a translation of 'port' is a noun (Substantiv), not a verb.
- **Fix:** Change the part of speech to 'Substantiv', the translation to 'Tragen', and the example to 'Le port de la ceinture est obligatoire.' (Das Tragen des Sicherheitsgurts ist Pflicht.)

### `gordon` — EXAMPLE
- **aktuell:** Gordon (Eigenname)
- **Problem:** The example states 'Gordon est un nom commun', but 'Gordon' is a proper noun (nom propre), not a common noun (nom commun).
- **Fix:** Change the example to 'Gordon est un nom propre.' (Gordon ist ein Eigenname.)

### `pure` — EXAMPLE
- **aktuell:** rein (Adjektiv) | pur (Adjektiv)
- **Problem:** The headword is the feminine 'pure', but the second example uses the masculine form 'pur' ('un style pur').
- **Fix:** Change the example to 'C'est une pure folie.' (Das ist reiner Wahnsinn.)

### `militaires` — EXAMPLE
- **aktuell:** Militär (Substantiv) | militärisch (Adjektiv)
- **Problem:** The headword is plural 'militaires', but the second example uses the singular form 'militaire' ('une présence militaire').
- **Fix:** Change the example to 'Ce sont des zones militaires.' (Das sind militärische Zonen.)

### `direz` — MEANING
- **aktuell:** würden sagen (Konditional) (Verb)
- **Problem:** 'direz' is the future tense (Futur I) of 'dire' (vous direz = Sie werden sagen), not the conditional (vous diriez = Sie würden sagen).
- **Fix:** Change the translation to 'werden sagen' and the German translation of the example to 'Sie werden sagen, dass es unmöglich ist.'

### `observer` — MEANING
- **aktuell:** beobachten (Verb) | betrachten (Verb)
- **Problem:** For the sense of respecting rules ('observer les règles'), the German translation is 'beachten' or 'einhalten', not 'betrachten' (which means to look at).
- **Fix:** Change the translation 't' from 'betrachten' to 'beachten' or 'einhalten'.

## fr-en  (9)

### `pouvez` — EXAMPLE
- **aktuell:** can (verb) | be able to (verb)
- **Problem:** The second example ('Je ne peux pas venir.') uses the verb form 'peux' instead of the headword 'pouvez'.
- **Fix:** Change the example to 'Vous ne pouvez pas venir.' and the translation to 'You are not able to come.'

### `promis` — EXAMPLE
- **aktuell:** promised (adjective)
- **Problem:** The French example 'C'est un jour promis' is unnatural and not used in everyday French.
- **Fix:** Change the example to 'C'est une chose promise.' ('It is a promised thing.') or use the common interjection 'Promis, je serai là !' ('Promise, I will be there!')

### `venais` — EXAMPLE
- **aktuell:** was coming (verb) | used to come (verb)
- **Problem:** Both examples use the third-person singular form 'venait' instead of the headword 'venais' (first/second-person singular).
- **Fix:** Change the examples to use 'venais', e.g., 'Je venais te voir tous les jours.' ('I used to come see you every day.') and 'Tu venais souvent ici.' ('You used to come here often.')

### `reed` — MEANING
- **aktuell:** reed (noun)
- **Problem:** The headword is the English word 'reed' instead of the French word 'roseau'.
- **Fix:** Change the headword to 'roseau'.

### `jouais` — MEANING
- **aktuell:** I was playing (verb) | I was saying (verb)
- **Problem:** The second sense 'I was saying' is incorrect for 'jouer'. Additionally, the example 'Il jouait qu'il était le roi' uses 'jouait' (3rd person) instead of the headword 'jouais' (1st/2nd person) and is unnatural French.
- **Fix:** Change the second sense to 'I was playing' (e.g., roleplay/pretending) or remove it, and ensure the example matches the 1st/2nd person 'jouais'.

### `arrangement` — MEANING
- **aktuell:** agreement (noun) | accommodation (noun) | setup (noun)
- **Problem:** The French word 'arrangement' does not mean 'accommodation' (lodging). The example 'Nous avons besoin d'un arrangement pour le logement' means 'We need an agreement/compromise for the housing'.
- **Fix:** Remove the 'accommodation' sense or correct its translation to 'agreement' or 'compromise'.

### `vôtres` — EXAMPLE
- **aktuell:** yours (pronoun)
- **Problem:** The headword is the plural form 'vôtres', but the example uses the singular form 'la vôtre'.
- **Fix:** Change the example to use the plural form, e.g., 'Ces livres sont les vôtres.' (These books are yours.)

### `nue` — EXAMPLE
- **aktuell:** naked (adjective) | bare (adjective)
- **Problem:** The headword is the feminine singular 'nue', but the second example uses the masculine plural 'nus' ('Les arbres étaient nus').
- **Fix:** Change the second example to use the feminine form, e.g., 'La colline était nue.' (The hill was bare.)

### `étude` — MEANING
- **aktuell:** Study, research (noun) | Study room (noun)
- **Problem:** In French, 'étude' does not mean a 'study room' in a private house (which is 'bureau'). It refers to a notary's or lawyer's office/practice.
- **Fix:** Change the translation of the second sense to 'notary's office' or 'law practice'.

## fr-es  (11)

### `plus` — EXD
- **aktuell:** más (adverbio)
- **Problem:** The translation 't' is 'más' (positive), but the example 'J'ai plus de pain' is translated as 'No tengo más pan' (negative, where 'plus' means 'no more' due to the informal omission of 'ne').
- **Fix:** Change the example to 'Je veux plus de pain.' and its translation to 'Quiero más pan.' to correctly illustrate the positive 'más'.

### `leur` — MEANING
- **aktuell:** les (determinante posesivo)
- **Problem:** The Spanish translation 'les' is an indirect object pronoun, which does not match the part of speech 'determinante posesivo' (possessive determiner) or the example 'C'est leur maison' ('Es su casa').
- **Fix:** Change 't' to 'su' (or 'sus').

### `diable` — EXAMPLE
- **aktuell:** diablo (sustantivo) | carretilla (sustantivo)
- **Problem:** In the second sense ('carretilla'), the noun 'diable' is masculine in French. The example 'Il a poussé la diable' incorrectly uses the feminine article 'la'.
- **Fix:** Change 'la diable' to 'le diable' in the French example.

### `humains` — MEANING
- **aktuell:** humano (adjetivo)
- **Problem:** The headword 'humains' is plural, but the translation 'humano' and the example 'C'est un être humain' are in the singular.
- **Fix:** Change the headword to 'humain' to match the singular definition and example.

### `débile` — MEANING
- **aktuell:** débil (adjetivo)
- **Problem:** In modern French, 'débile' colloquially means stupid or moronic ('tonto', 'estúpido'). Translating 'Il est très débile' as 'Es muy débil' (physically weak) is a false friend error; 'weak' in French is 'faible'.
- **Fix:** Change 't' to 'tonto' and the example translation to 'Es muy tonto'.

### `volant` — MEANING
- **aktuell:** volante (sustantivo) | timón (sustantivo)
- **Problem:** The French word 'volant' refers to a steering wheel, not a ship's rudder or helm ('timón'), which is 'gouvernail' or 'barre' in French.
- **Fix:** Remove the 'timón' sense and its incorrect example.

### `forcer` — EXAMPLE
- **aktuell:** forzar (verbo) | obligar (verbo)
- **Problem:** The example 'Il a forcé la porte pour entrer' corresponds to the meaning 'forzar' (to force open), not 'obligar' (to force/compel someone).
- **Fix:** Change the example for 'obligar' to 'Le mauvais temps l'a forcé à annuler son voyage' (El mal tiempo lo obligó a cancelar su viaje).

### `marshall` — EXAMPLE
- **aktuell:** mariscal (sustantivo)
- **Problem:** The headword 'marshall' is misspelled (it is the English spelling or a proper name). The correct French word is 'maréchal', which is used in the example.
- **Fix:** Change the headword to 'maréchal'.

### `pleuré` — MEANING
- **aktuell:** lloré (verbo)
- **Problem:** The French past participle 'pleuré' is translated as 'lloré' (Spanish first-person preterite), but it should be 'llorado' (past participle).
- **Fix:** Change the Spanish translation to 'llorado', or change the headword to the infinitive 'pleurer' and translation to 'llorar'.

### `rendra` — MEANING
- **aktuell:** traerá (verbo)
- **Problem:** The verb 'rendra' (future of 'rendre') does not mean 'traerá' (which is 'apportera'). In the expression 'rendre visite', it forms the verb 'visitar'.
- **Fix:** Change the translation to 'devolverá' and use an example like 'Il rendra le livre demain' (Devolverá el libro mañana).

### `holmes` — EXAMPLE
- **aktuell:** detective (Sherlock) (nombre propio)
- **Problem:** The French example contains Spanish words ('es', 'famoso') instead of French, and the Spanish translation 'exd' is written in English.
- **Fix:** Change the French example to 'Sherlock Holmes est un personnage célèbre.' and the Spanish translation to 'Sherlock Holmes es un personaje famoso.'

## fr-it  (9)

### `de` — EXD
- **aktuell:** di (preposizione) | da (preposizione) | del/della/dei/degli (preposizione)
- **Problem:** In the third sense, the Italian translation of the example 'Un peu de sucre' is 'Un po' di zucchero', where 'de' is translated as 'di', not 'del/della/dei/degli'.
- **Fix:** Change the example to 'Je veux de la bière' with the translation 'Voglio della birra' to correctly illustrate the partitive.

### `données` — POS
- **aktuell:** dati (sostantivo femminile plurale)
- **Problem:** The Italian translation 'dati' is a masculine plural noun, but its part of speech is listed as 'sostantivo femminile plurale'.
- **Fix:** Change the part-of-speech to 'sostantivo maschile plurale'.

### `frappe` — EXD
- **aktuell:** battitura (sostantivo) | attacco (sostantivo)
- **Problem:** In the first sense, 'La frappe de la balle' is translated as 'La battitura della palla'. In Italian, 'battitura' refers to typing. For a ball, 'il tiro' or 'il colpo' should be used.
- **Fix:** Change the Italian translation of the example to 'Il tiro della palla era perfetto' and the Italian meaning to 'tiro' or 'colpo'.

### `jerry` — EXAMPLE
- **aktuell:** bidone della spazzatura (sostantivo)
- **Problem:** 'jerry' is not a French word meaning trash can, and 'Jettez le papier dans le jerry' is incorrect French.
- **Fix:** Replace the headword with 'poubelle' and update the examples accordingly.

### `commande` — EXAMPLE
- **aktuell:** ordine (sostantivo) | comando (sostantivo)
- **Problem:** In the second example, 'commande' is feminine, so 'le commande' is grammatically incorrect.
- **Fix:** Change 'le commande' to 'la commande' or 'le commandement'.

### `fleur` — POS
- **aktuell:** fiore (sostantivo femminile)
- **Problem:** The Italian translation 'fiore' is a masculine noun, but it is marked as 'sostantivo femminile'.
- **Fix:** Change the part-of-speech to 'sostantivo maschile'.

### `can` — EXAMPLE
- **aktuell:** potere (verbo modale)
- **Problem:** The headword 'can' is English, and the example uses the French verb 'pouvoir' ('peux') instead of the headword.
- **Fix:** Change the headword to 'pouvoir'.

### `palmer` — EXAMPLE
- **aktuell:** palmare (verbo)
- **Problem:** The French sentence 'Il a réussi à palmer l'eau du bateau' is incorrect; 'palmer' does not mean to bail water (the correct French verb is 'écoper').
- **Fix:** Change the headword to 'écoper' and update the translations and examples accordingly.

### `victoria` — EXAMPLE
- **aktuell:** Vittoria (nome proprio) | Vittoriana (aggettivo)
- **Problem:** The second sense uses the adjective 'victorienne' in the example, which does not correspond to the headword 'victoria'.
- **Fix:** Remove the second sense or create a separate entry for the adjective 'victorien'.

## fr-nl  (11)

### `you` — MEANING
- **aktuell:** jij/je (voornaamwoord) | u/u (voornaamwoord)
- **Problem:** The headword 'you' is English, not French. The examples use the French pronouns 'tu' and 'vous'.
- **Fix:** Change the headword to 'tu' or 'vous' and adjust the senses accordingly.

### `aime` — MEANING
- **aktuell:** houden van (werkwoord)
- **Problem:** The headword 'aime' is a conjugated verb form, but it is translated with the Dutch infinitive 'houden van'.
- **Fix:** Change the headword to the infinitive 'aimer'.

### `sur` — MEANING
- **aktuell:** op (prepositie) | boven (prepositie) | aan (prepositie)
- **Problem:** In the third sense, 'aan' is given as the translation for 'sur' in 'Il habite sur Paris', but 'sur' here means 'near' or 'around' (bij/in de buurt van).
- **Fix:** Change the translation 'aan' to 'bij' or 'in de buurt van', or use an example like 'sur la côte' (aan de kust).

### `dès` — POS
- **aktuell:** vanaf (voegwoord) | sedert (voegwoord)
- **Problem:** The part of speech is listed as 'voegwoord' (conjunction), but in the provided examples 'dès' acts as a preposition ('prepositie').
- **Fix:** Change the part of speech to 'prepositie'.

### `résoudre` — MEANING
- **aktuell:** oplossen (werkwoord) | ontleden (werkwoord)
- **Problem:** The translation 'ontleden' for 'résoudre' in the context of 'résoudre une équation' is incorrect; it should be 'oplossen'.
- **Fix:** Change 'ontleden' to 'oplossen' and the example translation to 'Een vergelijking oplossen'.

### `terres` — EXAMPLE
- **aktuell:** land (zelfstandig naamwoord) | aarde (zelfstandig naamwoord)
- **Problem:** The headword is plural 'terres', but the second example uses the singular 'La terre' (referring to the Earth, which should be capitalized 'la Terre').
- **Fix:** Change the headword to 'terre' (singular) or use a plural example for the second sense.

### `ennuyeux` — MEANING
- **aktuell:** vervelend (bijvoeglijk naamwoord) | saai (bijvoeglijk naamwoord) | vermoeiend (bijvoeglijk naamwoord)
- **Problem:** 'Ennuyeux' means boring or annoying, not tiring ('vermoeiend', which translates to 'fatigant' in French).
- **Fix:** Remove the third sense 'vermoeiend' or replace it with 'vervelend' / 'irritant'.

### `this` — MEANING
- **aktuell:** dit, deze, dit hier (voornaamwoord) | dit, deze, dit (lidwoord)
- **Problem:** The headword 'this' is an English word, not French. The examples use the French words 'ceci' and 'ce'.
- **Fix:** Change the headword to 'ceci' or 'ce' and adjust the translations.

### `look` — MEANING
- **aktuell:** uiterlijk (zelfstandig naamwoord) | kijk (zelfstandig naamwoord)
- **Problem:** In French, 'look' only means style or appearance. It cannot mean a glance/look, making 'Donne-moi un look rapide' incorrect French.
- **Fix:** Remove the second sense and its incorrect example.

### `sembles` — EXAMPLE
- **aktuell:** lijkt (werkwoord) | lijken (werkwoord)
- **Problem:** The headword is the conjugated form 'sembles' (tu sembles), but the examples use 'semble' (elle semble) and 'semblent' (ils semblent).
- **Fix:** Change the headword to the infinitive 'sembler' and adjust the translations and examples.

### `lent` — POS
- **aktuell:** langzaam (bijwoord) | traag (bijwoord)
- **Problem:** 'Lent' is an adjective (bijvoeglijk naamwoord), not an adverb (bijwoord). Additionally, the first example uses the adverb 'lentement' instead of the headword 'lent'.
- **Fix:** Change the part of speech to 'bijvoeglijk naamwoord' and use 'lent' in the first example (e.g., 'Un train lent').

## it-de  (10)

### `cos` — MEANING
- **aktuell:** was (Pronomen) | so (Adverb)
- **Problem:** The headword 'cos' is not a standard Italian word. The entry conflates 'cosa' (elided to cos' in the first example) and 'così' (used in the second example).
- **Fix:** Split this entry into two proper headwords: 'cosa' and 'così'.

### `continua` — EXD
- **aktuell:** fährt fort (Verb)
- **Problem:** The German verb 'fortfahren' cannot be used with inanimate subjects like music. 'Die Musik fährt fort' is unnatural and incorrect.
- **Fix:** Change the German translation of the example to 'Die Musik geht weiter.'

### `potete` — EXD
- **aktuell:** können (Verb)
- **Problem:** The Italian 'Potete' is the 2nd person plural (informal 'ihr'), but the German translation 'Können Sie' uses the formal address.
- **Fix:** Change the German translation of the example to 'Könnt ihr mir helfen?'

### `sarebbero` — EXAMPLE
- **aktuell:** wären (Verb)
- **Problem:** The example sentence 'Se avessi tempo, verrei.' does not contain the headword 'sarebbero' at all.
- **Fix:** Replace the example with one that uses 'sarebbero', such as: 'Sarebbero felici di aiutarti.' (Sie wären froh, dir zu helfen.)

### `tenerlo` — MEANING
- **aktuell:** es halten (Verb) | es besitzen (Verb)
- **Problem:** The translation 'es besitzen' (to own/possess) is incorrect for 'tenerlo' in the context of 'Non posso tenerlo più' (which means 'I cannot keep it anymore').
- **Fix:** Change the German translation to 'es behalten' and the example translation to 'Ich kann es nicht länger behalten.'

### `brutte` — EXD
- **aktuell:** hässlich (Adjektiv) | schlecht (Adjektiv)
- **Problem:** The headword is plural ('brutte') but the examples use the singular 'brutta'. Furthermore, 'Una brutta notizia' is translated as 'Eine hässliche Nachricht', which is incorrect; it means 'Eine schlechte Nachricht' (bad news).
- **Fix:** Change the headword to the standard masculine singular 'brutto', and correct the translation of 'Una brutta notizia' to 'Eine schlechte Nachricht'.

### `recuperare` — EXD
- **aktuell:** wiederfinden (Verb) | wiedererlangen (Verb) | zurückholen (Verb)
- **Problem:** The translation of 'Devo recuperare il tempo perduto' is given as 'Ich muss die verlorene Zeit wiederfinden'. In German, you do not 'wiederfinden' (find again) time; the correct idiom is 'aufholen' or 'nachholen'.
- **Fix:** Change the German translation of the example to 'Ich muss die verlorene Zeit aufholen' and map it to a corresponding German meaning like 'aufholen'.

### `tengono` — EXD
- **aktuell:** halten (Verb)
- **Problem:** The example 'Loro tengono i libri sul tavolo' is translated as 'Sie halten die Bücher auf dem Tisch'. In this context, 'tenere' means 'to keep/leave' (aufbewahren/lassen), not 'to physically hold' (halten).
- **Fix:** Use a different example for 'halten', such as 'Tengono le mani in tasca' ('Sie halten die Hände in den Taschen').

### `roccia` — MEANING
- **aktuell:** Fels (Substantiv) | Steinmasse (Substantiv)
- **Problem:** The translation 'Steinmasse' is unnatural for 'roccia' in the context of a boulder blocking a road. The example translation 'Eine große Steinmasse blockierte die Straße' is not idiomatic German.
- **Fix:** Change 'Steinmasse' to 'Felsbrocken' and the example translation to 'Ein großer Felsbrocken blockierte die Straße'.

### `interni` — EXD
- **aktuell:** innere (Adjektiv) | Innen- (Adjektiv)
- **Problem:** The example 'Il palazzo ha molti appartamenti interni' is translated as 'Der Palast hat viele interne Wohnungen'. 'Interne Wohnungen' is incorrect in German; it should be 'Innenwohnungen' or 'zum Innenhof gelegene Wohnungen'. Also, 'Innen-' is a prefix, not an adjective.
- **Fix:** Change the German translation of the second sense to 'innenliegend' (Adjektiv) and the example translation to 'Das Gebäude hat viele innenliegende Wohnungen'.

## it-nl  (14)

### `stanno` — MEANING
- **aktuell:** zij staan (werkwoord)
- **Problem:** The Italian verb 'stare' (3rd person plural 'stanno') means 'zijn', 'blijven' or 'zich bevinden', not 'staan' (which is 'stare in piedi'). The example 'Loro stanno bene' translates to 'Zij maken het goed', where 'stanno' does not mean 'staan'.
- **Fix:** Change the translation to 'zij zijn' or 'zij maken het (goed)'.

### `piani` — EXAMPLE
- **aktuell:** plannen (zelfstandig naamwoord) | verdiepingen (zelfstandig naamwoord)
- **Problem:** The Italian example 'L'appartamento è al terzo piani.' is grammatically incorrect because 'terzo' (singular) requires the singular noun 'piano'.
- **Fix:** Change the Italian example to: 'L'appartamento è al terzo piano.'

### `seduta` — MEANING
- **aktuell:** zittend (participium) | zit (substantief)
- **Problem:** The Dutch translation 'zit' is incorrect for 'seduta' in the context of a council or official meeting. The correct Dutch term is 'zitting' or 'vergadering'.
- **Fix:** Change the translation 'zit' to 'zitting'.

### `oscuro` — EXAMPLE
- **aktuell:** duister (adjectief) | onbekend (adjectief) | somber (adjectief)
- **Problem:** The example for the first sense uses the word 'buia' instead of the headword 'oscuro' (or 'oscura').
- **Fix:** Change 'buia' to 'oscura' in the Italian example: 'La stanza era oscura e silenziosa.'

### `trovero` — EXAMPLE
- **aktuell:** ik zal vinden (werkwoord)
- **Problem:** The headword 'trovero' is misspelled; it requires an accent on the final letter ('troverò').
- **Fix:** Change the headword to 'troverò'.

### `sin` — MEANING
- **aktuell:** zonde (zelfstandig naamwoord)
- **Problem:** The headword 'sin' is English. The Italian word for 'zonde' is 'peccato'.
- **Fix:** Change the headword to 'peccato'.

### `spieghi` — EXAMPLE
- **aktuell:** uitleggen (ww)
- **Problem:** The Italian example 'Puoi spieghi questo concetto per favore?' is grammatically incorrect because the modal verb 'puoi' must be followed by an infinitive.
- **Fix:** Change 'spieghi' to 'spiegare' in the example: 'Puoi spiegare questo concetto per favore?'

### `white` — MEANING
- **aktuell:** wit (bijvoeglijk naamwoord)
- **Problem:** The headword 'white' is English. The Italian word for 'wit' is 'bianco'.
- **Fix:** Change the headword to 'bianco'.

### `chiamero` — EXAMPLE
- **aktuell:** ik zal roepen (werkwoord) | ik zal noemen (werkwoord)
- **Problem:** The headword 'chiamero' is misspelled; it requires an accent on the final letter ('chiamerò').
- **Fix:** Change the headword to 'chiamerò'.

### `one` — MEANING
- **aktuell:** één (telwoord)
- **Problem:** The headword 'one' is English. The Italian word for 'één' is 'uno'.
- **Fix:** Change the headword to 'uno'.

### `salvarti` — MEANING
- **aktuell:** jezelf redden (werkwoord) | jezelf helpen (werkwoord)
- **Problem:** The second sense 'jezelf helpen' is incorrect. 'Salvare' means 'to save', not 'to help' (aiutare).
- **Fix:** Change the Dutch translation to 'je redden' and the example translation to 'Ik kan je niet redden als je me de waarheid niet vertelt.'

### `rissa` — MEANING
- **aktuell:** ruzie (zelfstandig naamwoord)
- **Problem:** The Dutch translation 'ruzie' (quarrel) is incorrect for 'rissa', which refers to a physical fight or brawl.
- **Fix:** Change the Dutch translation to 'vechtpartij' or 'gevecht'.

### `kent` — MEANING
- **aktuell:** hij/zij/het weet (werkwoord)
- **Problem:** The headword 'kent' and its example are in Dutch, not Italian.
- **Fix:** Change the headword to 'conosce' (or 'conoscere') and the Italian example to 'Lui conosce la strada.'

### `pulsante` — MEANING
- **aktuell:** knop (zelfstandig naamwoord) | hartslag (zelfstandig naamwoord)
- **Problem:** The noun 'pulsante' means 'button', not 'hartslag' (heartbeat/pulse). The Italian example 'Il suo pulsante era accelerato' is incorrect.
- **Fix:** Remove the second sense, or change the Italian word to 'pulsazione' or 'battito'.

## nl-de  (9)

### `werden` — MEANING
- **aktuell:** werden (Verb)
- **Problem:** The Dutch headword is 'worden'. 'werden' is the German translation.
- **Fix:** worden

### `zo` — EXAMPLE
- **aktuell:** so (Adverb) | solche (Pronomen) | ebenso (Adverb)
- **Problem:** The Dutch example 'Hij spreekt Nederlands, en ik ook zo.' is ungrammatical.
- **Fix:** Change the example to 'Hij spreekt Nederlands, en ik net zo.' and the German translation to 'Er spricht Niederländisch, und ich ebenso.'

### `dol` — MEANING
- **aktuell:** verrückt (Adjektiv) | toll (Adjektiv) | trunken (Adjektiv)
- **Problem:** The Dutch word 'dol' does not mean 'trunken' (drunk/betrunken).
- **Fix:** Remove the third sense ('trunken').

### `laag` — MEANING
- **aktuell:** niedrig (Adjektiv) | Scheibe (Substantiv) | Schicht (Substantiv)
- **Problem:** The noun 'laag' means 'layer' (Schicht), not 'slice' (Scheibe). The Dutch example 'Hij at een laag taart' is incorrect for eating a piece of cake.
- **Fix:** Remove the 'Scheibe' sense.

### `alarm` — EXD
- **aktuell:** Alarm (Substantiv)
- **Problem:** The German translation uses the wrong article 'Das' for the masculine noun 'Alarm'.
- **Fix:** Der Alarm ging los.

### `naakt` — EXD
- **aktuell:** nackt (Adjektiv) | bloß (Adjektiv)
- **Problem:** The German translation 'Er lief bloß die Straße entlang' translates 'bloß' as 'merely/only', which does not mean 'naked' in this context.
- **Fix:** Er lief nackt die Straße entlang.

### `nut` — MEANING
- **aktuell:** Nut (Substantiv)
- **Problem:** The German word 'Nut' means a groove or slot. The correct German translation for the Dutch noun 'nut' (usefulness, benefit) is 'Nutzen'.
- **Fix:** Nutzen

### `blaas` — EXAMPLE
- **aktuell:** Blase (Substantiv)
- **Problem:** The Dutch noun 'blaas' means 'bladder' (anatomical) or 'bubble'. It cannot mean a 'bang' or 'pop' (which is 'knal'). The sentence 'De ballon knapte met een luide blaas' is incorrect Dutch.
- **Fix:** Change the example to: 'De dokter onderzocht mijn blaas.' with the German translation: 'Der Arzt untersuchte meine Blase.'

### `zake` — EXAMPLE
- **aktuell:** Sache (Substantiv)
- **Problem:** The word 'zake' is an archaic dative form of 'zaak' and only occurs in fixed prepositional phrases (e.g., 'ter zake'). It cannot be used as a regular noun in 'Dat is een belangrijke zake' (which should be 'zaak').
- **Fix:** Change the headword to 'zaak', the example to 'Dat is een belangrijke zaak.', and the German translation of the example to 'Das ist eine wichtige Sache.'

## nl-en  (10)

### `verloren` — EXAMPLE
- **aktuell:** lost (adjective)
- **Problem:** The example 'Hij heeft zijn sleutels verloren' uses 'verloren' as a verb (past participle of 'verliezen') rather than an adjective.
- **Fix:** Change the example to: 'Hij voelde zich verloren in de grote stad.' (He felt lost in the big city.)

### `momentje` — MEANING
- **aktuell:** little moment (noun)
- **Problem:** The translation 'little moment' is an unnatural, literal translation of the Dutch diminutive. In this context, it simply means 'moment' or 'second'.
- **Fix:** Change the translation to 'moment' or 'second'.

### `opgesloten` — EXAMPLE
- **aktuell:** locked up (adjective) | trapped (adjective)
- **Problem:** The example 'De dief werd opgesloten in de cel' uses 'opgesloten' as a verb in the passive voice, not as an adjective.
- **Fix:** Change the example to: 'De opgesloten hond bleef maar blaffen.' (The locked-up dog kept barking.)

### `as` — EXAMPLE
- **aktuell:** axis (noun) | ash (noun)
- **Problem:** The example 'De sigaret heeft een as' is grammatically incorrect because 'as' (ash) is uncountable in Dutch. 'Een as' means 'an axis' or 'an axle'.
- **Fix:** Change the example to: 'Er ligt as op het tapijt.' (There is ash on the carpet.)

### `waarschuw` — POS
- **aktuell:** to warn (verb)
- **Problem:** The headword is the inflected first-person singular or imperative form, but the translation 'to warn' is an infinitive. The example also uses the past tense 'waarschuwde'.
- **Fix:** Change the headword to the infinitive 'waarschuwen'.

### `opgevoed` — MEANING
- **aktuell:** raised (verb) | educated (verb)
- **Problem:** The second sense 'educated' is incorrect for 'opgevoed'. 'Opgevoed' means 'raised' or 'brought up' (morally/socially), whereas 'educated' translates to 'opgeleid' or 'geschoold'.
- **Fix:** Remove the second sense or change the translation to 'brought up'.

### `gloria` — EXAMPLE
- **aktuell:** glory (noun)
- **Problem:** The standard Dutch word for glory is 'glorie'. 'Gloria' is Latin and only used in specific fixed expressions (like 'in de gloria'). 'Eeuwige gloria' is unnatural in Dutch.
- **Fix:** Change the headword to 'glorie' and update the example sentence to use 'glorie'.

### `inzet` — MEANING
- **aktuell:** stake (noun) | effort (noun) | kick-off (noun)
- **Problem:** The third sense 'kick-off' is incorrect. 'Inzet' does not mean the kick-off of a sports match; the correct Dutch word for this is 'aftrap'.
- **Fix:** Remove the third sense ('kick-off').

### `hamer` — MEANING
- **aktuell:** Hammer (noun)
- **Problem:** The English translation 'Hammer' is capitalized, which is grammatically incorrect for a common noun in English.
- **Fix:** Change 'Hammer' to lowercase 'hammer'.

### `pissen` — EXAMPLE
- **aktuell:** urinate (verb) | pee (verb)
- **Problem:** The example sentence uses the verb 'plassen' instead of the headword 'pissen'.
- **Fix:** Change 'plassen' to 'pissen' in the example sentence: 'De hond moet pissen.'

## nl-es  (10)

### `zal` — MEANING
- **aktuell:** futuro (verbo auxiliar)
- **Problem:** The Spanish translation 'futuro' is a noun, whereas 'zal' is a conjugated form of the auxiliary verb 'zullen' used to form the future tense.
- **Fix:** Change the translation to 'ir a' (as an auxiliary) or specify that it is an auxiliary verb used to form the future tense.

### `ontmoeten` — MEANING
- **aktuell:** encontrar (verbo)
- **Problem:** The Spanish translation 'encontrar' means 'to find' (vinden). 'Ontmoeten' means 'to meet', which translates to 'encontrarse con' or 'conocer'.
- **Fix:** Change the translation to 'encontrarse con' or 'conocer'.

### `sommige` — POS
- **aktuell:** algunos (pronombre)
- **Problem:** In the example 'Sommige mensen...', 'sommige' acts as a determiner or indefinite adjective, not a pronoun.
- **Fix:** Change the part of speech from 'pronombre' to 'determinante' or 'adjetivo'.

### `iedere` — EXAMPLE
- **aktuell:** cada (determinante)
- **Problem:** The example sentence uses 'Iedereen' (everyone) instead of the headword 'iedere' (each/every).
- **Fix:** Change the example sentence to use 'iedere', e.g., 'Iedere dag leest hij een boek.' (Cada día lee un libro.)

### `wegwezen` — EXAMPLE
- **aktuell:** irse (verbo) | desaparecer (verbo)
- **Problem:** The Dutch sentence 'Als je niet oppast, ben je wegwezen.' is grammatically incorrect. It should be 'ben je weg' or 'moet je wegwezen'.
- **Fix:** Remove the incorrect second sense and its example, as 'wegwezen' is primarily used as 'irse' / 'largarse'.

### `date` — MEANING
- **aktuell:** cita (sustantivo) | fecha (sustantivo)
- **Problem:** In Dutch, 'date' only refers to a romantic appointment or a romantic partner. It does not mean a calendar date ('fecha'), which is 'datum' in Dutch. The example 'Wat is de date van vandaag?' is incorrect.
- **Fix:** Remove the second sense ('fecha') and its example entirely.

### `originele` — POS
- **aktuell:** original (adjetivo)
- **Problem:** The headword is the inflected form 'originele'. In a dictionary, the uninflected lemma 'origineel' should be used as the headword.
- **Fix:** Change the headword 'originele' to 'origineel'.

### `jongedame` — MEANING
- **aktuell:** joven dama (sustantivo)
- **Problem:** 'joven dama' is a literal translation and not a natural dictionary translation for 'jongedame' in Spanish.
- **Fix:** Change the Spanish translation to 'señorita'.

### `rondlopen` — EXAMPLE
- **aktuell:** andar (verbo) | dar vueltas (verbo)
- **Problem:** The first example sentence 'Hij loopt graag door het park.' uses the verb 'lopen' instead of the headword 'rondlopen'.
- **Fix:** Change the example to 'Hij loopt graag rond in het park.'

### `daten` — EXAMPLE
- **aktuell:** tener citas (verbo)
- **Problem:** The Dutch sentence 'Ze gaan al een paar maanden daten.' is grammatically incorrect; 'gaan' (future/inchoative) cannot be combined with 'al een paar maanden' (duration up to the present).
- **Fix:** Change the example to 'Ze daten al een paar maanden.' or 'Ze zijn al een paar maanden aan het daten.'

## nl-fr  (9)

### `zal` — POS
- **aktuell:** futur (verbe auxiliaire)
- **Problem:** The French translation 'futur' is a noun, but the part of speech is listed as 'verbe auxiliaire'. 'Zal' (from 'zullen') should be translated using a verb like 'aller' (to express the future) or the entry should be for 'zullen'.
- **Fix:** Change the translation to 'aller' or 'devoir', or change the headword to 'zullen' with appropriate translations.

### `eigenlijk` — EXD
- **aktuell:** en fait (adverbe) | véritable (adjectif)
- **Problem:** The French translation 'Qu'est-ce qu'il est en fait en train de faire ?' is highly unnatural. 'en fait' is poorly placed and does not fit the context of 'eigenlijk' here (which means 'au juste').
- **Fix:** Change the translation of the example to 'Qu'est-ce qu'il fait au juste ?' or 'Qu'est-ce qu'il est en train de faire, au juste ?'.

### `cia` — EXAMPLE
- **aktuell:** salut (interjection)
- **Problem:** The headword is misspelled as 'cia', while the example correctly uses 'Ciao'.
- **Fix:** Change the headword to 'ciao'.

### `elf` — MEANING
- **aktuell:** onze (déterminant numéral) | lutin (nom)
- **Problem:** The translation 'lutin' corresponds to 'kabouter' in Dutch. A mythical 'elf' is translated as 'elfe' in French.
- **Fix:** Change the translation 'lutin' to 'elfe'.

### `prins` — MEANING
- **aktuell:** prince (nom) | enfant royal (nom)
- **Problem:** The second sense 'enfant royal' (royal child) is a definition rather than a translation. 'Prins' translates directly to 'prince'.
- **Fix:** Remove the second sense or change the translation to 'prince'.

### `aard` — EXAMPLE
- **aktuell:** caractère (nom) | nature (nom) | sorte (nom)
- **Problem:** In the first example, 'goedhartig' must be inflected to 'goedhartige' because 'aard' is a de-word. Additionally, 'Wat voor aard is dat?' is highly unnatural Dutch for 'Quelle sorte est-ce?'.
- **Fix:** Change the first example to 'Hij heeft een goedhartige aard.' and replace the third sense with a natural expression like 'van tijdelijke aard' (de nature temporaire).

### `earl` — EXAMPLE
- **aktuell:** comte (nom)
- **Problem:** The Count of Flanders was a 'graaf', not an 'earl' (which is a title exclusive to the British peerage).
- **Fix:** Change the example to: 'De Britse edelman kreeg de titel van earl.' (Le noble britannique a reçu le titre d'earl.)

### `oven` — MEANING
- **aktuell:** four (nom) | cuisinière (nom)
- **Problem:** An 'oven' is a 'four'. A 'cuisinière' (stove) is 'fornuis' in Dutch. Furthermore, an oven is not part of a 'kookplaat' (cooktop).
- **Fix:** Remove the second sense ('cuisinière') entirely.

### `foster` — MEANING
- **aktuell:** nourrir (verbe)
- **Problem:** 'foster' is not a Dutch word. The example sentence incorrectly uses the English verb 'to foster' as if it were Dutch.
- **Fix:** Remove the entry 'foster' entirely, or replace it with the correct Dutch verb 'koesteren' (chérir).

## nl-it  (11)

### `zal` — POS
- **aktuell:** futuro (verbo ausiliare) | volontà (verbo ausiliare)
- **Problem:** The translations 'futuro' and 'volontà' are nouns, which do not match the part of speech 'verbo ausiliare'. 'Zal' is an auxiliary verb and should be listed under its infinitive 'zullen' with appropriate translations like 'dovere' or 'volere'.
- **Fix:** Change the headword to 'zullen', and provide correct translations and parts of speech.

### `groot` — MEANING
- **aktuell:** grande (aggettivo) | importante (aggettivo)
- **Problem:** The translation 'importante' does not match the example 'groot aandeel', which is translated as 'grande partecipazione' (where 'groot' means 'grande' or 'cospicuo').
- **Fix:** Change the translation of the second sense to 'grande' or 'considerevole', or use an example like 'een groot denker' (un grande pensatore).

### `daardoor` — EXD
- **aktuell:** quindi (avverbio) | attraverso ciò (avverbio)
- **Problem:** The Italian translation 'attraverso ciò' is highly unnatural in this context. 'Daardoor' in the example means 'per questo' or 'di conseguenza'.
- **Fix:** Change 'attraverso ciò' to 'per questo' or 'di conseguenza' in both the translation and the example translation.

### `jay` — MEANING
- **aktuell:** Giacomo (nome proprio)
- **Problem:** 'Jay' is an English proper name, not a Dutch word meaning 'Giacomo'.
- **Fix:** Remove this entry from the Dutch dictionary.

### `weggaat` — EXAMPLE
- **aktuell:** andarsene, partire (verbo)
- **Problem:** The headword is 'weggaat' (an inflected form), but the example sentence 'Hij gaat morgen weg' does not contain this word (it uses 'gaat weg'). The headword should be the infinitive 'weggaan'.
- **Fix:** Change the headword to 'weggaan' and ensure the example matches.

### `afdrukken` — POS
- **aktuell:** impronte (sostantivo) | stampare (verbo)
- **Problem:** The headword 'afdrukken' is primarily the infinitive verb meaning 'stampare'. The noun sense 'impronte' is the plural of 'afdruk' (noun) and should be under a separate entry 'afdruk', especially since the example uses the compound 'vingerafdrukken'.
- **Fix:** Set 'afdrukken' only as a verb meaning 'stampare', and create a separate entry for 'afdruk' (noun, meaning 'impronta').

### `homer` — MEANING
- **aktuell:** Omero (nome proprio)
- **Problem:** The Dutch name for the Greek poet Homer is 'Homerus'. 'Homer' is English.
- **Fix:** Change the headword to 'Homerus' and update the example sentence accordingly.

### `road` — MEANING
- **aktuell:** strada (sostantivo)
- **Problem:** The word 'road' is English. The Dutch word for 'strada' is 'weg' or 'straat'.
- **Fix:** Change the headword to 'weg' or 'straat'.

### `klop` — POS
- **aktuell:** colpo (sostantivo) | battere (verbo)
- **Problem:** The headword 'klop' is a noun. The verb 'to knock/beat' is 'kloppen'. The second sense 'battere' (verbo) and its example 'klopten' belong to the verb 'kloppen'.
- **Fix:** Remove the verb sense from 'klop' or change the headword to 'kloppen'.

### `hunt` — MEANING
- **aktuell:** caccia (sostantivo)
- **Problem:** The word 'hunt' is English. The Dutch word for 'caccia' is 'jacht'.
- **Fix:** Change the headword to 'jacht' and the example to 'De jacht op de vos was succesvol.'

### `frasier` — MEANING
- **aktuell:** frattura (sostantivo)
- **Problem:** The word 'frasier' is not a Dutch word. The Dutch word for fracture is 'fractuur'.
- **Fix:** Change the headword to 'fractuur' and the example to 'De dokter stelde een fractuur vast.'

