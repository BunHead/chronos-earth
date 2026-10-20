# Places fact-check against Wikidata — October 2026

_Run on 20 Oct 2026 with `node scripts/factcheck-places.mjs`. The tables at the end are what the script
writes with `--report <file>`; the parts above them are the human read of it._

## What was checked

Every row on `main` that links a Wikidata item, in three layers:

| Layer | Where | Rows |
|---|---|---|
| Monuments, ancient sites, curated places | `ancient-sites.json` (26), monument rows and curated city rows of `imported/events.json` and the region chunks | 1,397 |
| Battles | `battles.json` (190), battle rows of `imported/events.json` and the region chunks | 5,187 |
| Empires, campaigns, borders | `campaigns.json`, `borders/*.geojson` | 0 — none of them carry a Q-id |

6,580 rows were checked (4 curated battles could not be matched to an item — see the end).
People were left out: they are covered by #50.

For each row:

1. **Pin** vs Wikidata **P625**: flagged if more than 5 km off, or if our pin is on whole degrees while P625 is precise.
2. **Year** vs **P571 / P580 / P582 / P585 / P576**, with BCE counted the ordinary way (no year 0).
   A battle dated anywhere between its own start and end is fine.
3. **Name** vs the English label, and whether the Q-id is a **disambiguation page**.
4. Where Wikidata is unclear (several values, only a century, a point rounded to whole degrees or 0.1°,
   two round-number estimates) the row goes to **doubtful** and is not changed.

## What was fixed (11 rows)

