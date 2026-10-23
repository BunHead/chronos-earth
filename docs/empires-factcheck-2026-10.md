# Empires, states, dynasties and campaigns — Wikidata fact-check, October 2026

Run with `node scripts/factcheck-empires.mjs --out report.json` (read-only; it
changes nothing). Last run 21 Oct 2026.

## What was checked

| Source | Entries | How |
|---|---:|---|
| Capital roles (`capitalOf` on city rows, `imported/events.json`) | 431 cities, 854 roles | city's P1376 + P580/P582, polity P571/P576, city pin vs P625 |
| Polity lifespans (`scripts/data/polity-class.json`) | 723 | P571 / P576 asked again |
| Border owner names (`borders/countries.json`, all 37 snapshots) | 1,712 names | English label/alias among states, empires, kingdoms, dynasties, cultures, peoples; snapshot years vs lifespan |
| Campaign fronts (`campaigns.json`) | 10 | the war's P580/P582 via its English Wikipedia article |
| **Total** | **2,876** | |

Every date is read with its Wikidata precision (`wdqsYearAt`), so 550 BCE is
-550 and not -549. No BCE off-by-one (year-0) slip was found in the data.

## What was fixed — 74 corrections

### Capital roles that began after they ended (10 roles, 6 cities)

**Shared cause.** When Wikidata gives a capital role no start date,
`fetch-capitals` borrowed the polity's start, but clamped it to the city's own
start year. Some cities carry a modern date (municipal incorporation), so the
role started centuries after it ended. Fixed in `borrowedRoleStart()`
(`scripts/fetch-capitals.mjs`), then re-fetched with
`node scripts/fetch-capitals.mjs --only Q11592,Q26418,Q384,Q27860,Q10126,Q131694`.

| City | Polity | Before | After |
|---|---|---|---|
| Skopje (Q384) | Serbian Empire (Q1406298) | 1991 → 1371 | 1346 → 1371 |
| Skopje (Q384) | Kingdom of Serbia (Q2415003) | 1991 → 1346 | 1217 → 1346 |
| Skopje (Q384) | First Bulgarian Empire (Q203817) | 1991 → 1018 | 681 → 1018 |
| Aden (Q131694) | Colony of Aden (Q49910) | 2015 → 1963 | 1937 → 1963 |
| Aden (Q131694) | Federation of South Arabia (Q834486) | 2015 → 1967 | 1962 → 1967 |
| Aden (Q131694) | South Yemen (Q199841) | 2015 → 1990 | 1967 → 1990 |
| Jayapura (Q27860) | Netherlands New Guinea (Q941881) | 1993 → 1962 | 1949 → 1962 |
| Serang (Q10126) | Banten Sultanate (Q734867) | 2007 → 1813 | 1527 → 1813 |
| Sonoma (Q11592) | California Republic (Q17557) | 1883 → 1846 | 1846 → 1846 |
| Hakodate (Q26418) | Republic of Ezo (Q714006) | 1922 → 1869 | 1869 → 1869 |

Guard: `src/lib/empiresFactcheck.test.ts` fails if any role starts after it ends.

### Border owners drawn under a state that did not exist yet / any more (7 names, 9 dated renames)

Dated renames in `scripts/fix-border-names.mjs` (same mechanism as Burma → Myanmar).
Each was checked against the polygon's place on the map.

| Snapshot | Before | After | Why (Wikidata) |
|---|---|---|---|
| 1715, 1783, 1800 | Austrian Empire | Habsburg Monarchy (Q153136) | Austrian Empire Q131964 founded 1804 |
| 1880 | Kingdom of Brazil | Empire of Brazil (Q217230) | Kingdom Q3932042 was 1815–1822 |
| 1900 | Kingdom of Brazil | Brazil | Republic from 1889 |
| 700 | Sui Empire | Tang Empire (Q9683) | Sui Q7405 ended 618 |
| 500 | Jin Empire (south China) | Southern Qi (Q62456) | Eastern Jin Q7352 ended 420 |
| 1783 | Golconda | Nizam's Dominions (Q1240096) | Golconda Q19805959 fell 1687 |
| 1279 | Kediri | Singhasari (Q2060657) | Kediri Q756895 ended 1222 |
| 1400 | Kediri | Majapahit (Q49326) | founded 1293 |
| 1200 | Liao (north China) | Jin Empire (Jurchen, Q5066) | Liao Q4958 fell 1125 |

### Misspelt or broken owner names (55 names)

