# People fact-check, batch 13 (Oct 2026): region-centre pins, continued

Carries on from batch 12 (#105). Same cause: Wikidata gives only a region, province, county or country as the birthplace, so the pin sits in the middle of that region.

## How the list was made

`node scripts/find-region-birthplaces.mjs` now finds **1,193** people. Using the same rules as batches 11 and 12 (leave out everyone in accuracy-fixes.json on main or an open PR, and regions under 2,500 km²), batch 12 ended at Gundobad. This batch is the next **70**, from Georgius Pisida to Sayyid Muhammad al-Sanusi.

## Totals

- Checked: **70**
- Fixed: **11** wrong pins, plus 1 misspelt name ("Eliyahu M. Goldrattmmnj" is now Eliyahu M. Goldratt).
- Uncertain: **43**. The birthplace is not known, or sources disagree. The panel now says so. Nothing was guessed.
- Already fine: **16**. The point is the real town (London, Strelna, Kleve, In Buri), or the "region" is really a small parish or village (the Swedish and Danish parishes, Cernache do Bonjardim, Great Wenham).
- Left on the list: **138**

**The error rate is high:** about 1 in 6 pins checked (11 of 70) was in the wrong place, and 43 more only have a region.

Each person was checked against Wikidata (P19, and P625 of the new place) and at least one other source found by web search.

## Fixes

| Person | Old pin | New pin | Sources |
|---|---|---|---|
| Qi Jiguang | the middle of Shandong | Luqiao, Jining, Shandong (202 km) | [Q439768](https://www.wikidata.org/wiki/Q439768), [Q11173096](https://www.wikidata.org/wiki/Q11173096), [chiculture.org.hk](https://chiculture.org.hk/en/china-five-thousand-years/3369), [en.wikipedia.org](https://en.wikipedia.org/wiki/Qi_Jiguang) |
| Humphrey Gilbert | the middle of Devon | Greenway, on the River Dart, Devon (38 km) | [Q447200](https://www.wikidata.org/wiki/Q447200), [Q1544827](https://www.wikidata.org/wiki/Q1544827), [biographi.ca](https://www.biographi.ca/en/bio/gilbert_humphrey_1E.html), [nps.gov](https://www.nps.gov/fora/forteachers/sir-humphrey-gilbert.htm) |
| Thomas Hughes | the middle of Oxfordshire | Uffington, Berkshire (now Oxfordshire) (25 km) | [Q332580](https://www.wikidata.org/wiki/Q332580), [Q4027058](https://www.wikidata.org/wiki/Q4027058), [britannica.com](https://www.britannica.com/biography/Thomas-Hughes), [uffingtonmuseum.co.uk](https://www.uffingtonmuseum.co.uk/thomas-hughes.html) |
| Cipriano Castro | the middle of Táchira | Capacho, Táchira (26 km) | [Q469575](https://www.wikidata.org/wiki/Q469575), [Q2937166](https://www.wikidata.org/wiki/Q2937166), [britannica.com](https://www.britannica.com/print/article/98819), [en.wikipedia.org](https://en.wikipedia.org/wiki/Cipriano_Castro) |
| Sebastian Shaw | the middle of Norfolk | Holt, Norfolk (27 km) | [Q532184](https://www.wikidata.org/wiki/Q532184), [Q691558](https://www.wikidata.org/wiki/Q691558), [family-tree.cobboldfht.com](https://family-tree.cobboldfht.com/people/view/11210), [en.wikipedia.org](https://en.wikipedia.org/wiki/Sebastian_Shaw_(actor)) |
| Yasushi Inoue | the middle of Hokkaidō | Asahikawa, Hokkaido (49 km) | [Q712734](https://www.wikidata.org/wiki/Q712734), [Q200740](https://www.wikidata.org/wiki/Q200740), [universalis.fr](https://www.universalis.fr/encyclopedie/yasushi-inoue/), [en.wikipedia.org](https://en.wikipedia.org/wiki/Yasushi_Inoue) |
| Yakov Pavlov | the middle of Valdaysky District | Krestovaya, Valdaysky District, Novgorod (14 km) | [Q1637167](https://www.wikidata.org/wiki/Q1637167), [Q29404513](https://www.wikidata.org/wiki/Q29404513), [warriors-hall-of-fame.blogspot.com](https://warriors-hall-of-fame.blogspot.com/2011/05/yakov-pavlov-1917-1981-defender-of.html), [en.wikipedia.org](https://en.wikipedia.org/wiki/Yakov_Pavlov) |
| Minamoto no Yoshinaka | the middle of Musashi Province | Ōkura, Musashi (now Ranzan, Saitama) (29 km) | [Q1139202](https://www.wikidata.org/wiki/Q1139202), [Q1358642](https://www.wikidata.org/wiki/Q1358642), [japanese-wiki-corpus.github.io](https://japanese-wiki-corpus.github.io/person/MINAMOTO%20no%20Yoshinaka.html), [jcastle.com](https://www.jcastle.com/view/Ohkura_Yakata) |
| Robert Filmer | the middle of Kent | East Sutton, Kent (8 km) | [Q707787](https://www.wikidata.org/wiki/Q707787), [Q930290](https://www.wikidata.org/wiki/Q930290), [britannica.com](https://www.britannica.com/biography/Robert-Filmer), [kentarchaeology.org.uk](https://www.kentarchaeology.org.uk/journal/91/sir-robert-filmer-east-sutton) |
| Árni Magnússon | the middle of Dalasýsla | Kvennabrekka, Dalasýsla (19 km) | [Q252301](https://www.wikidata.org/wiki/Q252301), [Q1020276](https://www.wikidata.org/wiki/Q1020276), [britannica.com](https://www.britannica.com/biography/Arni-Magnusson), [en.wikipedia.org](https://en.wikipedia.org/wiki/%C3%81rni_Magn%C3%BAsson) |
| Sayyid Muhammad bin ʿAli al-Sanusi | Algiers, the point for the Regency of Algiers | al-Wasita, near Mostaganem (282 km) | [Q192246](https://www.wikidata.org/wiki/Q192246), [Q849524](https://www.wikidata.org/wiki/Q849524), [britannica.com](https://www.britannica.com/biography/al-Sanusi), [en.wikipedia.org](https://en.wikipedia.org/wiki/Muhammad_ibn_Ali_al-Sanusi) |

Some places have no point in Wikidata, so the pin is the nearest town and the panel says so: Árni Magnússon (Kvennabrekka, pin Búðardalur) and al-Sanusi (al-Wasita, pin Mostaganem).

Sources differ, and the panel says so: Qi Jiguang (Luqiao by most accounts; some say Penglai) and Yoshinaka ("by the usual account", Ōkura in Ranzan).

## Uncertain (the panel now says so)

Georgius Pisida, Cynewulf of Wessex, Cynewulf (poet), Al-Khazini, Margaret I of Flanders, Marguerite Porete, Juan del Encina, Antoine Gombaud, Adil Shah, James Ferguson, Periklis Pierrakos-Mavromichalis, Liu Bocheng, Godfrey Binaisa, Apolo Nsibambi, Eliyahu M. Goldratt, Matthew Festing, Bu Bing, Neferure, Isetnofret, Sun Bin, Bocchus I, Aulus Gabinius, Lucius Domitius Ahenobarbus, Quadratus of Athens, Methodius of Olympus, Domitius Alexander, Avianus, Abe no Nakamaro, Benedict of Aniane, Nominoe, Abū Kāmil, Oldřich of Bohemia, Rodulfus Glaber, Stenkil, Roger Borsa, Johannes de Sacrobosco, Piers Gaveston, Jayaatu Khan, Hayam Wuruk, Vuk Branković, Heinrich Isaac, Sahib I Giray, Petter Dass.

Sources differ: Juan del Encina (Encina de San Silvestre, Salamanca or Fermoselle), Godfrey Binaisa (Kampala or Mityana), Matthew Festing (Tarset or Bellingham), Sacrobosco (three different "Holywoods"), Petter Dass (Nord-Herøy, Dønna or Tjøtta). Liu Bocheng: Kai County is known, but not the village.

## How

- 54 new entries in the middle of `scripts/data/accuracy-fixes.json` (before `q856223`), away from the parts that other open PRs change. Then `node scripts/dedupe-places.mjs && npm run build:core`.
- Test: `src/lib/peopleFactcheckBatch13.test.ts`.
