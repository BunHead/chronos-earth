# People fact-check, batch 10 (Oct 2026): region-centre pins, continued

Carries on from batch 9 (#92). Same cause: Wikidata gives only a region, province, county or country as the birthplace, so the pin sits in the middle of that region.

## How the list was made

`node scripts/find-region-birthplaces.mjs` now finds **1,195** people. Leaving out everyone already in accuracy-fixes.json on main or on an open PR (#92, #93), regions under 2,500 km², and everyone at or above batch 9's last checked person leaves **529**, the same number #92 ended on.

## Totals

- Checked: **120** (the most notable 120 of the 529)
- Fixed: **28** wrong pins, plus **2** wrong death dates (Gaius Caesar, Ferdinand II of León) and **1** wrong birth year (Gedun Gyatso)
- Uncertain: **48**. The birthplace is not known; the panel now says so. Nothing was guessed.
- Already fine: **43** (the point is the real town, such as Rome, Stockholm, Lithang or Hong Kong, or the "region" is really a small parish or village)
- Left on the list: **409**

The error rate is high: about 1 in 4 pins checked (28 of 120) was in the wrong place, and 4 in 10 more only have a region.

Each was checked against Wikidata (P19, and P625 of the new place) and one other source found by web search.

## Fixes

| Person | Old pin | New pin | Sources |
|---|---|---|---|
| Melisende | the middle of Şanlıurfa Province | Edessa (now Şanlıurfa, Turkey) (26 km) | [Q232151](https://www.wikidata.org/wiki/Q232151), [encyclopedia.com](https://www.encyclopedia.com/women/dictionaries-thesauruses-pictures-and-press-releases/melisande-1105-1161), [historyofroyalwomen.com](https://historyofroyalwomen.com/the-royal-women/queens-regnant-melisende-jerusalem) |
| John Fisher | York, the point for Yorkshire | Beverley, Yorkshire (45 km) | [Q317149](https://www.wikidata.org/wiki/Q317149), [britannica.com](https://www.britannica.com/biography/Saint-John-Fisher) |
| Gedun Gyatso | the middle of Ngamring County | Tanak, near Shigatse, Tsang (160 km) | [Q25259](https://www.wikidata.org/wiki/Q25259), [dalailama.com](https://www.dalailama.com/the-dalai-lama/previous-dalai-lamas/previous-dalai-lama), [encyclopediaofbuddhism.org](https://www.encyclopediaofbuddhism.org/wiki/2nd_Dalai_Lama) |
| Daniel Boone | the middle of the Oley Valley | Boone Homestead, Exeter Township, Berks County, Pennsylvania (10 km) | [Q316661](https://www.wikidata.org/wiki/Q316661), [hmdb.org](https://www.hmdb.org/m.asp?m=23776), [en.wikipedia.org](https://en.wikipedia.org/wiki/Daniel_Boone_Homestead) |
| Julia Gardiner Tyler | the middle of Long Island | Gardiners Island, New York (101 km) | [Q234525](https://www.wikidata.org/wiki/Q234525), [britannica.com](https://www.britannica.com/biography/Julia-Tyler), [firstladies.si.edu](https://firstladies.si.edu/portrait/julia-tyler) |
| William Thomas Stead | the middle of Northumberland | Embleton, Northumberland (43 km) | [Q288301](https://www.wikidata.org/wiki/Q288301), [en.wikisource.org](https://en.wikisource.org/wiki/1911_Encyclop%C3%A6dia_Britannica/Stead,_William_Thomas), [attackingthedevil.co.uk](https://attackingthedevil.co.uk/bio.php) |
| Kim Seong-su | Jeonju, the point for North Jeolla Province | Gochang, North Jeolla (57 km) | [Q208203](https://www.wikidata.org/wiki/Q208203), [digitalarchive.wilsoncenter.org](https://digitalarchive.wilsoncenter.org/resource/modern-korean-history-portal/kim-seong-su) |
| Theodoros Kolokotronis | the middle of the Morea | Ramavouni, Messenia (43 km) | [Q319678](https://www.wikidata.org/wiki/Q319678), [greekreporter.com](https://greekreporter.com/2019/02/04/theodoros-kolokotronis-ultimate-symbol-of-the-greek-revolution/), [snl.no](https://snl.no/Theodoros_Kolokotronis) |
| William Beckford | the middle of Wiltshire | Soho Square, London (125 km) | [Q361026](https://www.wikidata.org/wiki/Q361026), [lbs.ucl.ac.uk](https://lbs.ucl.ac.uk/lbs/person/view/22232), [nts.org.uk](https://nts.org.uk/stories/william-beckford-1760-1844-part-one) |
| Dalai Lama 11 Khedrub Gyatso | Kangding, the point for the county | Garthar (Gartar), Minyak, Kham (77 km) | [Q25242](https://www.wikidata.org/wiki/Q25242), [treasuryoflives.org](https://treasuryoflives.org/biographies/view/Kedrub-Gyatso/P255), [rywiki.tsadra.org](https://rywiki.tsadra.org/index.php/Dalai_Lama_Khedrup_Gyatso) |
| Olive Schreiner | the middle of the Cape Colony, far to the west | Wittebergen mission, near Herschel, Cape Colony (905 km) | [Q151180](https://www.wikidata.org/wiki/Q151180), [sahistory.org.za](https://sahistory.org.za/people/olive-schreiner) |
| Josefa Iloilo | the middle of Fiji | Vuda, Ba, Fiji (74 km) | [Q316317](https://www.wikidata.org/wiki/Q316317), [en.wikipedia.org](https://en.wikipedia.org/wiki/Josefa_Iloilo), [en.wikipedia.org](https://en.wikipedia.org/wiki/Viseisei) |
| Mukhtar Auezov | the middle of the Russian Empire, in Siberia | Shyngystau, Semipalatinsk Oblast (now Abay District, Kazakhstan) (1227 km) | [Q557348](https://www.wikidata.org/wiki/Q557348), [e-history.kz](https://e-history.kz/en/biography/view/5), [qazaqculture.com](https://qazaqculture.com/en/cultural-objects/1d2093af-4da4-4a5c-8d3f-a5c7cd4b45a1) |
| James Hilton | the middle of Lancashire | Leigh, Lancashire (34 km) | [Q43227](https://www.wikidata.org/wiki/Q43227), [britannica.com](https://www.britannica.com/biography/James-Hilton), [alumni.christs.cam.ac.uk](https://alumni.christs.cam.ac.uk/james-hilton) |
| Yusof bin Ishak | the middle of Perak | Padang Gajah, Trong, near Taiping, Perak (32 km) | [Q259331](https://www.wikidata.org/wiki/Q259331), [istana.gov.sg](https://www.istana.gov.sg/the-president/former-presidents/encik-yusof-ishak/) |
| Qian Xuesen | the old Shanghai County, south-west of the city | Shanghai (16 km) | [Q333500](https://www.wikidata.org/wiki/Q333500), [explore.britannica.com](https://explore.britannica.com/explore/space/qian-xuesen) |
| Fujiwara no Teika | the middle of Japan | Kyoto (21 km) | [Q378425](https://www.wikidata.org/wiki/Q378425), [britannica.com](https://www.britannica.com/EBchecked/topic/221603), [librarything.com](https://www.librarything.com/a/392045) |
| Justo José de Urquiza | the middle of Entre Ríos Province | Talar de Arroyo Largo, near Concepción del Uruguay, Entre Ríos (105 km) | [Q336247](https://www.wikidata.org/wiki/Q336247), [ecured.cu](https://www.ecured.cu/Urquiza), [buscabiografias.com](https://www.buscabiografias.com/biografia/verDetalle/2771/Justo%20Jose%20de%20Urquiza) |
| Juan Vicente Gómez | the middle of Táchira | La Mulera, Táchira (31 km) | [Q317990](https://www.wikidata.org/wiki/Q317990), [buscabiografias.com](https://www.buscabiografias.com/biografia/verDetalle/658/Juan%20Vicente%20Gomez) |
| Michael Powell | the middle of Kent | Bekesbourne, Kent (30 km) | [Q55234](https://www.wikidata.org/wiki/Q55234), [britannica.com](https://www.britannica.com/biography/Michael-Powell), [blogs.canterbury.ac.uk](https://blogs.canterbury.ac.uk/library/?p=65178) |
| Phạm Văn Đồng | the middle of Quảng Ngãi province | Đức Tân, Mộ Đức, Quảng Ngãi (24 km) | [Q358051](https://www.wikidata.org/wiki/Q358051), [lsvn.vn](https://lsvn.vn/115-nam-ngay-sinh-dong-chi-pham-van-dong-1906-2021-pham-van-dong-nha-lanh-dao-xuat-sac-cua-dang1614587939-a101039.html) |
| Trường Chinh | the middle of Quảng Ngãi province, in the wrong part of Vietnam | Hành Thiện, Xuân Trường, Nam Định (638 km) | [Q545539](https://www.wikidata.org/wiki/Q545539), [trungbayonline.hoangthanhthanglong.vn](https://trungbayonline.hoangthanhthanglong.vn/QRCode/TruongChinhEn), [nhandan.vn](https://nhandan.vn/post-738079.html) |
| Ieng Sary | the middle of the Mekong Delta | Lương Hòa, Trà Vinh, Vietnam (60 km) | [Q379232](https://www.wikidata.org/wiki/Q379232), [eccc.gov.kh](https://eccc.gov.kh/en/cases/charged-profile/ieng-sary) |
| Omar Karami | Damascus, the point for the French Mandate | near Tripoli, Lebanon (111 km) | [Q396606](https://www.wikidata.org/wiki/Q396606), [gulfnews.com](https://gulfnews.com/world/mena/former-lebanese-pm-omar-karami-dies-aged-80-1.1434840), [en.wikipedia.org](https://en.wikipedia.org/wiki/Omar_Karami) |
| Samuel Wallis | the middle of Cornwall | Fentonwoon, near Camelford, Cornwall (38 km) | [Q433993](https://www.wikidata.org/wiki/Q433993), [cornishbirdblog.com](https://cornishbirdblog.com/samuel-wallis-cornish-explorer/), [morethannelson.com](https://morethannelson.com/?p=1799) |
| Sadriddin Ayni | the city of Bukhara, the point for the Emirate | Soktare, Gʻijduvon, Emirate of Bukhara (41 km) | [Q558794](https://www.wikidata.org/wiki/Q558794), [ous.wisc.edu](https://ous.wisc.edu/2016/04/27/the-sands-of-oxus/) |
| Khaqani | the middle of Shirvan | Shamakhi, Shirvan (82 km) | [Q368862](https://www.wikidata.org/wiki/Q368862), [preslib.az](https://www.preslib.az/en/historical/page/XTGQKOz), [britannica.com](https://www.britannica.com/biography/Khaqani) |
| Steven Runciman | the middle of Northumberland | West Denton Hall, Northumberland (27 km) | [Q49979](https://www.wikidata.org/wiki/Q49979), [britac.ac.uk](https://www.britac.ac.uk/documents/1737/120p365.pdf) |

Date fixes: Gaius Caesar died 21 February AD 4, not 19 February. Ferdinand II of León died 22 January 1188 at Benavente (León), not 29 January in "Benavente, Portugal". Gedun Gyatso was born in 1475, not 1476.

Where only a village is known and it has no point in Wikidata, the pin is the district or nearest town and the panel says so.

## Uncertain (the panel now says so)

Dihya, Ibn Khordadbeh, Magnus Barefoot, Vlad II Dracul, King Dongmyeong of Goguryeo, Postumus, Imru' al-Qais, Yonten Gyatso, Ahaziah, William of Malmesbury, Geoffrey of Villehardouin, Hartmann von Aue, Dalai Lama 09 Lungtok Gyatso, Parmenion, Aglaonike, Abd al-Rahman al-Ghafiqi, Sweyn II of Denmark, Magnus IV of Sweden, Haakon VI of Norway, Yumjaagiin Tsedenbal, Sulpicius Severus, Olaf I of Denmark, Tewodros II, Craterus, Theon of Alexandria, Simplicius of Cilicia, Antarah ibn Shaddad, Harald Greycloak, Władysław I Herman, Magnus IV of Norway, Ferdinand II of León, Chikamatsu Monzaemon, Jang Sung-taek, Saint Florian, Themistius, Bernard of Italy, Thorfinn Karlsefni, Ari Þorgilsson, Bairam Khan, Jamphel Gyatso, Bogd Khan, Malietoa Tanumafili II, Rahmon Nabiyev, Tang, Symeon the New Theologian, Eystein I of Norway, Boniface I, Marquess of Montferrat, Pontiac.

Sources differ: Beckford (Soho Square in most sources, Fonthill in one; Soho Square used), Tsedenbal (Davst or Bayan Chandmani Uul), Jang Sung-taek (Kangwon or Chongjin), Bogd Khan (near Lhasa or Lithang), Ferdinand II (Zamora or Toledo), Geoffrey of Villehardouin (near Troyes or near Bar-sur-Aube). The 8th and 9th Dalai Lamas' villages (Lhari Gang, Denchokor) are named, but no point was found.

## How

- 77 new entries in the middle of `scripts/data/accuracy-fixes.json` (before `q2142351`), well away from the spots #92 and #93 change. Then `node scripts/dedupe-places.mjs && npm run build:core`.
- Test: `src/lib/peopleFactcheckBatch10.test.ts`.
