# People fact-check, batch 14 (Oct 2026): region-centre pins, continued

Carries on from batch 13 (#111), which stopped at Sayyid Muhammad al-Sanusi. Same cause: Wikidata gives only a region, province, county or country as the birthplace, so the pin sits in the middle of that region.

## How the list was made

`node scripts/find-region-birthplaces.mjs` finds **1,193** people. Using the same rules as batches 11 to 13 (leave out everyone in accuracy-fixes.json on main or an open PR, and regions under 2,500 km²), batch 13 ended at al-Sanusi. This batch is the next **70**, from Princess Cecilia of Sweden to K. M. Munshi.

## Totals

- Checked: **70**
- Fixed: **25**. 23 pins moved to the real town, and 2 "Born" lines now name the village (the pin was already by the right town: Bipin Chandra Pal, Yekaterina Budanova).
- Uncertain: **26**. The birthplace is not known, or sources disagree. The panel now says so. Nothing was guessed.
- Already fine: **19**. The "region" is really a parish or town (the Swedish parishes, Strelna, Rianxo, Isla de León, Tianmen, Melitene), or "Ancient Rome" is pinned on Rome itself.
- Left on the list: **68**

**The error rate is high:** about 1 in 3 pins checked (23 of 70) was in the wrong place, and 26 more only have a region. Three had a plainly wrong Wikidata birthplace: Vsevolod Ivanov (a district in Russia, not his village in Kazakhstan), al-Shahrastani (a district in Afghanistan, not his town near Nisa in Turkmenistan) and Princess Wencheng ("Tibet", where she lived, not China, where she was born).

Each person was checked against Wikidata (P19, and P625 of the new place) and at least one other source found by web search.

## Fixes

| Person | Old pin | New pin | Sources |
|---|---|---|---|
| John Ballance | the middle of County Antrim | Ballypitmave, near Glenavy, County Antrim (31 km) | [Q980417](https://www.wikidata.org/wiki/Q980417), [Q1816005](https://www.wikidata.org/wiki/Q1816005), [teara.govt.nz](https://teara.govt.nz/en/biographies/2b5/ballance-john), [en.wikipedia.org](https://en.wikipedia.org/wiki/John_Ballance) |
| Helen Allingham | the middle of Derbyshire | Swadlincote, Derbyshire (45 km) | [Q444581](https://www.wikidata.org/wiki/Q444581), [Q2569065](https://www.wikidata.org/wiki/Q2569065), [app.guildford.gov.uk](https://app.guildford.gov.uk/boroughcollection/artist/15), [en.wikipedia.org](https://en.wikipedia.org/wiki/Helen_Allingham) |
| Nicholas Golitsyn | the middle of Moscow Governorate | Mozhaysk (for Porechye, nearby) (103 km) | [Q766517](https://www.wikidata.org/wiki/Q766517), [Q159139](https://www.wikidata.org/wiki/Q159139), [calend.ru](https://www.calend.ru/persons/40/), [en.wikipedia.org](https://en.wikipedia.org/wiki/Nikolai_Golitsyn) |
| Asaf Jah VI of Hyderabad | the middle of Hyderabad State | Purani Haveli, Hyderabad city (55 km) | [Q681619](https://www.wikidata.org/wiki/Q681619), [Q1361](https://www.wikidata.org/wiki/Q1361), [chowmahalla.in](https://www.chowmahalla.in/?p=443), [en.wikipedia.org](https://en.wikipedia.org/wiki/Mahboob_Ali_Khan) |
| Maria Bochkareva | the middle of Novgorod Governorate | Kirillov (for Nikolskoye, nearby) (377 km) | [Q2635601](https://www.wikidata.org/wiki/Q2635601), [Q153453](https://www.wikidata.org/wiki/Q153453), [encyclopedia.com](https://encyclopedia.com/women/encyclopedias-almanacs-transcripts-and-maps/botchkareva-maria-1889), [en.wikipedia.org](https://en.wikipedia.org/wiki/Maria_Bochkareva) |
| Vsevolod Ivanov | the middle of Lebyazhyevsky District | Akkuly (old Lebyazhye), Pavlodar Region, Kazakhstan (861 km) | [Q435569](https://www.wikidata.org/wiki/Q435569), [Q47961](https://www.wikidata.org/wiki/Q47961), [pavlodarlibrary.kz](https://pavlodarlibrary.kz/en/events/novosti/evening-portrait-for-the-125th-anniversary-of-the-writer-vsevolod-ivanov), [britannica.com](https://www.britannica.com/biography/Vsevolod-Vyacheslavovich-Ivanov), [en.wikipedia.org](https://en.wikipedia.org/wiki/Vsevolod_Ivanov) |
| He Long | the middle of Sangzhi County | Hongjiaguan, Sangzhi County (8 km) | [Q700713](https://www.wikidata.org/wiki/Q700713), [Q11146768](https://www.wikidata.org/wiki/Q11146768), [en.wikipedia.org](https://en.wikipedia.org/wiki/Sangzhi_County), [en.wikipedia.org](https://en.wikipedia.org/wiki/He_Long) |
| Choi Hong-hi | the middle of Myongchon County | Hwadae, North Hamgyong (26 km) | [Q356335](https://www.wikidata.org/wiki/Q356335), [Q706795](https://www.wikidata.org/wiki/Q706795), [itf-tkd.org](https://itf-tkd.org/api/download-document/502451fe-0d72-44e9-b290-90826f107cc5), [en.wikipedia.org](https://en.wikipedia.org/wiki/Choi_Hong-hi) |
| Yegor Ligachev | the middle of Novosibirsk Oblast | Chulym (for Dubinkino, nearby) (98 km) | [Q707005](https://www.wikidata.org/wiki/Q707005), [Q198140](https://www.wikidata.org/wiki/Q198140), [tass.com](https://tass.com/society/1287507), [en.wikipedia.org](https://en.wikipedia.org/wiki/Yegor_Ligachev) |
| Sufi Abu Taleb | the middle of Egypt | Tamiya, Faiyum (336 km) | [Q733919](https://www.wikidata.org/wiki/Q733919), [Q5599915](https://www.wikidata.org/wiki/Q5599915), [nasseryouthmovement.net](https://nasseryouthmovement.net/Dr.-Sufi-Abu-Taleb), [en.wikipedia.org](https://en.wikipedia.org/wiki/Sufi_Abu_Taleb) |
| Cleopa Msuya | the middle of Kilimanjaro Region | Chomvu, Usangi, Mwanga District (56 km) | [Q500345](https://www.wikidata.org/wiki/Q500345), [Q20613978](https://www.wikidata.org/wiki/Q20613978), [thecitizen.co.tz](https://www.thecitizen.co.tz/tanzania/news/national/cleopa-msuya-the-architect-of-tanzania-s-economic-transition-passes-away-5032474), [en.wikipedia.org](https://en.wikipedia.org/wiki/Cleopa_Msuya) |
| Tahar Djaout | the middle of Kabylia | Azeffoun (for Oulkhou, nearby) (61 km) | [Q561721](https://www.wikidata.org/wiki/Q561721), [Q209443](https://www.wikidata.org/wiki/Q209443), [universalis.fr](https://www.universalis.fr/encyclopedie/tahar-djaout/), [zoomalgerie.com](https://zoomalgerie.com/tahar-djaout/), [en.wikipedia.org](https://en.wikipedia.org/wiki/Tahar_Djaout) |
| Ahmad ibn Muhammad al-Tahawi | the middle of Egypt | Taha, Minya, Upper Egypt (213 km) | [Q293771](https://www.wikidata.org/wiki/Q293771), [Q12221613](https://www.wikidata.org/wiki/Q12221613), [en.wikipedia.org](https://en.wikipedia.org/wiki/Al-Tahawi) |
| Al-Shahrastani | the middle of Shahristan District | Nisa, Turkmenistan (for lost Shahristan, nearby) (881 km) | [Q1050887](https://www.wikidata.org/wiki/Q1050887), [Q854672](https://www.wikidata.org/wiki/Q854672), [kureansiklopedi.com](https://kureansiklopedi.com/en/detay/sehristani-2), [encyclopedia.com](https://www.encyclopedia.com/environment/encyclopedias-almanacs-transcripts-and-maps/shahrastani-al), [en.wikipedia.org](https://en.wikipedia.org/wiki/Al-Shahrastani) |
| Lalleshwari | the middle of Kashmir | Pandrethan, near Srinagar (116 km) | [Q2667861](https://www.wikidata.org/wiki/Q2667861), [Q59657930](https://www.wikidata.org/wiki/Q59657930), [rd.springer.com](https://rd.springer.com/referenceworkentry/10.1007%2F978-94-024-1036-5_329-1), [en.wikipedia.org](https://en.wikipedia.org/wiki/Lalleshwari) |
| Jean de Dunois | the middle of Kingdom of France | Paris (208 km) | [Q503809](https://www.wikidata.org/wiki/Q503809), [Q90](https://www.wikidata.org/wiki/Q90), [britannica.com](https://www.britannica.com/biography/Jean-dOrleans), [en.wikipedia.org](https://en.wikipedia.org/wiki/Jean_de_Dunois) |
| Francesco Laurana | the middle of Dalmatia | Vrana, near Zadar (55 km) | [Q381224](https://www.wikidata.org/wiki/Q381224), [Q223601](https://www.wikidata.org/wiki/Q223601), [britannica.com](https://www.britannica.com/biography/Francesco-Laurana), [en.wikipedia.org](https://en.wikipedia.org/wiki/Francesco_Laurana) |
| Thomas Wright | the middle of County Durham | Byers Green, County Durham (12 km) | [Q460791](https://www.wikidata.org/wiki/Q460791), [Q5004070](https://www.wikidata.org/wiki/Q5004070), [dur.ac.uk](https://dur.ac.uk/things-to-do/venues/historic-libraries-at-palace-green/whats-on/past-exhibitions/thomas-wright-of-durham/), [en.wikipedia.org](https://en.wikipedia.org/wiki/Thomas_Wright_(astronomer)) |
| Bhimsen Thapa | the middle of Gorkha District | Bhimsen Thapa Rural Municipality (for Pipal Thok), Gorkha (28 km) | [Q4206839](https://www.wikidata.org/wiki/Q4206839), [Q30317302](https://www.wikidata.org/wiki/Q30317302), [en.wikipedia.org](https://en.wikipedia.org/wiki/Bhimsen_Thapa) |
| Gulab Singh | the middle of Jammu division | Jammu city (169 km) | [Q12446041](https://www.wikidata.org/wiki/Q12446041), [Q255455](https://www.wikidata.org/wiki/Q255455), [dailyexcelsior.com](https://www.dailyexcelsior.com/?p=805535), [newworldencyclopedia.org](https://www.newworldencyclopedia.org/entry/Gulab_Singh), [en.wikipedia.org](https://en.wikipedia.org/wiki/Gulab_Singh) |
| Vladimir Gilyarovsky | the middle of Vologda Governorate | Syama (forest farm nearby) (56 km) | [Q521170](https://www.wikidata.org/wiki/Q521170), [Q4448621](https://www.wikidata.org/wiki/Q4448621), [booksite.ru](https://www.booksite.ru/guilyai/vologda/1.htm), [en.wikipedia.org](https://en.wikipedia.org/wiki/Vladimir_Gilyarovsky) |
| Huang Xing | the middle of Shanhua County | Huangxing town, Changsha County (12 km) | [Q706842](https://www.wikidata.org/wiki/Q706842), [Q5926062](https://www.wikidata.org/wiki/Q5926062), [en.wikipedia.org](https://en.wikipedia.org/wiki/Former_Residence_of_Huang_Xing), [enghunan.gov.cn](https://enghunan.gov.cn/hneng/AboutHunan/HistoryCulture/Celebrities/201508/t20150807_1816288.html), [en.wikipedia.org](https://en.wikipedia.org/wiki/Huang_Xing) |
| Kanaiyalal Maneklal Munshi | the middle of Bharuch district | Bharuch town (6 km) | [Q2721812](https://www.wikidata.org/wiki/Q2721812), [Q760153](https://www.wikidata.org/wiki/Q760153), [constitutionofindia.net](https://www.constitutionofindia.net/members/k-m-munshi/), [en.wikipedia.org](https://en.wikipedia.org/wiki/Kanaiyalal_Maneklal_Munshi) |
| Bipin Chandra Pal | the middle of Habiganj District | pin stays; Born line now says Poil | [Q684198](https://www.wikidata.org/wiki/Q684198), [byjus.com](https://byjus.com/free-ias-prep/this-day-in-history-nov7), [en.wikipedia.org](https://en.wikipedia.org/wiki/Bipin_Chandra_Pal) |
| Yekaterina Budanova | the middle of Vyazemsky District | pin stays; Born line now says Konoplyanka | [Q2272741](https://www.wikidata.org/wiki/Q2272741), [migflug.com](https://migflug.com/jetflights/yekaterina-budanova-the-forgotten-soviet-fighter-ace-who-flew-alongside-a-legend/), [en.wikipedia.org](https://en.wikipedia.org/wiki/Yekaterina_Budanova) |

Some places have no point in Wikidata, so the pin is the nearest town and the panel says so: Golitsyn (Porechye → Mozhaysk), Bochkareva (Nikolskoye → Kirillov), Ligachev (Dubinkino → Chulym), Djaout (Oulkhou → Azeffoun), al-Shahrastani (Shahristan → Nisa), Bhimsen Thapa (Pipal Thok → Bhimsen Thapa Rural Municipality), Gilyarovsky (forest farm → Syama).

Sources differ, and the panel says so: Lalleshwari (Pandrethan, or Sempore), Gulab Singh (Jammu, or Smailpur / Anderwah near Samba; day 17, 18 or 21 October), Dunois (1403 in Britannica, 23 November 1402 elsewhere), He Long ("by the usual account").

## Uncertain (the panel now says so)

Kurmangazy Sagyrbaev, Bintanath, Zengzi, Pausanias of Orestis, Ariarathes V, Emperor Houshao of Han, Ruzi Ying, Macrianus Minor, Priscillian, Princess Wencheng, Vergilius of Salzburg, Theodulf of Orléans, Walafrid Strabo, Abu Sahl al-Quhi, Adalbert of Hamburg, Huang Tingjian, George II of Georgia, Minhaj-i-Siraj, Qin Jiushao, Qansuh al-Ghuri, Guaman Poma, Ernst von Mansfeld, Fasiladas, Henry Clinton, Dingane, Charles Sturt.

Sources differ: Kurmangazy (Zhideli named by some; born 1818 or 1823), Zengzi (Pingyi or Jiaxiang), Henry Clinton (Newfoundland is disputed), Ernst von Mansfeld (Luxembourg, probably the city). Huang Tingjian and Qin Jiushao: the county is known, but not the village.

## How

- 51 new entries in the middle of `scripts/data/accuracy-fixes.json` (before `q236017`), away from the parts that other open PRs change. Then `node scripts/dedupe-places.mjs && npm run build:core`.
- Test: `src/lib/peopleFactcheckBatch14.test.ts`.
