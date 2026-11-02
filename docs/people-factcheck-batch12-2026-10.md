# People fact-check, batch 12 (Oct 2026): region-centre pins, continued

Carries on from batch 11 (#100). Same cause: Wikidata gives only a region, province, county or country as the birthplace, so the pin sits in the middle of that region.

## How the list was made

`node scripts/find-region-birthplaces.mjs` still finds **1,195** people. Using batch 11's own rules (leave out everyone in accuracy-fixes.json on main or an open PR, regions under 2,500 km², and everyone at or above Steven Runciman) gives the same **409**. Batch 11 checked the first 100 of those, ending at Heungseon Daewongun. This batch is the next **100**, from Nikolay Danilevsky to Gundobad.

## Totals

- Checked: **100**
- Fixed: **24** wrong pins. That includes 1 wrong birth year (Lê Lợi: 1385, not 1384), 1 wrong death date (Procopius: 27 May 366, not 28 May) and 1 misspelt name ("Murtaza Rajimov" is now Murtaza Rakhimov).
- Uncertain: **41**. The birthplace is not known, or sources disagree. The panel now says so. Nothing was guessed.
- Already fine: **35**. The point is the real town (Kolpino, Kaiyuan, Oguta, Rome), or the "region" is really a small parish, district or village (the Swedish parishes, Thanh Trì, Serantes, Paiania).
- Left on the list: **209**

**The error rate is high:** about 1 in 4 pins checked (24 of 100) was in the wrong place, and 41 more only have a region.

Each person was checked against Wikidata (P19, and P625 of the new place) and at least one other source found by web search.

## Fixes

| Person | Old pin | New pin | Sources |
|---|---|---|---|
| Nikolay Danilevsky | Livny, the point for Livny uyezd | Oberets, Livny uyezd, Oryol Governorate (25 km) | [Q120664](https://www.wikidata.org/wiki/Q120664), [Q24637369](https://www.wikidata.org/wiki/Q24637369), [britannica.com](https://www.britannica.com/print/article/151031), [rusmarka.ru](https://rusmarka.ru/en/news/n/144551.aspx) |
| Dara Singh | the middle of Punjab (in Pakistan) | Dharmuchak, near Amritsar, Punjab (109 km) | [Q165816](https://www.wikidata.org/wiki/Q165816), [Q48403](https://www.wikidata.org/wiki/Q48403), [en.wikipedia.org](https://en.wikipedia.org/wiki/Dara_Singh), [thebetterindia.com](https://www.thebetterindia.com/137215/legendary-wrestler-dara-singh-wwe-hall-of-fame/) |
| Gustav Leonhardt | the middle of the Netherlands | 's-Graveland (30 km) | [Q51584](https://www.wikidata.org/wiki/Q51584), [Q1615351](https://www.wikidata.org/wiki/Q1615351), [npr.org](https://www.npr.org/sections/deceptivecadence/2012/01/17/145337601/gustav-leonhardt-dies-at-83), [bach-cantatas.com](https://bach-cantatas.com/Bio/Leonhardt-Gustav.htm) |
| Vo Chi Cong | the middle of Quảng Nam | Tam Xuân, Núi Thành, Quảng Nam (49 km) | [Q434894](https://www.wikidata.org/wiki/Q434894), [Q2544802](https://www.wikidata.org/wiki/Q2544802), [nhandan.vn](https://nhandan.vn/ocop/nguoi-cong-san-trung-kien-nguoi-con-uu-tu-cua-que-huong-quang-nam-post709085.html), [thanhtra.com.vn](https://thanhtra.com.vn/theo-dong-thoi-cuoc/nha-lanh-dao-xuat-sac-cua-cach-mang-viet-nam-200277.html) |
| Tito Okello | the middle of Kitgum District | Namokora (Nam Okora), Kitgum District (37 km) | [Q376073](https://www.wikidata.org/wiki/Q376073), [Q31967336](https://www.wikidata.org/wiki/Q31967336), [globalsecurity.org](https://www.globalsecurity.org/military/world/uganda/okello.htm), [en.wikipedia.org](https://en.wikipedia.org/wiki/Tito_Okello) |
| Lê Thái Tổ | the middle of Thanh Hóa | Lam Sơn, Thọ Xuân, Thanh Hóa (14 km) | [Q1195391](https://www.wikidata.org/wiki/Q1195391), [Q10784259](https://www.wikidata.org/wiki/Q10784259), [luatminhkhue.vn](https://luatminhkhue.vn/nguyen-nhan-thang-loi-va-y-nghia-lich-su-cua-cuoc-khoi-nghia-lam-son.aspx), [en.wikipedia.org](https://en.wikipedia.org/wiki/L%C3%AA_L%E1%BB%A3i) |
| Osceola | the middle of Georgia (wrong state) | Talisi (now Tallassee), Alabama (230 km) | [Q335165](https://www.wikidata.org/wiki/Q335165), [Q79215](https://www.wikidata.org/wiki/Q79215), [encyclopediaofalabama.org](https://encyclopediaofalabama.org/article/osceola/), [en.wikipedia.org](https://en.wikipedia.org/wiki/Osceola) |
| Cetshwayo kaMpande | the middle of KwaZulu-Natal | Mlambongwenya, near Eshowe (45 km) | [Q380403](https://www.wikidata.org/wiki/Q380403), [Q1367652](https://www.wikidata.org/wiki/Q1367652), [sahistory.org.za](https://sahistory.org.za/people/king-cetshwayo), [britannica.com](https://www.britannica.com/biography/Cetshwayo) |
| Anton Ažbe | the middle of Carniola | Dolenčice, near Škofja Loka, Carniola (28 km) | [Q588124](https://www.wikidata.org/wiki/Q588124), [Q2934193](https://www.wikidata.org/wiki/Q2934193), [austria-forum.org](https://austria-forum.org/af/AustriaWiki/Anton_A%C5%BEbe), [vle.lt](https://www.vle.lt/Straipsnis/anton-azbe) |
| Paul Walden | Riga, the point for Livonia | Rozula, Livonia (now Latvia) (73 km) | [Q63131](https://www.wikidata.org/wiki/Q63131), [Q15219652](https://www.wikidata.org/wiki/Q15219652), [physmath.spbstu.ru](https://physmath.spbstu.ru/en/article/2013.20.30), [deutsche-biographie.de](https://www.deutsche-biographie.de/pnd118770969.html) |
| Telesphore Toppo | Ranchi (wrong point for Chainpur block) | Jhargaon, Chainpur, Gumla (115 km) | [Q539990](https://www.wikidata.org/wiki/Q539990), [Q109511169](https://www.wikidata.org/wiki/Q109511169), [archdioceseofbombay.org](https://www.archdioceseofbombay.org/post/telesphore-placidus-cardinal-toppo-passes-away), [rvasia.org](https://www.rvasia.org/asian-news/indian-cardinal-telesphore-toppo-passes-away) |
| Procopius | the middle of Cilicia | Corycus, Cilicia (105 km) | [Q316284](https://www.wikidata.org/wiki/Q316284), [Q1018772](https://www.wikidata.org/wiki/Q1018772), [roman-emperors.sites.luc.edu](https://roman-emperors.sites.luc.edu/procopis.htm), [ancientviolence.uni-hamburg.de](https://www.ancientviolence.uni-hamburg.de/receive/Antiquity_person_00001483) |
| Hind bint Utbah | the middle of Arabia | Mecca (659 km) | [Q1093767](https://www.wikidata.org/wiki/Q1093767), [Q5806](https://www.wikidata.org/wiki/Q5806), [en.wikipedia.org](https://en.wikipedia.org/wiki/Hind_bint_Utba), [en.wikishia.net](https://en.wikishia.net/view/Hind_bt._Utba) |
| Adomnán | the middle of County Donegal | probably Drumhome, County Donegal (40 km) | [Q120132](https://www.wikidata.org/wiki/Q120132), [Q104349152](https://www.wikidata.org/wiki/Q104349152), [newadvent.org](https://www.newadvent.org/cathen/01135c.htm), [livebreathescotland.com](https://www.livebreathescotland.com/biographies/adomnan-of-iona/) |
| Marpa Chokyi Lodro | Lhasa, the point for Tibet | Chukhyer, Lhodrak, southern Tibet (142 km) | [Q379577](https://www.wikidata.org/wiki/Q379577), [Q1364627](https://www.wikidata.org/wiki/Q1364627), [himalayanart.org](https://himalayanart.org/search/set.cfm?setID=5944), [samyeinstitute.org](https://www.samyeinstitute.org/vi/wiki/marpa-lotsawa/) |
| Shirkuh | the middle of Ayrarat | Dvin, Armenia (15 km) | [Q379886](https://www.wikidata.org/wiki/Q379886), [Q429059](https://www.wikidata.org/wiki/Q429059), [en.wikipedia.org](https://en.wikipedia.org/wiki/Najm_al-Din_Ayyub), [kurdistanica.com](https://kurdistanica.com/?p=246) |
| Pierre de Bourdeille, seigneur de Brantôme | the middle of Périgord | Bourdeilles, Périgord (18 km) | [Q733270](https://www.wikidata.org/wiki/Q733270), [Q865494](https://www.wikidata.org/wiki/Q865494), [britannica.com](https://www.britannica.com/EBchecked/topic/77812), [en.wikipedia.org](https://en.wikipedia.org/wiki/Pierre_de_Bourdeille,_seigneur_de_Brant%C3%B4me) |
| George Savile, 1st Marquess of Halifax | York, the point for Yorkshire | Thornhill, Yorkshire (48 km) | [Q335280](https://www.wikidata.org/wiki/Q335280), [Q2481104](https://www.wikidata.org/wiki/Q2481104), [westminster-abbey.org](https://westminster-abbey.org/abbey-commemorations/commemorations/george-savile-marquess-of-halifax), [britannica.com](https://www.britannica.com/print/article/252541) |
| John Ericsson | the middle of Färnebo parish | Långban, Värmland (17 km) | [Q435290](https://www.wikidata.org/wiki/Q435290), [Q1002624](https://www.wikidata.org/wiki/Q1002624), [gracesguide.co.uk](https://www.gracesguide.co.uk/John_Ericsson), [snl.no](https://snl.no/John_Ericsson) |
| James Murray | the middle of Roxburghshire | Denholm, Roxburghshire (18 km) | [Q960207](https://www.wikidata.org/wiki/Q960207), [Q1020223](https://www.wikidata.org/wiki/Q1020223), [britannica.com](https://www.britannica.com/biography/James-Murray), [blog.oup.com](https://blog.oup.com/?p=35297) |
| Vasili Blokhin | the middle of Vladimir Governorate | Gavrilovskoye, Suzdal district, Vladimir Governorate (30 km) | [Q83855](https://www.wikidata.org/wiki/Q83855), [Q16020275](https://www.wikidata.org/wiki/Q16020275), [weekend.rambler.ru](https://weekend.rambler.ru/people/43670080-vasiliy-blohin-samyy-krovavyy-palach-stalina), [en.wikipedia.org](https://en.wikipedia.org/wiki/Vasily_Blokhin) |
| Mouloud Feraoun | the middle of Kabylia | Tizi Hibel, Kabylia (78 km) | [Q382077](https://www.wikidata.org/wiki/Q382077), [Q3529981](https://www.wikidata.org/wiki/Q3529981), [britannica.com](https://www.britannica.com/print/article/204368), [en.wikipedia.org](https://en.wikipedia.org/wiki/Mouloud_Feraoun) |
| Bhupen Hazarika | the middle of Assam | Sadiya, Assam (334 km) | [Q855128](https://www.wikidata.org/wiki/Q855128), [Q7397977](https://www.wikidata.org/wiki/Q7397977), [sentinelassam.com](https://sentinelassam.com/editorial/bhupen-hazarika-melodious-maestro-and-cultural-icon-666072), [tribuneindia.com](https://www.tribuneindia.com/2011/20111106/main6.htm) |
| Murtaza Rakhimov | the middle of Kugarchinsky District | Tavakanovo, Kugarchinsky District (23 km) | [Q983505](https://www.wikidata.org/wiki/Q983505), [Q4449350](https://www.wikidata.org/wiki/Q4449350), [cyclowiki.org](https://cyclowiki.org/wiki/%D0%9C%D1%83%D1%80%D1%82%D0%B0%D0%B7%D0%B0_%D0%A0%D0%B0%D1%85%D0%B8%D0%BC%D0%BE%D0%B2), [en.wikipedia.org](https://en.wikipedia.org/wiki/Murtaza_Rakhimov) |

Some villages have no point in Wikidata, so the pin is the nearest town and the panel says so: Dara Singh (Dharmuchak, pin Amritsar), Telesphore Toppo (Jhargaon, pin Chainpur), Cetshwayo (Mlambongwenya, pin Eshowe) and Marpa (Chukhyer, pin Lhozhag County).

Sources differ, and the panel says so: Lê Lợi (Lam Sơn, or his mother's village of Chủ Sơn nearby) and Adomnán ("probably" Drumhome). For Danilevsky one source says Ostrov, and for Walden one says Rosenbeck. The main sources agree on Oberets and Rozula.

## Uncertain (the panel now says so)

Zitkala-Sa, Gauri Lankesh, Alexandros I of Epirus, Aretaeus of Cappadocia, Philostorgius, Valamir, Saint Gall, Widukind of Corvey, Marcabru, Edigu, Qaitbay, Diogo Dias, John Taverner, Wu Sangui, Alphonse Massamba-Débat, Barnabas Sibusiso Dlamini, Merit-Ptah, Zeno of Verona, Zuhayr, Cynegils, Bhaskara-I, Bjarni Herjólfsson, Izumi Shikibu, Albert of Aix, Michael Scot, Sorghaghtani Beki, Mechthild of Magdeburg, Treniota, Guy of Dampierre (shown as "Guy"), Siger of Brabant, George V of Georgia, Sten Sture the Elder, Ashraf Hotaki, Richard Kirwan, Krishan Kant, Abu Ayyub al-Masri, Ahmes, Eurydice of Egypt, Liu Gong, Victorinus of Pettau, Gundobad.

Sources differ: Gauri Lankesh (Shivamogga district or Bangalore), Wu Sangui (Gaoyou or Liaodong), Richard Kirwan (Cloughballymore or Cregg Castle). Named, but the place has no point: Philostorgius (Borissus), Alphonse Massamba-Débat (Nkolo), Krishan Kant (Kot Mohammad Khan).

## How

- 65 new entries in the middle of `scripts/data/accuracy-fixes.json` (before `q722738`), away from the parts that #92, #95, #98, #100 and #102 change. Then `node scripts/dedupe-places.mjs && npm run build:core`.
- Test: `src/lib/peopleFactcheckBatch12.test.ts`.
