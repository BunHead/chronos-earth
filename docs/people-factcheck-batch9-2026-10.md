# People fact-check, batch 9 (Oct 2026): region-centre pins, continued

Carries on from batch 8 (#89). Same cause: Wikidata gives only a region, province, county or country as the birthplace, so the pin sits in the middle of that region.

## How the list was made

`node scripts/find-region-birthplaces.mjs` (copied unchanged from #89) found the same **1,214** people. Leaving out everyone already in accuracy-fixes.json on main or on an open PR (#50 and batches 2-8), regions under 2,500 km², and everyone at or above batch 8's last checked person leaves **639**. This count is higher than #89's 560 because it keeps small places such as parishes and villages; those are usually fine and are checked quickly.

## Totals

- Checked: **110** (the most notable 110 of the 639)
- Fixed: **20** wrong pins
- Uncertain: **50**. The birthplace is not known; the panel now says so. Nothing was guessed.
- Already fine: **40** (the "region" is really a small place, such as a parish, village, deme or district, or its point is the real town, such as Rome, Constantinople, Kabul or Hong Kong)
- Left on the list: **529**

The error rate is high: 1 in 5 pins checked was in the wrong place, and almost half more only have a region.

Each was checked against Wikidata (P19, and P625 of the new place) and one other source found by web search (Wikipedia cannot be opened from the work container).

## Fixes

| Person | Old pin | New pin | Source |
|---|---|---|---|
| Mungo Park | the middle of Scotland | Foulshiels, near Selkirk, Scotland (206 km) | [Q219086](https://www.wikidata.org/wiki/Q219086), [britannica.com](https://www.britannica.com/biography/Mungo-Park) |
| Victoria Woodhull | the middle of Ohio | Homer, Licking County, Ohio (28 km) | [Q260378](https://www.wikidata.org/wiki/Q260378), [home.nps.gov](https://home.nps.gov/people/victoria-woodhull.htm) |
| Maria Edgeworth | Oxford, the point for Oxfordshire | Black Bourton, Oxfordshire (21 km) | [Q237575](https://www.wikidata.org/wiki/Q237575), [orlando.cambridge.org](https://orlando.cambridge.org/index.php/profiles/edgema) |
| Gladwyn Jebb | York, the point for Yorkshire | Firbeck Hall, Firbeck, Yorkshire (63 km) | [Q1275](https://www.wikidata.org/wiki/Q1275), [archivesearch.lib.cam.ac.uk](https://archivesearch.lib.cam.ac.uk/repositories/9/resources/1584) |
| Alan Watts | the middle of Kent | Chislehurst, Kent (52 km) | [Q354867](https://www.wikidata.org/wiki/Q354867), [britannica.com](https://www.britannica.com/biography/Alan-Watts) |
| Luísa Diogo | the middle of Tete Province | Magoé District, Tete Province (87 km) | [Q236020](https://www.wikidata.org/wiki/Q236020), [aimnews.org](https://aimnews.org/2026/01/19/mozambiques-former-prime-minister-dies/) |
| Ziaur Rahman | Bogra town, the point for the district | Bagbari, Gabtali, Bogra District (15 km) | [Q198313](https://www.wikidata.org/wiki/Q198313), [en.banglapedia.org](https://en.banglapedia.org/index.php/Rahman,_Shahid_Ziaur) |
| 1st Dalai Lama | the middle of Ü-Tsang | Gyurmey Rupa, near Sakya, Tsang (460 km) | [Q25260](https://www.wikidata.org/wiki/Q25260), [dalailama.com](https://www.dalailama.com/the-dalai-lama/previous-dalai-lamas/previous-dalai-lama) |
| Charles Kingsley | the middle of Devon | Holne Vicarage, Holne, Devon (21 km) | [Q353238](https://www.wikidata.org/wiki/Q353238), [devonheritage.org](https://www.devonheritage.org/Places/Holne/CharlesKingsleyandHolne.htm) |
| Hu Yaobang | the middle of Liuyang | Cangfang village, Zhonghe, Liuyang, Hunan (26 km) | [Q99850](https://www.wikidata.org/wiki/Q99850), [enghunan.gov.cn](https://www.enghunan.gov.cn/hneng/Services/Live/Community/LMEH/202410/t20241023_33483506.html) |
| Manuel Roxas | the middle of Capiz province | Capiz town (now Roxas City), Capiz (26 km) | [Q223419](https://www.wikidata.org/wiki/Q223419), [legacy.senate.gov.ph](https://legacy.senate.gov.ph/senators/senpres/roxas.asp) |
| Sun Myung Moon | the middle of North Pyongan Province | Sangsa-ri, Jeongju, North Pyongan (83 km) | [Q296734](https://www.wikidata.org/wiki/Q296734), [newworldencyclopedia.org](https://www.newworldencyclopedia.org/entry/Sun_Myung_Moon) |
| Trần Đức Lương | the middle of Quảng Ngãi province | Phổ Khánh commune, Đức Phổ, Quảng Ngãi (50 km) | [Q139324](https://www.wikidata.org/wiki/Q139324), [sggp.org.vn](https://www.sggp.org.vn/thong-cao-dac-biet-ve-le-tang-nguyen-chu-tich-nuoc-tran-duc-luong-post796425.html) |
| Ngawang Lobzang Gyatso | Lhasa, the point for Tibet | Taktsé Castle, Chingwar, Chonggyä (Qonggyai) (89 km) | [Q25252](https://www.wikidata.org/wiki/Q25252), [dalailama.com](https://www.dalailama.com/the-dalai-lama/previous-dalai-lamas/previous-dalai-lama) |
| Ban Zhao | Luoyang, the point for Eastern Han | Anling, Fufeng (near modern Xianyang) (340 km) | [Q177081](https://www.wikidata.org/wiki/Q177081), [britannica.com](https://www.britannica.com/biography/Ban-Zhao) |
| Sister Nivedita | the middle of County Tyrone | Dungannon, County Tyrone (28 km) | [Q2353846](https://www.wikidata.org/wiki/Q2353846), [britannica.com](https://www.britannica.com/biography/Nivedita) |
| Rokeya Sakhawat Hossain | Rangpur town, the point for the district | Pairaband, Mithapukur, Rangpur (22 km) | [Q467083](https://www.wikidata.org/wiki/Q467083), [thedailystar.net](https://www.thedailystar.net/node/7079) |
| Vinoba Bhave | the point for Raigad district, on the coast | Gagode, near Pen, Kolaba (now Raigad) (24 km) | [Q13021](https://www.wikidata.org/wiki/Q13021), [gktoday.in](https://www.gktoday.in/vinoba-bhave-and-bhoodan-movement/) |
| Haing S. Ngor | Hanoi, the point for French Indochina | Samrong Yong, Bati District, Takéo, Cambodia (1092 km) | [Q312364](https://www.wikidata.org/wiki/Q312364), [britannica.com](https://www.britannica.com/biography/Haing-S-Ngor) |
| Sakamoto Ryōma | the point for Tosa Province | Kamimachi, Kōchi castle town, Tosa Province (13 km) | [Q378450](https://www.wikidata.org/wiki/Q378450), [visitkochijapan.com](https://visitkochijapan.com/en/see-and-do/10013) |

The "Born" line now names the town too. Where only a village is known and it has no point in Wikidata, the pin is the district or nearest town and the panel says so.

## Uncertain (the panel now says so)

Darius II, Tiberius II Constantine, Ecgberht, Harthacanute, Anacharsis, Glycerius, Nikephoros II Phokas, Romanos IV Diogenes, Antigonus I Monophthalmus, Libius Severus, Phoolan Devi, Herennius Etruscus, Aurelius Victor, Béla IV of Hungary, Magnus Maximus, Malcolm III of Scotland, Władysław I the Elbow-high, Krum, Pelagius, Olaf II of Norway, Michael V Kalaphates, Alexander V, Megasthenes, Duncan I of Scotland, Toghon Temür, Amon, Sun Quan, Novatian, Thomas Tallis, John Climacus, Abu Dawud al-Sijistani, Olaf I of Norway, Ferdinand I of León and Castile, Magnus the Good, Canute IV of Denmark, Béla II of Hungary, Malcolm IV of Scotland, Béla III of Hungary, Evaristo Carvalho, Perdiccas, Gaius Julius Hyginus, Frontinus, Gaius Valerius Flaccus, John Cassian, Columbanus, Theophylact Simocatta, Eric IX of Sweden, Herodian, Clement of Ohrid, Jehu.

Sources differ: Sun Quan (Xiapi, or by the Fuchun river near Hangzhou). Phoolan Devi's village (Gorha Ka Purwa) is named, but no point was found, so she stays at the middle of Jalaun district. Béla IV: only family-tree sites say Esztergom, so it was not used.

## How

- 70 new entries in the middle of `scripts/data/accuracy-fixes.json` (before `q192925`), away from the spots the open PRs change. Then `node scripts/dedupe-places.mjs && npm run build:core`.
- Test: `src/lib/peopleFactcheckBatch9.test.ts`.
