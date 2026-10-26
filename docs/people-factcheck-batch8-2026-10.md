# People fact-check, batch 8 (October 2026): region-centre pins

Batch 7 (PR #87) found that most wrong pins come from one cause: Wikidata gives only a region, province, county or country as the birthplace, so the pin sits in the middle of that region. This batch goes after that cause directly.

## How the list was made

`node scripts/find-region-birthplaces.mjs` asks Wikidata, for every person, whether the birthplace (P19) is an instance of country, sovereign state, historical country, state, province, first- or second-level division, county, region or historical region (P31/P279*). A birthplace that is also a town, municipality or building is left out. Only people whose pin is still within 5 km of that region's own point are listed. It writes `scripts/.cache/region-birthplaces.json`, most notable first, with each region's area.

- The query found **1,214** people.
- 82 were already in accuracy-fixes.json, and the open batches 6 and 7 (#85, #87) cover more.
- Leaving out small places (parishes, demes, districts, regions under 2,500 km²) leaves **650** to check.

## Totals

- Checked: **90** (the most notable 90 of the 650)
- Fixed: **10** wrong pins
- Uncertain: **49**. The birthplace is not known; the panel now says so. Nothing was guessed.
- Already fine: **31** (the "region" is really a small place, such as an Athenian deme, a parish or a commune, or its point is the real town, such as Rome or Nuremberg)
- Left on the list: **560**

Each was checked against Wikidata (P19 and its P625) and one other source found by web search (Wikipedia cannot be opened from the work container).

## Fixes

| Person | Old pin | New pin | Source |
|---|---|---|---|
| John Dalton | middle of Cumberland | Eaglesfield, near Cockermouth (29 km) | [Q41284](https://www.wikidata.org/wiki/Q41284), [Co-Curate](https://co-curate.ncl.ac.uk/eaglesfield-cumbria) |
| William Pitt the Younger | middle of Kent | Hayes Place, Hayes (now Bromley) (54 km) | [Q128902](https://www.wikidata.org/wiki/Q128902), [Hayes history](https://hayeskenthistory.org.uk/pitt-william-the-younger/) |
| Lucy Maud Montgomery | middle of Prince Edward Island | Clifton, now New London (25 km) | [Q273034](https://www.wikidata.org/wiki/Q273034), [Tourism PEI](https://www.tourismpei.com/what-to-do/anne-of-green-gables/lucy-maud-montgomery) |
| Samora Machel | middle of Gaza Province | Chókwè district, where Chilembene is (90 km) | [Q219918](https://www.wikidata.org/wiki/Q219918), [Britannica](https://www.britannica.com/biography/Samora-Machel) |
| Abdrabbuh Mansour Hadi | a point for Abyan Governorate | Al Wade'a District, where Thukain is (81 km) | [Q57480](https://www.wikidata.org/wiki/Q57480), [AP via WTOP](https://wtop.com/world/2026/05/former-yemen-president-abdrabbuh-mansour-hadi-dies-at-80/) |
| Galerius | Roman Dacia, in Romania (wrong province) | Romuliana, Gamzigrad, Serbia; probably, panel says so (395 km) | [Q172168](https://www.wikidata.org/wiki/Q172168), [Wikipedia](https://en.wikipedia.org/wiki/Galerius) |
| Nguyễn Phú Trọng | wrong Wikidata point, in Thanh Hóa | Đông Hội commune, Đông Anh, Hanoi (142 km) | [Q318458](https://www.wikidata.org/wiki/Q318458), [SGGP](https://www.sggp.org.vn/tom-tat-tieu-su-tong-bi-thu-nguyen-phu-trong-post750269.html) |
| Stamford Raffles | middle of Jamaica | Port Morant (born on a ship just off it) (119 km) | [Q130327](https://www.wikidata.org/wiki/Q130327), [Wikipedia](https://en.wikipedia.org/wiki/Stamford_Raffles) |
| Jagadish Chandra Bose | Bikrampur (his family's home area) | Mymensingh (134 km) | [Q314267](https://www.wikidata.org/wiki/Q314267), [Banglapedia](https://en.banglapedia.org/index.php/Bose,_Sir_Jagadish_Chandra) |
| Liu Shaoqi | middle of Ningxiang | Tanzichong, Huaminglou (31 km) | [Q16988](https://www.wikidata.org/wiki/Q16988), [Britannica](https://www.britannica.com/biography/Liu-Shaoqi) |

The "Born" line now names the town too.

## Uncertain (the panel now says so)

Mostly ancient and early medieval people, where only the region is known: Jerome (Stridon, site lost), Pontius Pilate, Vitruvius, Heraclius, Gelasius I, Honorius I, Isaiah, Ptolemy I, Arius, Herod the Great, Cnut, Darius III, Ignatius of Antioch, Saint Patrick, Arcadius, Æthelstan, Edmund I, Eadred, Eadwig, Maximinus Thrax, Pope Conon, Pope Hilarius, Pope Constantine, Julius Nepos, Enheduanna, Gordian I, Agrippa, Jordanes, Amenhotep III, Phaedrus, Zeami, Marcian, Phocas, Leo I, Hippolytus, Eriugena, Walther von der Vogelweide, Yunus Emre, Crazy Horse, Severus II, Ulfilas, Maximus the Confessor, Henry III (emperor), Nagarjuna, Andrei Rublev, Pope John IV, Constantius Chlorus.

Sources differ (kept on the region, with a note): Bellingshausen (two manors on Saaremaa) and Juvénal Habyarimana (Gasiza or Rambura; no reliable point found).

## How

- 59 new entries in the middle of `scripts/data/accuracy-fixes.json` (before `q358479`), away from the spots the open PRs change. Then `node scripts/dedupe-places.mjs && npm run build:core`.
- Test: `src/lib/peopleFactcheckBatch8.test.ts`.