Spelling only — no polygon moved. Examples: Anglo-Egyption → Anglo-Egyptian
Sudan; Kingfom of Italy → Kingdom of Italy; Kongldom of Hawaii → Kingdom of
Hawaii; Sultinate of Zanzibar; Scottland / Scottalnd → Scotland; Burgandy;
Britany; Castille; Poland-Llituania; Cuacasian Albania; Cyraneica / Tripolitana
(UK Lybia) and Fezzan (Frech Lybia) → Libya; Mamluke; Bosporian; Quazaq Khanate →
Kazakh Khanate; Kwarezm; Cimerians; Cherookee; Chicaksaw; Tlinoit → Tlingit;
Gilbert and Elice Islands; Walbis Bay. Broken characters: `Monte Alb?n`,
`Monte Alb�n`, `Monte Albàn` → Monte Albán; `Teotihuac�n`, `Teotihuacàn` →
Teotihuacán; `CochimÃ­` → Cochimí; `M?ori` → Maori. The full list is in
`scripts/fix-border-names.mjs`. Side effect: Scotland in 1500/1650 and Italy in
1914 now get their flags, which match on the name.

## Doubtful — left alone on purpose

| Entry | Ours | Wikidata | Why not changed |
|---|---|---|---|
| London — capital of United Kingdom (Q145) | from 1801 | 1921 / 1927 | Q145 is the post-1922 UK; 1801 (Acts of Union) is right for the UK as a whole |
| Warsaw — Second Polish Republic (Q207272) | to 1939 | to 1945 | government in exile until 1945; Warsaw stopped being its capital in 1939 |
| Bridgetown — Barbados (Q244) | from 1966 | inception 1623 | independence vs. colony; both defensible |
| Tehran — Qajar Iran (Q63158027) | from 1789 | 1785 | sources say 1785 or 1786; Wikidata's polity starts 1789 |
| Ho Chi Minh City — PRG of South Vietnam (Q1072362) | from 1975 | 1969 | the PRG formed 1969 but held Saigon only from 1975 |
| Baku — Kingdom of Shirvan (Q17526620) | from 1191 | 861 | capital moved to Baku after the 1191 Shamakhi earthquake |
| Pyongyang — Goguryeo | from 427 | 37 BCE | hand ruling already in `ROLE_STARTS` |
| Skopje — First Bulgarian Empire | 681 → 1018 | role undated | Skopje was its capital only briefly; Wikidata gives no start, so the empire's own start is used |
| 15 roles "not on Wikidata" (e.g. Damascus — Syrian Arab Republic, East Berlin — GDR, Jakarta — Dutch East Indies) | kept | label renamed or statement removed since harvest | the roles are historically right |
| 4 polity lifespans changed on Wikidata since cached (UK, Barbados, Second Polish Republic, Democratic Federal Yugoslavia) | cache | new values | definitional choices, see above |
| 32 polities with several start/end values (France 481/843/1804, Spain 1516/1715/1812…, Afghanistan 11 values) | earliest/latest | several | no single right answer |
| 1650 "Austrian Empire" sliver near Königsberg | kept | — | tiny polygon, owner unclear (probably Ducal Prussia); needs a human eye |
| "Denmark-Norway" in 1000, "Poland-Lithuania" in 1400/1500, "Netherlands Antilles" 1715–1900, "Dutch East Indies" 1650/1715 | kept | later formal dates | informal names for earlier unions/colonies; arguable |
| "Huari Empire", "Toltec Empire", "Kamarupa", "Nogai Horde", "Urartu", "Elam", "Xia" drawn past/before Wikidata's dates | kept | fuzzy or legendary dates | gradual rise and fall |
| "Seljuk/Zayyanid/Wattasid/Tukular Caliphate", "Kingdom of David and Solomon" | kept | — | wrong or contested titles, but renaming a state is a judgement for the Captain |
| Heptarchy (`heptarchy.json`): all nine kingdoms drawn 520–900 | kept | Northumbria from 654; Essex, Kent, Sussex absorbed 825–871 | hand-drawn and labelled "deliberately approximate" |
| Campaign "Rome — Republic to Empire" -264 → 476 | kept | Ancient Rome Q1747689, -753 → | a span of conquests, no single war item |
| ~100 other border names drawn outside a matched item's lifespan | kept | — | geographic names reused across eras ("Egypt", "Armenia") or the label matched a namesake (Silla → South Korea) |
| 1,006 border names with no Wikidata match | — | — | mostly peoples, cultures and Aboriginal nations; the misspelt ones among them are fixed above |

Campaigns: all 10 fronts fall inside their war's dates (Napoleon in Russia
Q179250, Western Front Q152989, Eastern Front Q189266, Western Front WW2
Q216184, Alexander Q551888, Mongols Q2092093, North Africa Q218678,
Russo-Ukrainian war Q110999040, Qin unification Q2986801).

Pins: no capital city pin was more than 5 km from its Wikidata P625.

## Removed code

None. No dead empire-data code was found.

## Regenerating after a rebase

`public/data/borders/*` and `countries.json`: `node scripts/fix-border-names.mjs && node scripts/build-country-index.mjs`.
Capital roles: `node scripts/fetch-capitals.mjs --only Q11592,Q26418,Q384,Q27860,Q10126,Q131694`.
Then `npm run build:core` for `core-index*` and `detail/*`.