| Row | Q-id | Before | After | Why |
|---|---|---|---|---|
| Chactún (Maya) `cur-chactun` | [Q13518345](https://www.wikidata.org/wiki/Q13518345) | 18.7213, -89.526 | 18.455, -89.5081 | Pin moved **29.7 km**. It had Minanbé's latitude copied onto it. |
| Eleventh Battle of the Isonzo `q1187701` | [Q1187701](https://www.wikidata.org/wiki/Q1187701) | 45.8, 13.5333 | 46.0462, 13.6437 | Pin moved **28.7 km**, onto the Bainsizza plateau. |
| Battle of Yamen `yamen` | [Q1078359](https://www.wikidata.org/wiki/Q1078359) | 22.17, 113 | 22.27, 113.08 | Pin moved **13.8 km**. The longitude was a whole degree. |
| Rock-hewn Churches of Ivanovo `q503387` | [Q503387](https://www.wikidata.org/wiki/Q503387) | AD 13 | 1200 | Wikidata has the year "13", meaning the 13th century. Wikidata is still wrong, so the fix is in `accuracy-fixes.json`. |
| Trinidad and the Valley de los Ingenios `q15819677` | [Q15819677](https://www.wikidata.org/wiki/Q15819677) | AD 16 | 1514 | Same fault ("16" = the 16th century). Trinidad was founded in 1514. Fix is in `accuracy-fixes.json`. |
| Ruins of Gedi `q502518` | [Q502518](https://www.wikidata.org/wiki/Q502518) | AD 13 | 1200 | Same fault, since fixed on Wikidata ("13th century"). |
| Songo Mnara `q2301527` | [Q2301527](https://www.wikidata.org/wiki/Q2301527) | AD 14 | 1300 | Same fault, since fixed on Wikidata ("14th century"). |
| Haji Piyada mosque `q3125809` | [Q3125809](https://www.wikidata.org/wiki/Q3125809) | AD 9 | 800 | Same fault, since fixed on Wikidata ("9th century"). |
| Studenica monastery `q143042` | [Q143042](https://www.wikidata.org/wiki/Q143042) | 1101 | 1186 | Wikidata P571 is 1186. |
| Badajoz Cathedral `q2942592` | [Q2942592](https://www.wikidata.org/wiki/Q2942592) | 1230 | 1255 | Wikidata P571 is 1255 (1230 is the year the town was retaken). |
| Battle of the Delta `q1036947` | [Q1036947](https://www.wikidata.org/wiki/Q1036947) | 1179 BCE | 1178 BCE | BCE off-by-one. Wikidata P585 is 1178 BCE. |

The derived files (`core-index*`, `detail/`) were rebuilt with `npm run build:core`.
`scripts/add-curated-places.mjs` got the Chactún fix too, so a rebuild cannot put it back.

No Q-id was a disambiguation page. No name needed changing: every name that differs from its label is either
the same place under another name or a row that links a bigger article on purpose (see doubtful below).

## Shared causes, and the guards added

1. **The check that should have caught these never ran.** `fetchP625` (the 25 km pin lint, `npm run lint:wikidata`)
   sent `normalize=1` with 50 titles. Wikidata only allows that with one title, so it answered an error and the
   lint checked **no curated battle or site at all**. Fixed in `scripts/lib/wikidata-coords.mjs`; it now also
   fails loudly when Wikidata refuses a request.
2. **A century typed as a year.** Wikidata editors had entered "13" (precision: year) for "13th century"; the
   harvest copied it. 5 monuments were fixed. The same fault is on 3 *cities* (Ikeja "15", Lafia "17",
   Ilorin "18"), outside this sweep — left for a follow-up.
3. **Hand-typed pins**: one copied from the entry beside it (Chactún), and one rounded to a whole degree (Yamen).
   There is no geocoding fallback or country-centre default behind them.

`src/lib/placesFactcheck.test.ts` guards all three: no monument/city/battle dated AD 1–21 unless on a checked
list; no two curated pins far apart share a 4-decimal latitude or longitude; no curated battle or site pin with
a whole-degree latitude or longitude unless on a checked list; and `fetchP625` must not send `normalize` with
many titles. It also spot-checks the fixed ids, coordinates and dates. Each guard fails on the old data.

## Left as is, after a look (the "still different" table below)

These are more than 5 km from Wikidata, or a different year, but our value is the better one or both are fair:

- **Wide-area fights** — the pin is on the heart of it, Wikidata on another part: Spanish Armada (Gravelines vs Plymouth),
  Bulge, D-Day, Falaise Pocket, Chosin Reservoir, First Marne, Trafalgar, Leyte Gulf, Falklands War,
  Cavernas do Peruaçu (a national park).
- **Wikidata pins the town the battle is named after**, ours the field: Königgrätz (Chlum, not Hradec Králové),
  Amiens 1918, Adwa, Alcácer Quibir.
- **Rough Wikidata points**: Manzikert (both rows), Tannenberg 1914 (quarter degrees), Rakhigarhi (2 decimals; ours
  matches the village), Ad Decimum (we can't tell which is closer to the 10th milestone).
- **Minanbé**: it has no Wikidata item of its own; its Q-id is the Calakmul Biosphere Reserve it lies in.
- **Dates that are estimates on both sides**: Temple of Artemis (Wikidata dates the rebuild), Mausoleum, Colossus and
  Lighthouse ("c." dates 1–4 years apart), Colosseum (opened 80; Wikidata 82), Naqsh-e Jahan (1598 vs 1591),
  Ruins of St. Paul's (1835 is the fire, not the build), Benin City (Wikidata dates the 1899 town), Serengeti (park 1951,
  game reserve 1940).
- **Wikidata is wrong**: Battle of the Alamo has start/end time 2001.

Wikipedia could not be reached from the checking machine (network policy), so the Wikipedia "third opinion"
step in the script was skipped this time; it runs when Wikipedia is reachable.

**Not checked** (title did not match an item, probably a redirect): `badger-mouth` (Battle of Yehuling),
`pusan-perimeter`, `khe-sanh`, `annexation-of-crimea`.

## Re-running

```
node scripts/factcheck-places.mjs                                  # live, ~35 polite queries, prints a summary
node scripts/factcheck-places.mjs --cache /tmp/wd.json --report out.md   # save / reuse the answers, write the tables
```

## Full findings after the fixes

Wikidata answers fetched 2026-10-20T15:29:14.726Z. Rows: 1397 monuments/places, 5187 battles, 0 empire/campaign/border Q-ids. Checked 6580; 4 had no Wikidata item.

### Still different from Wikidata (29)

| Layer | Row | Q-id | Name | Finding |
|---|---|---|---|---|
| battles | battles.json `adwa` | [Q302519](https://www.wikidata.org/wiki/Q302519) | Battle of Adwa | pin 18.6 km from Wikidata P625 |
| battles | battles.json `alcacer-quibir` | [Q1121532](https://www.wikidata.org/wiki/Q1121532) | Battle of Alcácer Quibir | pin 6.9 km from Wikidata P625 |
| battles | battles.json `amiens-1918` | [Q911448](https://www.wikidata.org/wiki/Q911448) | Battle of Amiens | pin 18.5 km from Wikidata P625 |
| battles | battles.json `bulge` | [Q151018](https://www.wikidata.org/wiki/Q151018) | Battle of the Bulge | pin 55.4 km from Wikidata P625 |
| battles | battles.json `chosin-reservoir` | [Q277337](https://www.wikidata.org/wiki/Q277337) | Battle of Chosin Reservoir | pin 11.2 km from Wikidata P625 |
| battles | battles.json `d-day` | [Q16470](https://www.wikidata.org/wiki/Q16470) | D-Day (Normandy Landings) | pin 10.9 km from Wikidata P625 |
| battles | battles.json `falaise-pocket` | [Q602744](https://www.wikidata.org/wiki/Q602744) | Falaise Pocket | pin 14.8 km from Wikidata P625 |
| battles | battles.json `falklands-1982` | [Q48249](https://www.wikidata.org/wiki/Q48249) | The Falklands War | pin 78.8 km from Wikidata P625 |
| battles | battles.json `koniggratz` | [Q154942](https://www.wikidata.org/wiki/Q154942) | Battle of Königgrätz | pin 10.6 km from Wikidata P625 |
| battles | battles.json `leyte-gulf` | [Q308999](https://www.wikidata.org/wiki/Q308999) | Battle of Leyte Gulf | pin 71.8 km from Wikidata P625 (our pin is whole-degree) |
| battles | battles.json `manzikert` | [Q200032](https://www.wikidata.org/wiki/Q200032) | Battle of Manzikert | pin 7.0 km from Wikidata P625 |
| battles | battles.json `marne-1914` | [Q190712](https://www.wikidata.org/wiki/Q190712) | First Battle of the Marne | pin 6.4 km from Wikidata P625 |
| battles | imported/events.json `q1127353` | [Q1127353](https://www.wikidata.org/wiki/Q1127353) | Battle of Ad Decimum | pin 9.8 km from Wikidata P625 |
| battles | imported/events.json `q200032` | [Q200032](https://www.wikidata.org/wiki/Q200032) | Battle of Manzikert | pin 6.6 km from Wikidata P625 |
| battles | battles.json `spanish-armada` | [Q179684](https://www.wikidata.org/wiki/Q179684) | Defeat of the Spanish Armada | pin 459.4 km from Wikidata P625 |
| battles | battles.json `tannenberg-1914` | [Q153858](https://www.wikidata.org/wiki/Q153858) | Battle of Tannenberg | pin 37.2 km from Wikidata P625 |
| battles | battles.json `trafalgar` | [Q171416](https://www.wikidata.org/wiki/Q171416) | Battle of Trafalgar | pin 6.7 km from Wikidata P625 |
| battles | battles.json `alamo` | [Q235344](https://www.wikidata.org/wiki/Q235344) | Battle of the Alamo | year 1836 vs Wikidata 2001 |
| monuments | imported/events.json `cur-city-rakhigarhi` | [Q3418050](https://www.wikidata.org/wiki/Q3418050) | Rakhigarhi | pin 14.4 km from Wikidata P625 |
| monuments | ancient-sites.json `minanbe` | [Q3457136](https://www.wikidata.org/wiki/Q3457136) | Minanbé (Maya) | pin 13.8 km from Wikidata P625 |
| monuments | imported/events.json `q1051873` | [Q1051873](https://www.wikidata.org/wiki/Q1051873) | Cavernas do Peruaçu National Park | pin 10.9 km from Wikidata P625 |
| monuments | ancient-sites.json `colossus-of-rhodes` | [Q41553](https://www.wikidata.org/wiki/Q41553) | Colossus of Rhodes | year -280 vs Wikidata -284 |
| monuments | imported/events.json `cur-benin-city` | [Q320704](https://www.wikidata.org/wiki/Q320704) | Benin City | year 1180 vs Wikidata 1899 |
| monuments | imported/events.json `cur-colosseum` | [Q10285](https://www.wikidata.org/wiki/Q10285) | Colosseum | year 80 vs Wikidata 82 |
| monuments | ancient-sites.json `lighthouse-of-alexandria` | [Q43244](https://www.wikidata.org/wiki/Q43244) | Lighthouse of Alexandria (Pharos) | year -280 vs Wikidata -279 (BCE off-by-one) |
| monuments | ancient-sites.json `mausoleum-halicarnassus` | [Q45368](https://www.wikidata.org/wiki/Q45368) | Mausoleum at Halicarnassus | year -350 vs Wikidata -351 (BCE off-by-one) |
| monuments | imported/events.json `q1551411` | [Q1551411](https://www.wikidata.org/wiki/Q1551411) | Ruins of St. Paul's | year 1602 vs Wikidata 1835 |
| monuments | imported/events.json `q4519` | [Q4519](https://www.wikidata.org/wiki/Q4519) | Naqsh-e Jahan Square | year 1598 vs Wikidata 1591 |
| monuments | ancient-sites.json `temple-of-artemis` | [Q43018](https://www.wikidata.org/wiki/Q43018) | Temple of Artemis at Ephesus | year -550 vs Wikidata -323 |

### Doubtful (Wikidata unclear) (27)

| Layer | Row | Q-id | Name | Finding |
|---|---|---|---|---|
| battles | battles.json `adrianople-378` | [Q192473](https://www.wikidata.org/wiki/Q192473) | Battle of Adrianople | pin 14 km from a rough (0.1°) Wikidata point |
| battles | battles.json `chalons` | [Q139808](https://www.wikidata.org/wiki/Q139808) | Battle of the Catalaunian Plains | pin 12 km from a whole-degree Wikidata point |
| battles | battles.json `jutland` | [Q156554](https://www.wikidata.org/wiki/Q156554) | Battle of Jutland | pin 23 km from a rough (0.1°) Wikidata point |
| battles | battles.json `tet-offensive` | [Q82542](https://www.wikidata.org/wiki/Q82542) | The Tet Offensive | pin 41 km from a whole-degree Wikidata point |
| battles | battles.json `carthage-146bce` | [Q6334](https://www.wikidata.org/wiki/Q6334) | Siege of Carthage | name "Siege of Carthage" vs Wikidata label "Third Punic War" |
| battles | battles.json `chalons` | [Q139808](https://www.wikidata.org/wiki/Q139808) | Battle of the Catalaunian Plains | name "Battle of the Catalaunian Plains" vs Wikidata label "Battle of the Maureaco Fields" |
| battles | battles.json `d-day` | [Q16470](https://www.wikidata.org/wiki/Q16470) | D-Day (Normandy Landings) | name "D-Day (Normandy Landings)" vs Wikidata label "Normandy landings" |
| battles | battles.json `desert-storm` | [Q37643](https://www.wikidata.org/wiki/Q37643) | Operation Desert Storm | name "Operation Desert Storm" vs Wikidata label "Gulf War" |
| battles | battles.json `gate-pa` | [Q7688846](https://www.wikidata.org/wiki/Q7688846) | Battle of Gate Pā | name "Battle of Gate Pā" vs Wikidata label "Tauranga campaign" |
| battles | battles.json `orakau` | [Q5919478](https://www.wikidata.org/wiki/Q5919478) | Battle of Ōrākau | name "Battle of Ōrākau" vs Wikidata label "Invasion of the Waikato" |
| battles | battles.json `passchendaele` | [Q426227](https://www.wikidata.org/wiki/Q426227) | Battle of Passchendaele (Third Ypres) | name "Battle of Passchendaele (Third Ypres)" vs Wikidata label "Third Battle of Ypres" |
| battles | imported/events.json `q138025` | [Q138025](https://www.wikidata.org/wiki/Q138025) | Siege of Veprik | name "Siege of Veprik" vs Wikidata label "Siege of Vepryk" |
| battles | imported/events.json `q2348233` | [Q2348233](https://www.wikidata.org/wiki/Q2348233) | Mehmed II's 1467 Albanian campaign | name "Mehmed II's 1467 Albanian campaign" vs Wikidata label "Siege of Krujë" |
| monuments | ancient-sites.json `catalhoyuk` | [Q192522](https://www.wikidata.org/wiki/Q192522) | Çatalhöyük | year -7100 vs Wikidata -7500 (both round estimates) |
| monuments | imported/events.json `cur-city-lagash` | [Q207330](https://www.wikidata.org/wiki/Q207330) | Lagash | year -2900 vs Wikidata -2500 (both round estimates) |
| monuments | imported/events.json `cur-city-uruk` | [Q168518](https://www.wikidata.org/wiki/Q168518) | Uruk | year -4000 vs Wikidata -3200 (both round estimates) |
| monuments | imported/events.json `cur-cusco` | [Q5582862](https://www.wikidata.org/wiki/Q5582862) | Cusco (Inca capital) | year 1100 vs several Wikidata years 1534, 1300 |
| monuments | imported/events.json `cur-lalibela` | [Q642979](https://www.wikidata.org/wiki/Q642979) | Rock churches of Lalibela | year 1181 vs Wikidata 1300 (only to the century) |
| monuments | imported/events.json `cur-meroe` | [Q5780](https://www.wikidata.org/wiki/Q5780) | Meroë (Kush) | year -800 vs Wikidata -2500 (both round estimates) |
| monuments | imported/events.json `cur-petra` | [Q5788](https://www.wikidata.org/wiki/Q5788) | Petra | year -300 vs Wikidata -800 (both round estimates) |
| monuments | ancient-sites.json `gunung-padang` | [Q3120910](https://www.wikidata.org/wiki/Q3120910) | Gunung Padang | year -800 vs Wikidata 500 (both round estimates) |
| monuments | ancient-sites.json `nazca-lines` | [Q2620036](https://www.wikidata.org/wiki/Q2620036) | Nazca Lines | year -400 vs Wikidata -200 (both round estimates) |
| monuments | imported/events.json `q16963755` | [Q16963755](https://www.wikidata.org/wiki/Q16963755) | Aigai | year -800 vs Wikidata -750 (both round estimates) |
| monuments | ancient-sites.json `stonehenge` | [Q39671](https://www.wikidata.org/wiki/Q39671) | Stonehenge | year -2500 vs several Wikidata years -3000, -1848 |
| monuments | imported/events.json `cur-city-hierakonpolis` | [Q278988](https://www.wikidata.org/wiki/Q278988) | Hierakonpolis (Nekhen) | name "Hierakonpolis (Nekhen)" vs Wikidata label "Nekhen" |
| monuments | ancient-sites.json `minanbe` | [Q3457136](https://www.wikidata.org/wiki/Q3457136) | Minanbé (Maya) | name "Minanbé (Maya)" vs Wikidata label "Calakmul Biosphere Reserve" |
| monuments | ancient-sites.json `sumerian-map-hypothesis` | [Q178835](https://www.wikidata.org/wiki/Q178835) | The 'Sumerian map' (ancient-astronaut hypothesis) | name "The 'Sumerian map' (ancient-astronaut hypothesis)" vs Wikidata label "Baalbek" |

### Kept on purpose (already documented) (29)

| Layer | Row | Q-id | Name | Finding |
|---|---|---|---|---|
| battles | battles.json `britain-1940` | [Q154720](https://www.wikidata.org/wiki/Q154720) | Battle of Britain | pin 315 km from a whole-degree Wikidata point — An air campaign over all of southern England; the pin is on London and the south-east. |
| battles | battles.json `coral-sea` | [Q207165](https://www.wikidata.org/wiki/Q207165) | Battle of the Coral Sea | pin 826.4 km from Wikidata P625 (our pin is whole-degree) — A carrier battle fought over hundreds of km of ocean; the pin sits in the middle of it. |
| battles | battles.json `kursk` | [Q130861](https://www.wikidata.org/wiki/Q130861) | Battle of Kursk | pin 85.8 km from Wikidata P625 — Wikidata pins the battle on Kursk city. The pin is on Prokhorovka, where the great tank clash of 12 July 1943 was fought (13 Oct 2026 review). |
| battles | battles.json `midway` | [Q173034](https://www.wikidata.org/wiki/Q173034) | Battle of Midway | pin 209 km from a whole-degree Wikidata point — A carrier battle fought over hundreds of km of ocean; the pin is on the atoll the fight was for. |
| battles | battles.json `noche-triste` | [Q1308854](https://www.wikidata.org/wiki/Q1308854) | La Noche Triste | pin 1607.4 km from Wikidata P625 — Wikidata's coordinates are wrong; the causeway retreat was in Tenochtitlan (Mexico City), where the pin is. Checked 13 Oct 2026. |
| battles | imported/events.json `q1049530` | [Q1049530](https://www.wikidata.org/wiki/Q1049530) | Battle of Karuse | pin 6 km from a whole-degree Wikidata point — Pin moved 6 km to the sourced location (Captain's pin review, 15 Oct 2026) |
| battles | imported/events.json `q111986066` | [Q111986066](https://www.wikidata.org/wiki/Q111986066) | Battle of the Siverskyi Donets | pin 20 km from a whole-degree Wikidata point — Pin moved 20 km to the sourced location (Captain's pin review, 15 Oct 2026) |
| battles | imported/events.json `q1355254` | [Q1355254](https://www.wikidata.org/wiki/Q1355254) | Battle of Poimanenon | pin 741.4 km from Wikidata P625 — Wikidata's coordinates for the Battle of Poimanenon are in Cilicia; the pin is on Poimanenon itself (see accuracy-fixes.json). |
| battles | imported/events.json `q1628477` | [Q1628477](https://www.wikidata.org/wiki/Q1628477) | Battle of Diu | pin 80 km from a whole-degree Wikidata point — Battle of Diu: Wikidata's coordinates are about 80 km out; the pin follows https://en.wikipedia.org/wiki/Battle_of_Diu. Checked 15 Oct 2026. |
| battles | imported/events.json `q1720307` | [Q1720307](https://www.wikidata.org/wiki/Q1720307) | Battle of the Hellespont | pin 138 km from a whole-degree Wikidata point — Battle of the Hellespont: Wikidata's coordinates are about 138 km out; the pin follows https://en.wikipedia.org/wiki/Dardanelles. Checked 15 Oct 2026. |
| battles | imported/events.json `q2469370` | [Q2469370](https://www.wikidata.org/wiki/Q2469370) | Battle of Motien Pass | pin 151 km from a whole-degree Wikidata point — Battle of Motien Pass: Wikidata's coordinates are about 151 km out; the pin follows https://www.wikidata.org/wiki/Q13748129. Checked 15 Oct 2026. |
| battles | imported/events.json `q2599728` | [Q2599728](https://www.wikidata.org/wiki/Q2599728) | Battle of the Niemen River | pin 22 km from a whole-degree Wikidata point — Pin moved 22 km to the sourced location (Captain's pin review, 15 Oct 2026) |
| battles | imported/events.json `q3394749` | [Q3394749](https://www.wikidata.org/wiki/Q3394749) | Siege of Diu | pin 79 km from a whole-degree Wikidata point — Siege of Diu: Wikidata's coordinates are about 79 km out; the pin follows https://en.wikipedia.org/wiki/Siege_of_Diu_(1538). Checked 15 Oct 2026. |
| battles | imported/events.json `q3625539` | [Q3625539](https://www.wikidata.org/wiki/Q3625539) | Siege of Uthman | pin 60 km from a whole-degree Wikidata point — Siege of Uthman: Wikidata's coordinates are about 60 km out; the pin follows https://en.wikipedia.org/wiki/Siege_of_Uthman. Checked 15 Oct 2026. |
| battles | imported/events.json `q3636516` | [Q3636516](https://www.wikidata.org/wiki/Q3636516) | Siege of Manzikert | pin 909 km from a whole-degree Wikidata point — Siege of Manzikert: Wikidata's coordinates are about 909 km out; the pin follows https://en.wikipedia.org/wiki/Siege_of_Manzikert_(1054). Checked 15 Oct 2026. |
| battles | imported/events.json `q3636565` | [Q3636565](https://www.wikidata.org/wiki/Q3636565) | Battle on the Po | pin 160 km from a whole-degree Wikidata point — Wikidata's point is rounded to (45, 8); the pin is on Cremona (see accuracy-fixes.json). |
| battles | imported/events.json `q3772937` | [Q3772937](https://www.wikidata.org/wiki/Q3772937) | Battle of Guinea | pin 748 km from a whole-degree Wikidata point — Battle of Guinea: Wikidata's coordinates are about 748 km out; the pin follows https://en.wikipedia.org/wiki/Elmina. Checked 15 Oct 2026. |
| battles | imported/events.json `q548680` | [Q548680](https://www.wikidata.org/wiki/Q548680) | Second Battle of Champagne | pin 45 km from a whole-degree Wikidata point — Second Battle of Champagne: Wikidata's coordinates are about 45 km out; the pin follows https://en.wikipedia.org/wiki/Second_Battle_of_Champagne. Checked 15 Oct 2026. |
| battles | imported/events.json `q603549` | [Q603549](https://www.wikidata.org/wiki/Q603549) | Battle of Nahāvand | pin 463.6 km from Wikidata P625 — Wikidata's coordinates for the Battle of Nahavand are in southern Iraq; the pin is on Nahavand, Iran (see accuracy-fixes.json). |
| battles | imported/events.json `q717505` | [Q717505](https://www.wikidata.org/wiki/Q717505) | Battle of Xinkou | pin 90 km from a whole-degree Wikidata point — Battle of Xinkou: Wikidata's coordinates are about 90 km out; the pin follows https://www.wikidata.org/wiki/Q109410819. Checked 15 Oct 2026. |
| battles | imported/events.json `q771423` | [Q771423](https://www.wikidata.org/wiki/Q771423) | Battle of Philippopolis | pin 64 km from a whole-degree Wikidata point — Wikidata's point is rounded to (42, 24); the pin is on Plovdiv (see accuracy-fixes.json). |
| battles | imported/events.json `q922200` | [Q922200](https://www.wikidata.org/wiki/Q922200) | Battle of Montiel | pin 104 km from a whole-degree Wikidata point — Wikidata's point for the Battle of Montiel is rounded to (39, -4); the pin is on Montiel (see accuracy-fixes.json). |
| battles | imported/events.json `q985668` | [Q985668](https://www.wikidata.org/wiki/Q985668) | Battle of Tangdao | pin 143 km from a whole-degree Wikidata point — Battle of Tangdao: Wikidata's coordinates are about 143 km out; the pin follows https://shandong-chorography.org/database/b2/section/3/article/100/. Checked 15 Oct 2026. |
| battles | imported/events.json `q989093` | [Q989093](https://www.wikidata.org/wiki/Q989093) | First Battle of Champagne | pin 21 km from a whole-degree Wikidata point — Pin moved 21 km to the sourced location (Captain's pin review, 15 Oct 2026) |
| monuments | imported/events.json `q107370` | [Q107370](https://www.wikidata.org/wiki/Q107370) | Thingvellir National Park | year 1930 vs several Wikidata years 2004, 1928 — Wrong year (2004 is its World Heritage listing): the national park dates from 1930 |
| monuments | imported/events.json `q11812902` | [Q11812902](https://www.wikidata.org/wiki/Q11812902) | Serengeti National Park | year 1951 vs Wikidata 1940 — Wrong year (2020): Serengeti National Park was established in 1951 |
| monuments | imported/events.json `q134140` | [Q134140](https://www.wikidata.org/wiki/Q134140) | Abu Simbel | year -1264 vs Wikidata -1274 — Wrong year (-1274 is the Battle of Kadesh it celebrates): begun c. 1264 BCE |
| monuments | imported/events.json `q15819677` | [Q15819677](https://www.wikidata.org/wiki/Q15819677) | Trinidad and the Valley de los Ingenios | year 1514 vs Wikidata 16 — Wikidata P571 is the year 16 (precision: year) — a century number entered as a year |
| monuments | imported/events.json `q503387` | [Q503387](https://www.wikidata.org/wiki/Q503387) | Rock-hewn Churches of Ivanovo | year 1200 vs Wikidata 13 — Wikidata P571 is the year 13 (precision: year) — a century number entered as a year |
