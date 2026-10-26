# People fact-check, batch 11 (Oct 2026): region-centre pins, continued

Carries on from batch 10 (#95). Same cause: Wikidata gives only a region, province, county or country as the birthplace, so the pin sits in the middle of that region.

## How the list was made

`node scripts/find-region-birthplaces.mjs` (already on main) finds **1,195** people, the same as batch 10. Leaving out everyone already in accuracy-fixes.json on main or on an open PR (#92, #93, #95, #98), regions under 2,500 km², and everyone at or above batch 10's last checked person (Steven Runciman) leaves **409**, the same number #95 ended on.

## Totals

- Checked: **100** (the most notable 100 of the 409)
- Fixed: **19** wrong pins, plus **1** missing death line (Martin I of Sicily died 25 July 1409 at Cagliari)
- Uncertain: **47**. The birthplace is not known, or sources disagree; the panel now says so. Nothing was guessed.
- Already fine: **33** (the point is the real town, such as Rome, Tak, Matanzas or Haicheng, or the "region" is really a small parish or village, such as the Swedish parishes)
- Left on the list: **309**

The error rate is high: about 1 in 5 pins checked (19 of 100) was in the wrong place, and almost half more only have a region.

Each was checked against Wikidata (P19, and P625 of the new place) and one other source found by web search.

## Fixes

| Person | Old pin | New pin | Sources |
|---|---|---|---|
| Walter Sisulu | the middle of the Transkei | Qutubeni, Engcobo (Ngcobo), Transkei (120 km) | [Q440490](https://www.wikidata.org/wiki/Q440490), [Q10610936](https://www.wikidata.org/wiki/Q10610936), [sahistory.org.za](https://sahistory.org.za/people/walter-ulyate-sisulu) |
| Roderick Murchison, 1st Baronet | the middle of Ross and Cromarty | Tarradale House, Muir of Ord, Ross-shire (38 km) | [Q361900](https://www.wikidata.org/wiki/Q361900), [Q56668530](https://www.wikidata.org/wiki/Q56668530), [undiscoveredscotland.co.uk](https://undiscoveredscotland.co.uk/usbiography/m/roderickmurchison.html), [her.highland.gov.uk](https://her.highland.gov.uk/Monument/MHG7564) |
| Chittaranjan Das | the middle of Bikrampur (now in Bangladesh) | Calcutta (now Kolkata) (248 km) | [Q560182](https://www.wikidata.org/wiki/Q560182), [Q1348](https://www.wikidata.org/wiki/Q1348), [britannica.com](https://www.britannica.com/EBchecked/topic/152020), [en.banglapedia.org](https://en.banglapedia.org/index.php/Das,_Chitta_Ranjan) |
| Clark Ashton Smith | Long Valley in Lassen County (the wrong Long Valley) | Long Valley, Placer County, California (154 km) | [Q555298](https://www.wikidata.org/wiki/Q555298), [Q758542](https://www.wikidata.org/wiki/Q758542), [en.wikipedia.org](https://en.wikipedia.org/wiki/Clark_Ashton_Smith), [baen.com](https://www.baen.com/Chapters/9781597803601/9781597803601___3.htm) |
| Marcos Pérez Jiménez | the middle of Táchira | Michelena, Táchira (22 km) | [Q459118](https://www.wikidata.org/wiki/Q459118), [Q3134431](https://www.wikidata.org/wiki/Q3134431), [britannica.com](https://www.britannica.com/print/article/451448), [buscabiografias.com](https://www.buscabiografias.com/biografia/verDetalle/10499/Marcos%20Perez%20Jimenez) |
| Albert Zafy | the middle of Antsiranana Province | Betsiaka, near Ambilobe (56 km) | [Q559672](https://www.wikidata.org/wiki/Q559672), [Q750960](https://www.wikidata.org/wiki/Q750960), [lexpress.mg](https://www.lexpress.mg/2024/10/ambilobe-une-stele-la-memoire-du.html), [globalsecurity.org](https://www.globalsecurity.org/military/world/africa/ma-pres-zafy.htm) |
| Mahmud Hotaki | Mashhad, Iran (the point for Khorasan Province) | Kandahar (767 km) | [Q31494](https://www.wikidata.org/wiki/Q31494), [Q45604](https://www.wikidata.org/wiki/Q45604), [en.wikipedia.org](https://en.wikipedia.org/wiki/Mahmud_Hotak), [royalark.net](https://royalark.net/Persia/ghilzai.htm) |
| Maximiliano Hernández Martínez | the middle of El Salvador | San Matías, La Libertad (54 km) | [Q319419](https://www.wikidata.org/wiki/Q319419), [Q3947669](https://www.wikidata.org/wiki/Q3947669), [ecured.cu](https://www.ecured.cu/Maximiliano_Hern%C3%A1ndez_Mart%C3%ADnez), [elsalvador.com](https://www.elsalvador.com/?p=998959) |
| Russell Means | the middle of the Pine Ridge Reservation | Porcupine, Pine Ridge Indian Reservation (23 km) | [Q319799](https://www.wikidata.org/wiki/Q319799), [Q1787175](https://www.wikidata.org/wiki/Q1787175), [britannica.com](https://www.britannica.com/print/article/1895016), [en.wikipedia.org](https://en.wikipedia.org/wiki/Russell_Means) |
| Punsalmaagiin Ochirbat | the middle of Zavkhan Province | Tüdevtei, Zavkhan (112 km) | [Q887753](https://www.wikidata.org/wiki/Q887753), [Q3402401](https://www.wikidata.org/wiki/Q3402401), [mongolia.gogo.mn](https://mongolia.gogo.mn/r/nqkk3), [en.wikipedia.org](https://en.wikipedia.org/wiki/Punsalmaagiin_Ochirbat) |
| Huiyuan | Taiyuan, the point for Shanxi | Yanmen, Shanxi (137 km) | [Q1194206](https://www.wikidata.org/wiki/Q1194206), [Q1157514](https://www.wikidata.org/wiki/Q1157514), [britannica.com](https://www.britannica.com/biography/Hui-yuan), [encyclopediaofbuddhism.org](https://www.encyclopediaofbuddhism.org/wiki/Lushan_Huiyuan) |
| William Murdoch | Ayr, the point for Ayrshire | Bello Mill, Lugar, near Old Cumnock, Ayrshire (25 km) | [Q451444](https://www.wikidata.org/wiki/Q451444), [Q6699724](https://www.wikidata.org/wiki/Q6699724), [en.wikisource.org](https://en.wikisource.org/wiki/Dictionary_of_National_Biography,_1885-1900/Murdock,_William), [gracesguide.co.uk](https://www.gracesguide.co.uk/William_Murdoch) |
| M. N. Roy | Kolkata, the point for 24 Parganas | Arbelia, 24 Parganas (42 km) | [Q313313](https://www.wikidata.org/wiki/Q313313), [Q60615480](https://www.wikidata.org/wiki/Q60615480), [en.banglapedia.org](https://en.banglapedia.org/index.php/Roy,_Manabendra_Nath), [iep.utm.edu](https://iep.utm.edu/roy_mn/) |
| Leiji Matsumoto | Kyoto | Kurume, Fukuoka (518 km) | [Q431443](https://www.wikidata.org/wiki/Q431443), [Q320934](https://www.wikidata.org/wiki/Q320934), [tokyoweekender.com](https://www.tokyoweekender.com/?p=284269), [deadline.com](https://deadline.com/2023/02/leiji-matsumoto-dead-japanese-manga-artist-daft-punk-collaborator-was-85-1235265604) |
| Ambrose Mandvulo Dlamini | the middle of the Manzini Region | Mbekelweni, Manzini Region (29 km) | [Q57973856](https://www.wikidata.org/wiki/Q57973856), [Q495730](https://www.wikidata.org/wiki/Q495730), [en.wikipedia.org](https://en.wikipedia.org/wiki/Ambrose_Mandvulo_Dlamini), [news24.com](https://www.news24.com/citypress/news/mtn-ceo-appointed-swazi-prime-minister-20181027) |
| Gaius Cornelius Gallus | Rome, the point for the Roman Empire | Forum Julii (Fréjus), Gaul (501 km) | [Q8825](https://www.wikidata.org/wiki/Q8825), [Q215155](https://www.wikidata.org/wiki/Q215155), [britannica.com](https://www.britannica.com/print/article/224569), [en.wikipedia.org](https://en.wikipedia.org/wiki/Cornelius_Gallus) |
| Owen Tudor | the middle of Wales | Penmynydd, Anglesey (107 km) | [Q361128](https://www.wikidata.org/wiki/Q361128), [Q3400990](https://www.wikidata.org/wiki/Q3400990), [visionofbritain.org](https://visionofbritain.org/descriptions/1855130), [en.wikipedia.org](https://en.wikipedia.org/wiki/Tudors_of_Penmynydd) |
| Tyagaraja | Thanjavur, the point for the district | Tiruvarur (49 km) | [Q2044389](https://www.wikidata.org/wiki/Q2044389), [Q1025399](https://www.wikidata.org/wiki/Q1025399), [britannica.com](https://www.britannica.com/biography/Tyagaraja), [eemaata.com](https://eemaata.com/history/telugu_literary_homepage/Bio/tyagaraja.html) |
| Branwell Brontë | York, the point for Yorkshire | Thornton, near Bradford, Yorkshire (54 km) | [Q454616](https://www.wikidata.org/wiki/Q454616), [Q2406502](https://www.wikidata.org/wiki/Q2406502), [calderdalecompanion.co.uk](https://calderdalecompanion.co.uk/mmb393.html), [bradfordlocalstudies.com](https://bradfordlocalstudies.com/wp-content/uploads/2015/03/branwell-b-new-logo.pdf) |

Where only a village is known and it has no point in Wikidata, the pin is the nearest town and the panel says so (Sisulu: Qutubeni, pin Ngcobo; Clark Ashton Smith: Long Valley, pin Auburn; Ambrose Dlamini: Mbekelweni, pin Manzini; Huiyuan: Yanmen, pin Dai County).

Sources differ, and the panel says so: Gallus (Fréjus most likely, Cividale del Friuli possible), Tyagaraja (Tiruvarur in most sources, Tiruvaiyaru in some), Owen Tudor (Plas Penmynydd by tradition), Hernández Martínez (born 21 or 29 October 1882; 21 kept).

## Uncertain (the panel now says so)

Akhtar Mansour, Ratnasiri Wickremanayake, Aphrahat, Kakinomoto no Hitomaro, Beorhtric, Ramiro II of León, Mi Fu, Bohemond II of Antioch, Bertran de Born, Haakon II of Norway, Matthew Paris, John Gower, Elisabeth Domitien, S. P. Balasubrahmanyam, Gaius Julius Solinus, Rutilius Claudius Namatianus, Rastislav, Saint Naum, Taksony of Hungary, Magnus Henriksson, Sigurd II of Norway, Inge I of Norway, Eric VI of Denmark, John of Lancaster, Duke of Bedford, Lady Caroline Lamb, Jambyl Jabayev, Julia the Younger, Aureolus, Bořivoj I, Prokop the Great, Shoqan Walikhanov, Ruth Perry, Bogaletch Gebre, Arame of Urartu, Regalianus, Arbogast, Peter the Iberian, Ildibad, Eraric, Kumārila Bhaṭṭa, Doubravka of Bohemia, George Maniakes, William Marshal, 1st Earl of Pembroke, Kaidu, Musa Çelebi, Kara Ahmed Pasha, Francis Phoebus of Navarre.

Sources differ: Mi Fu (Xiangyang or Taiyuan), Elisabeth Domitien (Lobaye or Bangui), Shoqan Walikhanov (Kushmurun fort or Kuntimes), Akhtar Mansour (Band-e Taimur or Kariz). Named but no point found: S. P. Balasubrahmanyam (Konetammapeta), Bogaletch Gebre (Zato).

## How

- 67 new entries in the middle of `scripts/data/accuracy-fixes.json` (before `q199491`), well away from the spots #92, #93, #95 and #98 change. Then `node scripts/dedupe-places.mjs && npm run build:core`.
- Test: `src/lib/peopleFactcheckBatch11.test.ts`.
