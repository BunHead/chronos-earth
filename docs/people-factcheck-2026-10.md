# Notable people fact-check — October 2026

Why: Chronos told a child that Malcolm X was born in Atlanta. He was born in **Omaha, Nebraska, on 19 May 1925**, and died in **New York City (Manhattan) on 21 February 1965**.

## What we found about "Atlanta"

- Malcolm X's pin has always been at Omaha (41.2586, −95.9375), 1925–1965, in every version of the data since he was added (checked back to Sept 2026), in all six data files, the search index and the detail file.
- There is only one Malcolm X record. No live Wikidata lookup, region file, merge, search or "Fly here" path can move him or show another place.
- But the panel **never said where a person was born**. It showed only "1925 – 1965" and a Wikipedia summary that does not name his birthplace either. The place had to be guessed from the map. Martin Luther King Jr. (born Atlanta, 1929) is the nearest famous civil-rights pin, so a guess can easily land on Atlanta.
- The fix for that cause: every person's panel now has **Born** and **Died** lines in words, from Wikidata, e.g. "19 May 1925, Omaha, Nebraska". A line is only written when its year agrees with the pin, and only from a single, certain Wikidata value.

## How to re-run

`node scripts/factcheck-people.mjs` checks and writes `scripts/data/people-factcheck.json`. Add `--apply` to apply clear fixes and Born/Died lines, then run `npm run build:core`. People judged by hand to be wrong on Wikidata go in `scripts/data/people-review.json`, and are never changed.

## Totals

- People checked: **17,163** (against P19 birthplace + its P625, P569 birth date, P570 death date, P20 death place)
- Clear fixes applied: **14** (also saved in `scripts/data/accuracy-fixes.json`, so the nightly harvest can't undo them)
- People given Born/Died lines: **16,437**
- Doubtful, listed below and **not changed**: **705**

## Fixes applied

| Person | Was | Now | Why |
|---|---|---|---|
| [Alessandro Algardi](https://www.wikidata.org/wiki/Q336798) | born 1595 | born 1598 | birth year 1595 → 1598 |
| [James Dunlop](https://www.wikidata.org/wiki/Q375158) | pin 57, -5 | pin 55.711, -4.723 (Dalry) | pin 144 km from birthplace Dalry |
| [Juan N. Méndez](https://www.wikidata.org/wiki/Q519806) | pin 19.0036, -97.8883 | pin 19.8162, -97.8076 (Tetela de Ocampo) | pin 91 km from birthplace Tetela de Ocampo |
| [Edwin Barclay](https://www.wikidata.org/wiki/Q735400) | pin 6.5333, -9.75 | pin 6.3106, -10.8047 (Monrovia) | pin 119 km from birthplace Monrovia |
| [Taha Hussein](https://www.wikidata.org/wiki/Q328765) | pin 28.11, 30.11 | pin 28.6483, 30.8422 (Maghagha) | pin 93 km from birthplace Maghagha |
| [Buster Keaton](https://www.wikidata.org/wiki/Q103949) | pin 38.5, -98 | pin 37.9228, -95.5353 (Piqua) | pin 225 km from birthplace Piqua |
| [Raúl Leoni](https://www.wikidata.org/wiki/Q879003) | pin 5.95, -63.3333 | pin 7.3483, -62.5395 (El Manteco) | pin 178 km from birthplace El Manteco |
| [Henri Cartier-Bresson](https://www.wikidata.org/wiki/Q156567) | pin 47.7647, -3.1217 | pin 48.855, 2.7392 (Chanteloup-en-Brie) | pin 450 km from birthplace Chanteloup-en-Brie |
| [Hervé Bazin](https://www.wikidata.org/wiki/Q358479) | pin 50.6319, 3.0575 | pin 47.4728, -0.5556 (Angers) | pin 439 km from birthplace Angers |
| [Jim Backus](https://www.wikidata.org/wiki/Q1236412) | pin 40.5, -82.5 | pin 41.4992, -81.6947 (Cleveland) | pin 130 km from birthplace Cleveland |
| [Kamisese Mara](https://www.wikidata.org/wiki/Q469507) | pin -18, 178 | pin -17.2167, -178.9333 (Vanua Balavu) | pin 336 km from birthplace Vanua Balavu |
| [Boris Vian](https://www.wikidata.org/wiki/Q7833) | pin 49.8478, 3.2856 | pin 48.8261, 2.1933 (Ville-d'Avray) | pin 138 km from birthplace Ville-d'Avray |
| [Khaleda Zia](https://www.wikidata.org/wiki/Q234814) | born 1946 | born 1945 | birth year 1946 → 1945 |
| [Pōhiva Tuʻiʻonetoa](https://www.wikidata.org/wiki/Q48778102) | pin -20.5878, -174.8103 | pin -21.1364, -175.1205 (Talafoʻou) | pin 69 km from birthplace Talafoʻou |

## Follow-up: doubtful people checked by hand (Oct 2026)

27 doubtful people were checked against a second source (Wikipedia with its reference, Britannica, a national biography). Data is only changed where two sources agree; the source links are in `scripts/data/accuracy-fixes.json`.

- **18 resolved** (✅ in the tables below): the pin and year were checked, and the panel now has a hand-checked Born line (for Ibn Hišām: his death year, 833, and a note that his birth year is unknown). 4 pins were moved to the real birthplace (Golda Meir, Czesław Miłosz, José Mujica, James Brown).
- **9 still uncertain** (❔): good sources still disagree. Nothing false is shown as exact; the panel says the place or date is uncertain.
- The rest of the 705 are not yet checked by hand.

## Doubtful — left as they are

A script must not decide these. Each links to Wikidata. "On the globe" is the years shown now.

### Checked by hand: Wikidata looks wrong or unsettled (14)

| Person | On the globe | What disagrees |
|---|---|---|
| [Abdul Qadir Gilani](https://www.wikidata.org/wiki/Q307365) | 1078–1166 | checked by hand: birthplace disputed: Gilan in Iran, or a Gilan near Baghdad; pin 262 km from birthplace Gilan Province — ❔ **Still uncertain (Oct 2026), panel says so:** Still disputed (Gilan in Iran, or near Baghdad). The panel now says so. Sources: [wikipedia.org](https://en.wikipedia.org/wiki/Abdul_Qadir_Gilani) |
| [Amadou Mahtar M'Bow](https://www.wikidata.org/wiki/Q740168) | 1921–2024 | checked by hand: sources differ: Dakar (the pin) or Saint-Louis (Wikidata); pin 181 km from birthplace Saint-Louis — ✅ **Resolved (Oct 2026):** Dakar, 1921 (the pin). Saint-Louis is his parents' home region, not his birthplace. Sources: [wikipedia.org](https://en.wikipedia.org/wiki/Amadou-Mahtar_M%27Bow), [unesdoc.unesco.org](https://unesdoc.unesco.org/ark:/48223/pf0000048244) |
| [Blaise Cendrars](https://www.wikidata.org/wiki/Q123080) | 1887–1961 | checked by hand: born in La Chaux-de-Fonds, Switzerland, where the pin is; Wikidata says Limoges; pin 449 km from birthplace Limoges — ✅ **Resolved (Oct 2026):** La Chaux-de-Fonds, 1887 (the pin). Wikidata's Limoges is wrong. Sources: [wikipedia.org](https://en.wikipedia.org/wiki/Blaise_Cendrars), [britannica.com](https://www.britannica.com/biography/Blaise-Cendrars) |
| [Fabrizio De André](https://www.wikidata.org/wiki/Q25106) | 1940–1999 | checked by hand: born in Genoa, where the pin is; Wikidata says Ferrara; pin 218 km from birthplace Ferrara — ✅ **Resolved (Oct 2026):** Genoa (Pegli), 1940 (the pin). Wikidata's Ferrara is wrong. Sources: [wikipedia.org](https://en.wikipedia.org/wiki/Fabrizio_De_Andr%C3%A9), [muziekweb.nl](https://www.muziekweb.nl/en/Link/M00000050169/POPULAR/Fabrizio-de-Andr%C3%A9) |
| [Francesco Redi](https://www.wikidata.org/wiki/Q311187) | 1626–1697 | checked by hand: born in Arezzo, Italy, where the pin is; Wikidata's Villapene (Spain) is a mix-up; pin 1570 km from birthplace Villapene — ✅ **Resolved (Oct 2026):** Arezzo, 1626 (the pin). Wikidata's Villapene (Spain) is wrong. Sources: [wikipedia.org](https://en.wikipedia.org/wiki/Francesco_Redi), [britannica.com](https://www.britannica.com/facts/Francesco-Redi) |
| [Halil Kut](https://www.wikidata.org/wiki/Q367697) | 1881–1957 | checked by hand: sources differ: 1881 (the pin) or 1882 (Wikidata); birth year 1881 → 1882 — ✅ **Resolved (Oct 2026):** Istanbul, 1881 (the pin). 1882 is a minority date. Sources: [wikipedia.org](https://en.wikipedia.org/wiki/Halil_Kut), [encyclopedia.1914-1918-online.net](https://encyclopedia.1914-1918-online.net/article/kut_halil) |
| [Ibn Hišām](https://www.wikidata.org/wiki/Q461096) | 701–? | checked by hand: the birth year on file (701) is a placeholder, and his death is given as 828 or 833; death year none → 828 — ✅ **Resolved (Oct 2026):** Died 833 (both sources). Birth year unknown: the panel now says 701 is a placeholder. Sources: [wikipedia.org](https://en.wikipedia.org/wiki/Ibn_Hisham), [fiqh.islamonline.net](https://fiqh.islamonline.net/en/the-biography-of-ibn-hisham-the-author-of-the-biography-of-the-prophet-sirat-ibn-hisham/) |
| [Jenny von Westphalen](https://www.wikidata.org/wiki/Q238302) | 1814–1881 | checked by hand: born 12 February 1814 (the pin); Wikidata says 1813; birth year 1814 → 1813 — ✅ **Resolved (Oct 2026):** Salzwedel, 12 Feb 1814 (the pin). Wikidata's 1813 is wrong. Sources: [wikipedia.org](https://en.wikipedia.org/wiki/Jenny_von_Westphalen), [encyclopedia.com](https://www.encyclopedia.com/women/dictionaries-thesauruses-pictures-and-press-releases/marx-jenny-von-westphalen-1814-1881) |
| [Karl Heinrich Ulrichs](https://www.wikidata.org/wiki/Q60318) | 1825–1895 | checked by hand: born at Westerhof near Aurich, Germany, where the pin is; Wikidata's General Bravo (Mexico) is a mix-up; pin 8731 km from birthplace General Bravo Municipality — ✅ **Resolved (Oct 2026):** Westerfeld near Aurich, 1825 (the pin). Wikidata's General Bravo (Mexico) is wrong. Sources: [wikipedia.org](https://en.wikipedia.org/wiki/Karl_Heinrich_Ulrichs), [deutsche-biographie.de](https://www.deutsche-biographie.de/11888980X.html) |
| [Konstantin Chernenko](https://www.wikidata.org/wiki/Q127442) | 1911–1985 | checked by hand: born 24 September 1911 (the pin); Wikidata says 1912; birth year 1911 → 1912 — ✅ **Resolved (Oct 2026):** Bolshaya Tes, 24 Sep 1911 (New Style; the pin). Wikidata's 1912 is wrong. Sources: [wikipedia.org](https://en.wikipedia.org/wiki/Konstantin_Chernenko), [britannica.com](https://www.britannica.com/biography/Konstantin-Chernenko) |
| [Lev Rudnev](https://www.wikidata.org/wiki/Q723343) | 1885–1956 | checked by hand: sources differ: Novgorod (the pin) or Opochka (Wikidata); pin 254 km from birthplace Opochka — ❔ **Still uncertain (Oct 2026), panel says so:** Still differ (Novgorod or Opochka). The panel now says so. Sources: [wikipedia.org](https://en.wikipedia.org/wiki/Lev_Rudnev), [architectuul.com](https://architectuul.com/architect/lev-rudnev) |
| [Mary Anderson](https://www.wikidata.org/wiki/Q17518) | 1866–1953 | checked by hand: the inventor was born in Greene County, Alabama, where the pin is; Wikidata's "Peru" is a mix-up; pin 4866 km from birthplace Peru — ✅ **Resolved (Oct 2026):** Burton Hill Plantation, Greene County, Alabama, 1866 (the pin). Wikidata's "Peru" is wrong. Sources: [wikipedia.org](https://en.wikipedia.org/wiki/Mary_Anderson_(inventor)), [encyclopediaofalabama.org](https://encyclopediaofalabama.org/article/mary-anderson/) |
| [Philip Johan von Strahlenberg](https://www.wikidata.org/wiki/Q76639) | 1676–1747 | checked by hand: sources differ: 1676 (the pin) or 1677 (Wikidata); birth year 1676 → 1677 — ✅ **Resolved (Oct 2026):** Stralsund, 1676 (the pin). 1677 comes from one dealer's listing only. Sources: [wikipedia.org](https://en.wikipedia.org/wiki/Philip_Johan_von_Strahlenberg), [runeberg.org](https://runeberg.org/vjberingen/0229.html) |
| [Pote Sarasin](https://www.wikidata.org/wiki/Q982335) | 1905–2000 | checked by hand: sources differ: 1905 (the pin) or 1906 (Wikidata); birth year 1905 → 1906 — ❔ **Still uncertain (Oct 2026), panel says so:** Only one good source for 1905 (a CIA file says 1904). The panel now says the year is uncertain. Sources: [wikipedia.org](https://en.wikipedia.org/wiki/Pote_Sarasin), [cia.gov](https://www.cia.gov/readingroom/print/391311) |

### Several birthplaces on Wikidata (130)

| Person | On the globe | What disagrees |
|---|---|---|
| [Abeid Karume](https://www.wikidata.org/wiki/Q318310) | 1905–1972 | Wikidata has 2 birthplaces (Nyasaland; Mwera) |
| [Abraham Robinson](https://www.wikidata.org/wiki/Q330567) | 1918–1974 | Wikidata has 2 birthplaces (Wałbrzych; Waldenburg) |
| [Abram Petrovich Gannibal](https://www.wikidata.org/wiki/Q326449) | 1696–1781 | Wikidata has 2 birthplaces (Ethiopian Empire; Logone-Birni) |
| [Abubakar Tafawa Balewa](https://www.wikidata.org/wiki/Q335684) | 1912–1966 | Wikidata has 2 birthplaces (Bauchi; Tafawa Balewa) |
| [Al-Kindi](https://www.wikidata.org/wiki/Q179759) | 801–870 | Wikidata has 2 death years (873, 870); Wikidata has 2 birthplaces (Basra; Kufa) |
| [Albrecht Altdorfer](https://www.wikidata.org/wiki/Q153746) | 1480–1538 | Wikidata has 2 birthplaces (Regensburg; Altdorf bei Nürnberg) |
| [Alexander Radishchev](https://www.wikidata.org/wiki/Q217470) | 1749–1802 | Wikidata has 2 birthplaces (Moscow; Radischevo) |
| [Alexandros Zaimis](https://www.wikidata.org/wiki/Q332096) | 1855–1936 | Wikidata has 2 birthplaces (Athens; Patras) |
| [Alice Stone Blackwell](https://www.wikidata.org/wiki/Q2646853) | 1857–1950 | Wikidata has 2 birthplaces (New Jersey; Orange) |
| [Almanzor](https://www.wikidata.org/wiki/Q334861) | 938–1002 | Wikidata has 2 birthplaces (Algeciras; Umayyad Caliphate) |
| [Andrei Grechko](https://www.wikidata.org/wiki/Q312495) | 1903–1976 | Wikidata has 2 birthplaces (Rostov-on-Don; Kuybyshevo) |
| [Andrew Grove](https://www.wikidata.org/wiki/Q432929) | 1936–2016 | Wikidata has 2 birthplaces (United States; Budapest) |
| [Antiochus Kantemir](https://www.wikidata.org/wiki/Q372115) | 1708–1744 | Wikidata has 2 birthplaces (Constantinople; Iași) |
| [Aparicio Méndez](https://www.wikidata.org/wiki/Q471275) | 1904–1988 | Wikidata has 2 birthplaces (Rivera Department; Rivera) |
| [Archduke Leopold Wilhelm of Austria](https://www.wikidata.org/wiki/Q437295) | 1614–1662 | Wikidata has 2 birthplaces (Graz; Wiener Neustadt) |
| [Archduke Rudolf of Austria](https://www.wikidata.org/wiki/Q93373) | 1788–1831 | Wikidata has 2 birthplaces (Florence; Pisa) |
| [Armando Manzanero](https://www.wikidata.org/wiki/Q1453045) | 1935–2020 | Wikidata has 2 birthplaces (Mérida; Ticul Municipality) |
| [Arnaldus de Villa Nova](https://www.wikidata.org/wiki/Q356568) | 1240–1311 | Wikidata has 2 birth years (1258, 1240); Wikidata has 2 death years (1313, 1311); Wikidata has 2 birthplaces (Villanueva de Jiloca; Grau) |
| [Asaf Jah VII of Hyderabad](https://www.wikidata.org/wiki/Q468298) | 1886–1967 | Wikidata has 2 birthplaces (Hyderabad; Hyderabad State) |
| [Atahualpa](https://www.wikidata.org/wiki/Q179577) | 1500–1533 | Wikidata has 2 birthplaces (Quito; Cusco) |
| [Bahram Chobin](https://www.wikidata.org/wiki/Q311283) | 600–? | death year 592 is before the birth year on file (600); Wikidata has 2 birthplaces (Sasanian Empire; Ray) |
| [Bartolomé Mitre](https://www.wikidata.org/wiki/Q314362) | 1821–1906 | Wikidata has 2 birthplaces (Argentina; Buenos Aires) |
| [Bhaskara II](https://www.wikidata.org/wiki/Q213385) | 1114–1185 | Wikidata has 2 birthplaces (Bidar; Beed) |
| [Blind Willie Johnson](https://www.wikidata.org/wiki/Q712586) | 1897–1945 | Wikidata has 2 birthplaces (Brenham; Pendleton) |
| [Carl Barks](https://www.wikidata.org/wiki/Q11941) | 1901–2000 | Wikidata has 2 birthplaces (Oregon; Merrill) |
| [Carlo Fontana](https://www.wikidata.org/wiki/Q704356) | 1638–1714 | Wikidata has 2 birthplaces (Switzerland; Novazzano) |
| [Carlos P. Romulo](https://www.wikidata.org/wiki/Q737664) | 1899–1985 | Wikidata has 2 birthplaces (Manila; Camiling) |
| [Caroline Harrison](https://www.wikidata.org/wiki/Q234263) | 1832–1892 | Wikidata has 2 birthplaces (Washington, D.C.; Oxford) |
| [Claes Oldenburg](https://www.wikidata.org/wiki/Q156731) | 1929–2022 | Wikidata has 2 birthplaces (Stockholm; Malmö) |
| [Countess Palatine Caroline of Zweibrücken](https://www.wikidata.org/wiki/Q62063) | 1721–1774 | Wikidata has 2 birthplaces (Strasbourg; Ribeauvillé) |
| [Czesław Miłosz](https://www.wikidata.org/wiki/Q45970) | 1911–2004 | Wikidata has 2 birthplaces (Šiauliai; Šeteniai) — ✅ **Resolved (Oct 2026):** Born in Šeteniai. The pin was at Šiauliai, about 70 km away; moved to Šeteniai. Sources: [wikipedia.org](https://en.wikipedia.org/wiki/Czes%C5%82aw_Mi%C5%82osz), [britannica.com](https://www.britannica.com/biography/Czeslaw-Milosz) |
| [Diori Hamani](https://www.wikidata.org/wiki/Q314355) | 1916–1989 | Wikidata has 2 birthplaces (Boboye Department; Soudouré) |
| [Don Shirley](https://www.wikidata.org/wiki/Q5293521) | 1927–2013 | Wikidata has 2 birthplaces (Kingston; Pensacola) |
| [Eddie Van Halen](https://www.wikidata.org/wiki/Q272012) | 1955–2020 | Wikidata has 2 birthplaces (Amsterdam; Nijmegen) |
| [Elagabalus](https://www.wikidata.org/wiki/Q1762) | 203–222 | Wikidata has 3 birthplaces (Rome; Velletri; Emesa) |
| [Erich von dem Bach-Zelewski](https://www.wikidata.org/wiki/Q57267) | 1899–1972 | Wikidata has 2 birthplaces (Germany; Lębork) |
| [Esteban Echeverría Mamani](https://www.wikidata.org/wiki/Q188859) | 1805–1851 | Wikidata has 2 birthplaces (Argentina; Buenos Aires) |
| [Eugène Scribe](https://www.wikidata.org/wiki/Q319261) | 1791–1861 | Wikidata has 2 birthplaces (Paris; France) |
| [Fede Galizia](https://www.wikidata.org/wiki/Q2428749) | 1578–1630 | Wikidata has 2 birthplaces (Milan; Trento) |
| [Frances Allen](https://www.wikidata.org/wiki/Q9602) | 1932–2020 | Wikidata has 2 birthplaces (New York; Peru) |
| [Fructuoso Rivera](https://www.wikidata.org/wiki/Q467976) | 1784–1854 | Wikidata has 2 birthplaces (Montevideo; Durazno Department) |
| [Fulbert Youlou](https://www.wikidata.org/wiki/Q559442) | 1917–1972 | Wikidata has 2 birthplaces (Brazzaville; Pool Department) |
| [Galileo Ferraris](https://www.wikidata.org/wiki/Q550262) | 1847–1897 | Wikidata has 2 birthplaces (Italy; Livorno Ferraris) |
| [George Washington Carver](https://www.wikidata.org/wiki/Q296898) | 1864–1943 | Wikidata has 2 birthplaces (United States; Diamond) |
| [Georges Florovsky](https://www.wikidata.org/wiki/Q714187) | 1893–1979 | Wikidata has 2 birthplaces (Odesa; Kropyvnytskyi) |
| [Giovanni Battista Gaulli](https://www.wikidata.org/wiki/Q520573) | 1639–1709 | Wikidata has 2 birthplaces (Genoa; Génova) |
| [Golda Meir](https://www.wikidata.org/wiki/Q42992) | 1898–1978 | Wikidata has 3 birthplaces (Ukraine; Kyiv; Russian Empire) — ✅ **Resolved (Oct 2026):** Born in Kyiv. The pin was at the middle of Ukraine (49, 32); moved to Kyiv. Sources: [wikipedia.org](https://en.wikipedia.org/wiki/Golda_Meir), [britannica.com](https://www.britannica.com/biography/Golda-Meir) |
| [Guido of Arezzo](https://www.wikidata.org/wiki/Q192238) | 992–1050 | Wikidata has 2 birthplaces (Arezzo; Abbazia di Pomposa) |
| [Gyula Andrássy](https://www.wikidata.org/wiki/Q313557) | 1823–1890 | Wikidata has 2 birthplaces (Vlachovo; Zemun) |
| [Habibullah Khan](https://www.wikidata.org/wiki/Q334869) | 1872–1919 | Wikidata has 2 birthplaces (Samarkand; Tashkent) |
| [Han Gan](https://www.wikidata.org/wiki/Q561952) | 706–783 | Wikidata has 2 birth years (742, 706); Wikidata has 2 birthplaces (Xi'an; Kaifeng) |
| [Hans Hofmann](https://www.wikidata.org/wiki/Q215461) | 1880–1966 | Wikidata has 2 birthplaces (Weißenburg in Bayern; Weißenberg) |
| [Hans Memling](https://www.wikidata.org/wiki/Q106851) | 1435–1494 | Wikidata has 2 birthplaces (Mainz; Seligenstadt) |
| [Harry Partch](https://www.wikidata.org/wiki/Q201494) | 1901–1974 | Wikidata has 2 birthplaces (California; Oakland) |
| [Henry Hudson](https://www.wikidata.org/wiki/Q179167) | 1565–1611 | Wikidata has 2 birthplaces (London; Kingdom of England) |
| [Henryk Siemiradzki](https://www.wikidata.org/wiki/Q192544) | 1843–1902 | Wikidata has 2 birthplaces (Kharkiv; Pechenihy) |
| [Hilla Limann](https://www.wikidata.org/wiki/Q50997) | 1934–1998 | Wikidata has 2 birthplaces (Gold Coast Colony; Gwollu) |
| [Horacio Quiroga](https://www.wikidata.org/wiki/Q16864) | 1878–1937 | Wikidata has 2 birthplaces (Salto Department; Salto) |
| [Ibrahim Baré Maïnassara](https://www.wikidata.org/wiki/Q365417) | 1949–1999 | Wikidata has 2 birthplaces (Dogondoutchi; Maradi) |
| [Ibrahim Nasir](https://www.wikidata.org/wiki/Q558802) | 1926–2008 | Wikidata has 2 birthplaces (Malé; Fuvahmulah) |
| [Idi Amin](https://www.wikidata.org/wiki/Q48231) | 1925–2003 | Wikidata has 2 birthplaces (Kampala; Koboko) — ❔ **Still uncertain (Oct 2026), panel says so:** Still uncertain (Koboko or Kampala, about 1925). The panel now says so. Sources: [wikipedia.org](https://en.wikipedia.org/wiki/Idi_Amin) |
| [Irving Berlin](https://www.wikidata.org/wiki/Q128746) | 1888–1989 | Wikidata has 2 birthplaces (Tyumen; Talachyn) |
| [Isaac Levitan](https://www.wikidata.org/wiki/Q211356) | 1860–1900 | Wikidata has 2 birthplaces (Kėdainiai; Kybartai) |
| [Jacob Clemens non Papa](https://www.wikidata.org/wiki/Q438090) | 1510–1555 | Wikidata has 2 birthplaces (Middelburg; Ypres) |
| [Jacopo Amigoni](https://www.wikidata.org/wiki/Q380897) | 1682–1752 | Wikidata has 2 birthplaces (Venice; Naples) |
| [James Brown](https://www.wikidata.org/wiki/Q5950) | 1933–2006 | Wikidata has 2 birthplaces (Augusta; Barnwell) — ✅ **Resolved (Oct 2026):** Born in Barnwell, South Carolina (raised in Augusta). The pin was at Augusta; moved to Barnwell. Sources: [wikipedia.org](https://en.wikipedia.org/wiki/James_Brown), [britannica.com](https://www.britannica.com/biography/James-Brown) |
| [James Salter](https://www.wikidata.org/wiki/Q1395915) | 1925–2015 | Wikidata has 2 birthplaces (New York City; Preston) |
| [Jayadeva](https://www.wikidata.org/wiki/Q335015) | 1170–1245 | Wikidata has 2 birthplaces (Jaydev Kenduli; Kenduli Sasan) |
| [Jiang Qing](https://www.wikidata.org/wiki/Q236017) | 1914–1991 | Wikidata has 2 birthplaces (People's Republic of China; Zhucheng) |
| [Jim Steinman](https://www.wikidata.org/wiki/Q281908) | 1947–2021 | Wikidata has 2 birthplaces (New York City; Claremont) |
| [Johann Lukas von Hildebrandt](https://www.wikidata.org/wiki/Q84507) | 1668–1745 | Wikidata has 2 birthplaces (Genoa; Vienna) |
| [John Sulston](https://www.wikidata.org/wiki/Q271532) | 1942–2018 | Wikidata has 2 birthplaces (Cambridge; Fulmer) |
| [Jonas Malheiro Savimbi](https://www.wikidata.org/wiki/Q273051) | 1934–2002 | Wikidata has 2 birthplaces (Munhango; Moxico Province) |
| [Jonas Mekas](https://www.wikidata.org/wiki/Q699702) | 1922–2019 | Wikidata has 2 birthplaces (Lithuania; Biržai) |
| [Jorge Manrique](https://www.wikidata.org/wiki/Q389233) | 1440–1479 | Wikidata has 2 birthplaces (Paredes de Nava; Segura de la Sierra) |
| [José Hernández](https://www.wikidata.org/wiki/Q377623) | 1834–1886 | Wikidata has 2 birthplaces (Argentina; San Andrés de Giles) |
| [José Mujica](https://www.wikidata.org/wiki/Q9094) | 1935–2025 | Wikidata has 2 birthplaces (Montevideo; Cerro Largo Department) — ✅ **Resolved (Oct 2026):** Born in Montevideo. The pin was in Cerro Largo, about 340 km away; moved to Montevideo. Sources: [wikipedia.org](https://en.wikipedia.org/wiki/Jos%C3%A9_Mujica), [britannica.com](https://www.britannica.com/biography/Jose-Mujica) |
| [Juan Bautista Alberdi](https://www.wikidata.org/wiki/Q722738) | 1810–1884 | Wikidata has 2 birthplaces (Argentina; San Miguel de Tucumán) |
| [Judith Jarvis Thomson](https://www.wikidata.org/wiki/Q3120860) | 1929–2020 | Wikidata has 2 birthplaces (United States; New York City) |
| [Kanaiyalal Maneklal Munshi](https://www.wikidata.org/wiki/Q2721812) | 1887–1971 | Wikidata has 2 birthplaces (Bharuch; Bharuch district) |
| [Katharina von Bora](https://www.wikidata.org/wiki/Q77239) | 1499–1552 | Wikidata has 2 birthplaces (Hirschfeld; Lippendorf) |
| [Khorloogiin Choibalsan](https://www.wikidata.org/wiki/Q311488) | 1895–1952 | Wikidata has 2 birthplaces (Khentii Province; Dadal) |
| [Kofi Awoonor](https://www.wikidata.org/wiki/Q921435) | 1935–2013 | Wikidata has 2 birthplaces (Gold Coast Colony; Wheta) |
| [Kumārajīva](https://www.wikidata.org/wiki/Q335293) | 344–413 | Wikidata has 2 birthplaces (Kushan Empire; Kucha) |
| [Kusumoto Ine](https://www.wikidata.org/wiki/Q449696) | 1827–1903 | Wikidata has 2 birthplaces (Dejima; Nagasaki) |
| [Laurent-Désiré Kabila](https://www.wikidata.org/wiki/Q135547) | 1939–2001 | Wikidata has 2 birthplaces (Likasi; Moba) |
| [Li Bai](https://www.wikidata.org/wiki/Q7071) | 701–762 | Wikidata has 2 birthplaces (Suyab; Jiangyou) — ❔ **Still uncertain (Oct 2026), panel says so:** Still uncertain (Suyab or Jiangyou). The panel now says so. Sources: [wikipedia.org](https://en.wikipedia.org/wiki/Li_Bai) |
| [Louis the Blind](https://www.wikidata.org/wiki/Q310435) | 880–928 | Wikidata has 2 birthplaces (Provence; Autun) |
| [Lucian of Antioch](https://www.wikidata.org/wiki/Q510737) | 240–312 | Wikidata has 2 birthplaces (Antakya; Samosata) |
| [Luiz Gonzaga](https://www.wikidata.org/wiki/Q982314) | 1912–1989 | Wikidata has 2 birthplaces (Q40942; Exu) |
| [Marie Louise Gonzaga](https://www.wikidata.org/wiki/Q232793) | 1611–1667 | Wikidata has 2 birthplaces (Paris; Nevers) |
| [Max Roach](https://www.wikidata.org/wiki/Q175899) | 1924–2007 | Wikidata has 2 birthplaces (New York City; Newland) |
| [Memphis Minnie](https://www.wikidata.org/wiki/Q464728) | 1896–1973 | Wikidata has 2 birth years (1896, 1897); Wikidata has 2 birthplaces (Louisiana; Algiers) |
| [Michael Servetus](https://www.wikidata.org/wiki/Q185914) | 1511–1553 | Wikidata has 2 birthplaces (Tudela; Villanueva de Sigena) |
| [Miguel Ángel Juárez Celman](https://www.wikidata.org/wiki/Q438892) | 1844–1909 | Wikidata has 2 birthplaces (Córdoba; Córdoba) |
| [Mikhail Zoshchenko](https://www.wikidata.org/wiki/Q360507) | 1894–1958 | Wikidata has 2 birthplaces (Saint Petersburg; Poltava) |
| [Milton Obote](https://www.wikidata.org/wiki/Q210069) | 1925–2005 | Wikidata has 2 birthplaces (Uganda; Apac) |
| [Mrinalini Sarabhai](https://www.wikidata.org/wiki/Q3595821) | 1918–2016 | Wikidata has 2 birthplaces (Chennai; Palakkad) |
| [Nasimi](https://www.wikidata.org/wiki/Q982506) | 1369–1419 | Wikidata has 6 birthplaces (Baghdad; Aleppo; Tabriz; Diyarbakır; Shamakhi; Shiraz) |
| [Nicolas Chamfort](https://www.wikidata.org/wiki/Q347891) | 1740–1794 | Wikidata has 2 birth years (1740, 1741); Wikidata has 2 birthplaces (Clermont-Ferrand; Clermont) |
| [Nikolai Severtzov](https://www.wikidata.org/wiki/Q461129) | 1827–1885 | Wikidata has 2 birthplaces (Voronezh; Yasenki) |
| [Nikoloz Baratashvili](https://www.wikidata.org/wiki/Q560238) | 1817–1845 | Wikidata has 2 birthplaces (Georgia; Tbilisi) |
| [Pan Yuliang](https://www.wikidata.org/wiki/Q148400) | 1895–1977 | Wikidata has 2 birth years (1899, 1895); Wikidata has 2 birthplaces (Anhui; Jiangdu District) |
| [Peter, 1st Prince of Sayn-Wittgenstein-Ludwigsburg](https://www.wikidata.org/wiki/Q432580) | 1769–1843 | Wikidata has 2 birthplaces (Pereiaslav; Nizhyn) |
| [Philip Kerr](https://www.wikidata.org/wiki/Q556815) | 1956–2018 | Wikidata has 2 birthplaces (United Kingdom; Edinburgh) |
| [Plotinus](https://www.wikidata.org/wiki/Q134189) | 205–270 | Wikidata has 2 birthplaces (Asyut; Lycopolis) |
| [Prudentius](https://www.wikidata.org/wiki/Q347250) | 348–405 | Wikidata has 2 death years (405, 413); Wikidata has 3 birthplaces (Caesaraugusta; Calagurris; Calahorra) |
| [Reza Abbasi](https://www.wikidata.org/wiki/Q380726) | 1565–1635 | Wikidata has 2 birth years (1565, 1570); Wikidata has 2 birthplaces (Mashhad; Kashan) |
| [Rita Süssmuth](https://www.wikidata.org/wiki/Q66286) | 1937–2026 | Wikidata has 2 birthplaces (Germany; Wuppertal) |
| [Robert Clive](https://www.wikidata.org/wiki/Q162296) | 1725–1774 | Wikidata has 2 birthplaces (Shropshire; Kingdom of Great Britain) |
| [Ruth Handler](https://www.wikidata.org/wiki/Q242034) | 1916–2002 | Wikidata has 2 birthplaces (Colorado; Denver) |
| [Sam Cooke](https://www.wikidata.org/wiki/Q295919) | 1931–1964 | Wikidata has 2 birthplaces (Chicago; Clarksdale) |
| [Sassetta](https://www.wikidata.org/wiki/Q362016) | 1392–1450 | Wikidata has 2 birthplaces (Siena; Cortona) |
| [Sebastião José de Carvalho e Melo, 1st Marquis of Pombal](https://www.wikidata.org/wiki/Q319511) | 1699–1782 | Wikidata has 2 birthplaces (Lisbon; Sernancelhe) |
| [Semyon Dezhnyov](https://www.wikidata.org/wiki/Q333210) | 1605–1673 | Wikidata has 2 birthplaces (Pinega; Veliky Ustyug) |
| [Siad Barre](https://www.wikidata.org/wiki/Q209828) | 1919–1995 | Wikidata has 3 birthplaces (Garbahaareey; Shilavo; Luuq) |
| [Steve Biko](https://www.wikidata.org/wiki/Q214473) | 1946–1977 | Wikidata has 2 birthplaces (Tarkastad; Qonce) — ✅ **Resolved (Oct 2026):** Tarkastad, 1946 (the pin). Qonce (King William's Town) is where he grew up. Sources: [wikipedia.org](https://en.wikipedia.org/wiki/Steve_Biko), [repository.hsrc.ac.za](https://repository.hsrc.ac.za/handle/20.500.11910/19954) |
| [Sylvius Leopold Weiss](https://www.wikidata.org/wiki/Q379571) | 1686–1750 | Wikidata has 2 birth years (1686, 1687); Wikidata has 2 birthplaces (Wrocław; Grodków) |
| [Tenzing Norgay](https://www.wikidata.org/wiki/Q80732) | 1914–1986 | Wikidata has 2 birthplaces (Ü-Tsang; Tengboche) — ❔ **Still uncertain (Oct 2026), panel says so:** Still disputed (Tibet or Khumbu). The panel now says so. Sources: [wikipedia.org](https://en.wikipedia.org/wiki/Tenzing_Norgay) |
| [Theodosius I](https://www.wikidata.org/wiki/Q46696) | 347–395 | Wikidata has 2 birthplaces (Coca; Italica) |
| [Theresa Kunegunda Sobieska](https://www.wikidata.org/wiki/Q241313) | 1676–1730 | Wikidata has 2 birthplaces (Kraków; Warsaw) |
| [Tomás de Torquemada](https://www.wikidata.org/wiki/Q210735) | 1420–1498 | Wikidata has 2 birthplaces (Valladolid; Torquemada) |
| [Tove Jansson](https://www.wikidata.org/wiki/Q102071) | 1914–2001 | Wikidata has 2 birthplaces (Helsinki; Helsingborg) — ✅ **Resolved (Oct 2026):** Helsinki, 1914 (the pin). Wikidata's Helsingborg is wrong. Sources: [wikipedia.org](https://en.wikipedia.org/wiki/Tove_Jansson), [britannica.com](https://www.britannica.com/biography/Tove-Jansson) |
| [Vasubandhu](https://www.wikidata.org/wiki/Q316343) | 300–399 | Wikidata has 3 birthplaces (Gupta Empire; Gandhara; Peshawar) |
| [Victor Vasarely](https://www.wikidata.org/wiki/Q154448) | 1906–1997 | Wikidata has 2 birthplaces (Hungary; Pécs) |
| [Víctor Jara](https://www.wikidata.org/wiki/Q125133) | 1932–1973 | Wikidata has 2 birthplaces (San Ignacio; Lonquén) |
| [Walter Heitler](https://www.wikidata.org/wiki/Q60287) | 1904–1981 | Wikidata has 2 birthplaces (Karlsruhe; Karlstadt am Main) |
| [William McGonagall](https://www.wikidata.org/wiki/Q981978) | 1825–1902 | Wikidata has 2 birthplaces (Edinburgh; County Donegal) |
| [Yma Sumac](https://www.wikidata.org/wiki/Q239030) | 1922–2008 | Wikidata has 2 birthplaces (Callao; Ichocán District) |
| [İbn Tanrıverdi](https://www.wikidata.org/wiki/Q481499) | 1410–1470 | Wikidata has 2 birth years (1410, 1411); Wikidata has 2 birthplaces (Cairo; Amasya) |

### Several birth or death years on Wikidata (452)

| Person | On the globe | What disagrees |
|---|---|---|
| [Abbas I of Egypt](https://www.wikidata.org/wiki/Q305882) | 1812–1854 | Wikidata has 2 birth years (1812, 1813) |
| [Abbas III](https://www.wikidata.org/wiki/Q281336) | 1732–1740 | Wikidata has 2 birth years (1732, 1731) |
| [Abdul-Qādir Bēdil](https://www.wikidata.org/wiki/Q2355593) | 1644–1720 | Wikidata has 2 death years (1721, 1720) |
| [Abdur Rahman Khan](https://www.wikidata.org/wiki/Q31649) | 1840–1901 | Wikidata has 2 birth years (1840, 1844) |
| [Abdurrauf Fitrat](https://www.wikidata.org/wiki/Q317907) | 1885–1938 | Wikidata has 2 birth years (1885, 1886) |
| [Abraham Abulafia](https://www.wikidata.org/wiki/Q323448) | 1240–1291 | Wikidata has 2 death years (1292, 1291) |
| [Abraham Brueghel](https://www.wikidata.org/wiki/Q1824525) | 1631–1690 | Wikidata has 2 death years (1697, 1690) |
| [Abram Ioffe](https://www.wikidata.org/wiki/Q331067) | 1880–1960 | Wikidata has 2 birth years (1880, 1881) |
| [Abu Abdullah Muhammad al-Idrisi al-Qurtubi al-Hasani as-Sabti](https://www.wikidata.org/wiki/Q173441) | 1110–1165 | Wikidata has 2 death years (1166, 1165) |
| [Abu Bakr bin Yahya al-Suli](https://www.wikidata.org/wiki/Q225496) | 854–946 | Wikidata has 2 birth years (854, 880) |
| [Abu Nuwas](https://www.wikidata.org/wiki/Q5670) | 756–814 | Wikidata has 2 birth years (762, 756) |
| [Abu Yaqub Yusuf I](https://www.wikidata.org/wiki/Q335489) | 1138–1184 | Wikidata has 2 birth years (1138, 1139) |
| [Abu al-Faraj ibn al-Jawzi](https://www.wikidata.org/wiki/Q731866) | 1116–1201 | Wikidata has 2 birth years (1116, 1126) |
| [Abu al-Ghazi Bahadur](https://www.wikidata.org/wiki/Q336146) | 1603–1664 | Wikidata has 2 death years (1663, 1664) |
| [Abu al-Qasim al-Zahrawi](https://www.wikidata.org/wiki/Q311495) | 936–1010 | Wikidata has 3 death years (1036, 1013, 1010) |
| [Abul-Fazl Bayhaqi](https://www.wikidata.org/wiki/Q2620460) | 995–1077 | Wikidata has 2 birth years (995, 996) |
| [Adrian Willaert](https://www.wikidata.org/wiki/Q312615) | 1480–1562 | Wikidata has 2 birth years (1480, 1490) |
| [Aelius Aristides](https://www.wikidata.org/wiki/Q354431) | 117–185 | Wikidata has 2 death years (185, 189) |
| [Aelred of Rievaulx](https://www.wikidata.org/wiki/Q380845) | 1110–1166 | Wikidata has 2 death years (1167, 1166) |
| [Agathias](https://www.wikidata.org/wiki/Q233136) | 530–580 | Wikidata has 2 birth years (536, 530); Wikidata has 2 death years (580, 582) |
| [Agniya Barto](https://www.wikidata.org/wiki/Q683485) | 1901–1981 | Wikidata has 2 birth years (1901, 1906) |
| [Agrippa II](https://www.wikidata.org/wiki/Q313419) | 27–100 | Wikidata has 2 birth years (27, 28) |
| [Ahmad Qavam](https://www.wikidata.org/wiki/Q400712) | 1876–1955 | Wikidata has 2 birth years (1876, 1875) |
| [Ahmad Sanjar](https://www.wikidata.org/wiki/Q337506) | 1084–1157 | Wikidata has 2 birth years (1086, 1084) |
| [Al-Amir bi-Ahkam Allah](https://www.wikidata.org/wiki/Q285678) | 1096–1130 | Wikidata has 2 birth years (1096, 1097) |
| [Al-Ghazali](https://www.wikidata.org/wiki/Q9546) | 1058–1111 | Wikidata has 2 birth years (1058, 1056) |
| [Al-Jahiz](https://www.wikidata.org/wiki/Q293497) | 775–868 | Wikidata has 2 death years (869, 868) |
| [Al-Mu'tamid](https://www.wikidata.org/wiki/Q284721) | 843–892 | Wikidata has 2 birth years (845, 843) |
| [Al-Mundhir of Córdoba](https://www.wikidata.org/wiki/Q284775) | 842–888 | Wikidata has 2 birth years (842, 843) |
| [Al-Musta'in](https://www.wikidata.org/wiki/Q284157) | 834–866 | Wikidata has 2 birth years (836, 834) |
| [Al-Mustakfi](https://www.wikidata.org/wiki/Q293640) | 904–949 | Wikidata has 2 birth years (908, 904) |
| [Al-Muti](https://www.wikidata.org/wiki/Q284730) | 913–974 | Wikidata has 2 birth years (914, 913) |
| [Al-Qa'im Bi-Amrillah](https://www.wikidata.org/wiki/Q293549) | 891–946 | Wikidata has 2 birth years (893, 891) |
| [Al-Wathiq](https://www.wikidata.org/wiki/Q284585) | 812–847 | Wikidata has 2 birth years (812, 815) |
| [Alain of Lille](https://www.wikidata.org/wiki/Q4313) | 1114–1203 | Wikidata has 3 birth years (1115, 1117, 1114) |
| [Alexander of Hales](https://www.wikidata.org/wiki/Q457968) | 1175–1245 | Wikidata has 2 birth years (1185, 1175) |
| [Alexandros Koumoundouros](https://www.wikidata.org/wiki/Q708318) | 1815–1883 | Wikidata has 2 birth years (1817, 1815) |
| [Ali ibn Ridwan](https://www.wikidata.org/wiki/Q287492) | 988–1061 | Wikidata has 2 birth years (988, 998) |
| [Alois Brunner](https://www.wikidata.org/wiki/Q84335) | 1912–2001 | Wikidata has 2 death years (2010, 2001) |
| [Amadou Hampâté Bâ](https://www.wikidata.org/wiki/Q452299) | 1899–1991 | Wikidata has 2 birth years (1900, 1899) |
| [Andrea del Castagno](https://www.wikidata.org/wiki/Q240737) | 1419–1457 | Wikidata has 2 birth years (1420, 1419) |
| [André Kolingba](https://www.wikidata.org/wiki/Q310883) | 1936–2010 | Wikidata has 2 birth years (1936, 1935) |
| [Anita Loos](https://www.wikidata.org/wiki/Q272088) | 1888–1981 | Wikidata has 2 birth years (1889, 1888) |
| [Anna Komnene](https://www.wikidata.org/wiki/Q179284) | 1083–1153 | Wikidata has 2 death years (1153, 1154) |
| [Anna Kuliscioff](https://www.wikidata.org/wiki/Q446151) | 1854–1925 | Wikidata has 2 birth years (1854, 1857) |
| [Anna May Wong](https://www.wikidata.org/wiki/Q232376) | 1904–1961 | Wikidata has 2 birth years (1904, 1905) |
| [Anton Wilhelm Amo](https://www.wikidata.org/wiki/Q595486) | 1700–1759 | Wikidata has 2 birth years (1703, 1700) |
| [Antonio del Pollaiuolo](https://www.wikidata.org/wiki/Q318640) | 1429–1498 | Wikidata has 2 birth years (1433, 1429) |
| [Antonis Mor](https://www.wikidata.org/wiki/Q176694) | 1517–1575 | Wikidata has 2 birth years (1517, 1519) |
| [António Vieira](https://www.wikidata.org/wiki/Q458650) | 1607–1696 | Wikidata has 2 birth years (1607, 1608); Wikidata has 2 death years (1696, 1697) |
| [Apuleius](https://www.wikidata.org/wiki/Q170512) | 125–170 | Wikidata has 2 birth years (200, 125) |
| [Ar-Radi](https://www.wikidata.org/wiki/Q293442) | 909–940 | Wikidata has 2 birth years (909, 910) |
| [Ardashir I](https://www.wikidata.org/wiki/Q371319) | 180–241 | Wikidata has 2 death years (241, 242) |
| [Arrian](https://www.wikidata.org/wiki/Q31845) | 89–175 | Wikidata has 2 birth years (89, 95); Wikidata has 2 death years (180, 175) |
| [Artur da Costa e Silva](https://www.wikidata.org/wiki/Q312361) | 1899–1969 | Wikidata has 2 birth years (1899, 1902) |
| [Asanga](https://www.wikidata.org/wiki/Q379905) | 300–301 | Wikidata has 2 birth years (300, 310) |
| [At-Ta'i](https://www.wikidata.org/wiki/Q284779) | 929–1003 | Wikidata has 2 birth years (932, 929) |
| [Augustine of Canterbury](https://www.wikidata.org/wiki/Q32520) | 534–605 | Wikidata has 2 birth years (550, 534) |
| [Az-Zahir](https://www.wikidata.org/wiki/Q293450) | 1175–1226 | Wikidata has 2 birth years (1176, 1175) |
| [B. Traven](https://www.wikidata.org/wiki/Q55072099) | 1890–1969 | Wikidata has 2 birth years (1882, 1890) |
| [Baha' al-Din Naqshband](https://www.wikidata.org/wiki/Q32075) | 1318–1389 | Wikidata has 2 death years (1391, 1389) |
| [Baiju](https://www.wikidata.org/wiki/Q561440) | 1201–1259 | Wikidata has 2 death years (1259, 1260) |
| [Baldassarre Longhena](https://www.wikidata.org/wiki/Q316297) | 1596–1682 | Wikidata has 2 birth years (1596, 1598) |
| [Baldwin II of Jerusalem](https://www.wikidata.org/wiki/Q51718) | 1060–1131 | Wikidata has 2 birth years (1075, 1060) |
| [Baltasar Gracián](https://www.wikidata.org/wiki/Q360512) | 1604–1658 | Wikidata has 2 birth years (1604, 1601) |
| [Benito Jerónimo Feijoo](https://www.wikidata.org/wiki/Q379753) | 1677–1764 | Wikidata has 2 birth years (1677, 1676) |
| [Bernard van Orley](https://www.wikidata.org/wiki/Q454678) | 1488–1541 | Wikidata has 2 death years (1541, 1542) |
| [Bernardino de Sahagún](https://www.wikidata.org/wiki/Q379972) | 1499–1590 | Wikidata has 2 birth years (1499, 1500) |
| [Big Bill Broonzy](https://www.wikidata.org/wiki/Q449239) | 1893–1958 | Wikidata has 2 birth years (1893, 1903) |
| [Bodhidharma](https://www.wikidata.org/wiki/Q187172) | 440–540 | Wikidata has 2 birth years (483, 440) |
| [Boleslaus II, Duke of Bohemia](https://www.wikidata.org/wiki/Q456174) | 928–999 | Wikidata has 2 birth years (927, 928) |
| [Bretislaus I](https://www.wikidata.org/wiki/Q355013) | 1000–1055 | Wikidata has 3 birth years (1000, 1005, 1002) |
| [Cai Lun](https://www.wikidata.org/wiki/Q229235) | 48–121 | Wikidata has 2 birth years (48, 50) |
| [Carlo Rossi](https://www.wikidata.org/wiki/Q619584) | 1775–1849 | Wikidata has 2 birth years (1777, 1775) |
| [Carlos Antonio López](https://www.wikidata.org/wiki/Q235648) | 1792–1862 | Wikidata has 2 birth years (1792, 1790) |
| [Carus](https://www.wikidata.org/wiki/Q187004) | 222–283 | Wikidata has 2 birth years (224, 222) |
| [Catarina van Hemessen](https://www.wikidata.org/wiki/Q269445) | 1527–1567 | Wikidata has 2 birth years (1527, 1528); Wikidata has 2 death years (1600, 1567) |
| [Charlemagne](https://www.wikidata.org/wiki/Q3044) | 742–814 | Wikidata has 2 birth years (742, 748) — ❔ **Still uncertain (Oct 2026), panel says so:** Still uncertain (742, 747 or 748). The panel now says so. Sources: [wikipedia.org](https://en.wikipedia.org/wiki/Charlemagne) |
| [Charles the Fat](https://www.wikidata.org/wiki/Q150712) | 832–888 | Wikidata has 2 birth years (839, 832) |
| [Chuck Close](https://www.wikidata.org/wiki/Q453883) | 1940–2021 | Wikidata has 2 birth years (1941, 1940) |
| [Chögyam Trungpa](https://www.wikidata.org/wiki/Q548323) | 1939–1987 | Wikidata has 2 birth years (1940, 1939) |
| [Claude Henri de Rouvroy, comte de Saint-Simon](https://www.wikidata.org/wiki/Q82934) | 1760–1825 | Wikidata has 2 death years (1825, 1826) |
| [Clive Bell](https://www.wikidata.org/wiki/Q684978) | 1881–1962 | Wikidata has 2 death years (1964, 1962) |
| [Coluccio Salutati](https://www.wikidata.org/wiki/Q93113) | 1331–1406 | Wikidata has 2 birth years (1332, 1331) |
| [Conrad Malte-Brun](https://www.wikidata.org/wiki/Q980235) | 1775–1826 | Wikidata has 2 birth years (1755, 1775) |
| [Constans](https://www.wikidata.org/wiki/Q185538) | 320–350 | Wikidata has 2 birth years (320, 323) |
| [Corinne Griffith](https://www.wikidata.org/wiki/Q272079) | 1894–1979 | Wikidata has 2 birth years (1894, 1896) |
| [Count of St. Germain](https://www.wikidata.org/wiki/Q158208) | 1691–1784 | Wikidata has 4 birth years (1696, 1712, 1691, 1701) |
| [Damon Runyon](https://www.wikidata.org/wiki/Q714880) | 1884–1946 | Wikidata has 2 birth years (1880, 1884) |
| [Desmond Dekker](https://www.wikidata.org/wiki/Q333598) | 1941–2006 | Wikidata has 2 birth years (1942, 1941) |
| [Dhu'l-Nun al-Misri](https://www.wikidata.org/wiki/Q981803) | 796–859 | Wikidata has 3 death years (859, 861, 860) |
| [Dieric Bouts](https://www.wikidata.org/wiki/Q313561) | 1410–1475 | Wikidata has 2 birth years (1415, 1410) |
| [Dimitrie Cantemir](https://www.wikidata.org/wiki/Q159933) | 1673–1723 | Wikidata has 2 birth years (1673, 1674) |
| [Domenico Beccafumi](https://www.wikidata.org/wiki/Q455712) | 1484–1551 | Wikidata has 2 birth years (1486, 1484) |
| [Dong Zhuo](https://www.wikidata.org/wiki/Q334081) | 132–192 | Wikidata has 4 birth years (134, 139, 138, 132) |
| [Dulce María Loynaz](https://www.wikidata.org/wiki/Q447059) | 1902–1997 | Wikidata has 2 birth years (1902, 1903) |
| [Dámaso Alonso](https://www.wikidata.org/wiki/Q312945) | 1899–1990 | Wikidata has 2 birth years (1899, 1898) |
| [Edgar of England](https://www.wikidata.org/wiki/Q192925) | 943–975 | Wikidata has 2 birth years (943, 944) |
| [Edmund II of England](https://www.wikidata.org/wiki/Q188684) | 980–1016 | Wikidata has 2 birth years (988, 980) |
| [Edward Coke](https://www.wikidata.org/wiki/Q332435) | 1549–1634 | Wikidata has 2 birth years (1552, 1549) |
| [Edward Granville Browne](https://www.wikidata.org/wiki/Q982047) | 1861–1926 | Wikidata has 2 birth years (1862, 1861) |
| [Egill Skallagrímsson](https://www.wikidata.org/wiki/Q314454) | 910–983 | Wikidata has 2 death years (983, 990) |
| [Eileen Chang](https://www.wikidata.org/wiki/Q197155) | 1920–1995 | Wikidata has 2 birth years (1920, 1921) |
| [Eileen Gray](https://www.wikidata.org/wiki/Q438129) | 1878–1976 | Wikidata has 2 birth years (1879, 1878) |
| [Eleanor of Provence](https://www.wikidata.org/wiki/Q228885) | 1222–1291 | Wikidata has 2 birth years (1222, 1223) |
| [Elena Ceaușescu](https://www.wikidata.org/wiki/Q229162) | 1919–1989 | Wikidata has 2 birth years (1919, 1916) |
| [Elias Howe](https://www.wikidata.org/wiki/Q360359) | 1819–1866 | Wikidata has 2 death years (1866, 1867) |
| [Emilio Portes Gil](https://www.wikidata.org/wiki/Q380982) | 1890–1978 | Wikidata has 2 birth years (1890, 1891) |
| [Empress Gi](https://www.wikidata.org/wiki/Q491079) | 1315–1369 | Wikidata has 2 death years (1369, 1370) |
| [Epictetus](https://www.wikidata.org/wiki/Q183144) | 50–125 | Wikidata has 2 death years (125, 138) |
| [Eric III of Denmark](https://www.wikidata.org/wiki/Q365064) | 1100–1146 | Wikidata has 2 death years (1146, 1147) |
| [Eutychius of Constantinople](https://www.wikidata.org/wiki/Q1266046) | 550–582 | Wikidata has 2 birth years (550, 512) |
| [Eva Gonzalès](https://www.wikidata.org/wiki/Q464300) | 1847–1883 | Wikidata has 2 birth years (1847, 1849) |
| [Evagrius Scholasticus](https://www.wikidata.org/wiki/Q365678) | 536–594 | Wikidata has 2 birth years (537, 536); Wikidata has 2 death years (594, 600) |
| [Fahd bin Abdulaziz Al Saud](https://www.wikidata.org/wiki/Q183187) | 1920–2005 | Wikidata has 3 birth years (1923, 1920, 1921) |
| [Farrukhsiyar](https://www.wikidata.org/wiki/Q559490) | 1683–1719 | Wikidata has 2 birth years (1683, 1685) |
| [Faxian](https://www.wikidata.org/wiki/Q312978) | 337–422 | Wikidata has 2 birth years (340, 337) |
| [Federico Zuccari](https://www.wikidata.org/wiki/Q345605) | 1539–1609 | Wikidata has 2 birth years (1539, 1541) |
| [Feng Menglong](https://www.wikidata.org/wiki/Q371966) | 1574–1645 | Wikidata has 2 death years (1646, 1645) |
| [Ferdinand II of Naples](https://www.wikidata.org/wiki/Q708932) | 1469–1496 | Wikidata has 2 birth years (1467, 1469) |
| [Flavio Biondo](https://www.wikidata.org/wiki/Q434834) | 1388–1463 | Wikidata has 2 birth years (1392, 1388) |
| [Floris I, Count of Holland](https://www.wikidata.org/wiki/Q469671) | 1025–1061 | Wikidata has 2 birth years (1020, 1025) |
| [Fouad Chehab](https://www.wikidata.org/wiki/Q449407) | 1902–1973 | Wikidata has 2 birth years (1902, 1903) |
| [Francesca Caccini](https://www.wikidata.org/wiki/Q232035) | 1587–1641 | Wikidata has 2 death years (1641, 1640) |
| [Francesco Primaticcio](https://www.wikidata.org/wiki/Q333366) | 1504–1560 | Wikidata has 2 death years (1560, 1570) |
| [Francisco Solano López](https://www.wikidata.org/wiki/Q37677) | 1826–1870 | Wikidata has 2 birth years (1826, 1827) |
| [Frank Vincent](https://www.wikidata.org/wiki/Q463407) | 1937–2017 | Wikidata has 2 birth years (1937, 1939) |
| [Frederick III the Simple](https://www.wikidata.org/wiki/Q468672) | 1341–1377 | Wikidata has 2 birth years (1341, 1342) |
| [Friedrich Ludwig Jahn](https://www.wikidata.org/wiki/Q77098) | 1778–1853 | Wikidata has 2 death years (1852, 1853) |
| [Friedrich Parrot](https://www.wikidata.org/wiki/Q707716) | 1791–1841 | Wikidata has 2 birth years (1791, 1792) |
| [Fuad I of Egypt](https://www.wikidata.org/wiki/Q311839) | 1868–1936 | Wikidata has 2 birth years (1868, 1869) |
| [Félix de Azara](https://www.wikidata.org/wiki/Q471014) | 1742–1821 | Wikidata has 2 birth years (1742, 1746) |
| [Gaafar Nimeiry](https://www.wikidata.org/wiki/Q311798) | 1931–2009 | Wikidata has 2 birth years (1931, 1930) |
| [Gabrielle-Suzanne de Villeneuve](https://www.wikidata.org/wiki/Q469944) | 1695–1755 | Wikidata has 2 birth years (1695, 1685) |
| [Galeazzo II Visconti](https://www.wikidata.org/wiki/Q453300) | 1320–1377 | Wikidata has 2 death years (1378, 1377) |
| [García Fernández of Castile](https://www.wikidata.org/wiki/Q439138) | 938–990 | Wikidata has 2 death years (995, 990) |
| [Geertgen tot Sint Jans](https://www.wikidata.org/wiki/Q360888) | 1460–1490 | Wikidata has 2 birth years (1460, 1466); Wikidata has 2 death years (1495, 1490) |
| [George Cruikshank](https://www.wikidata.org/wiki/Q360466) | 1792–1873 | Wikidata has 2 death years (1878, 1873) |
| [George Gurdjieff](https://www.wikidata.org/wiki/Q217771) | 1866–1949 | Wikidata has 2 birth years (1866, 1872) |
| [George Sphrantzes](https://www.wikidata.org/wiki/Q433647) | 1401–1477 | Wikidata has 2 death years (1477, 1478) |
| [George Vancouver](https://www.wikidata.org/wiki/Q205485) | 1750–1798 | Wikidata has 2 birth years (1757, 1750) |
| [Gerard of Csanád](https://www.wikidata.org/wiki/Q117759) | 977–1046 | Wikidata has 2 birth years (977, 980) |
| [Germanus I of Constantinople](https://www.wikidata.org/wiki/Q441464) | 634–732 | Wikidata has 2 birth years (634, 650) |
| [Gertrude the Great](https://www.wikidata.org/wiki/Q61934) | 1256–1301 | Wikidata has 2 death years (1301, 1302) |
| [Gheorghe Tătărescu](https://www.wikidata.org/wiki/Q1842040) | 1892–1957 | Wikidata has 2 birth years (1886, 1892) |
| [Giotto](https://www.wikidata.org/wiki/Q7814) | 1266–1337 | Wikidata has 2 birth years (1267, 1276) |
| [Giovanni Baglione](https://www.wikidata.org/wiki/Q983332) | 1566–1643 | Wikidata has 2 death years (1643, 1644) |
| [Giovanni Battista Moroni](https://www.wikidata.org/wiki/Q504949) | 1520–1578 | Wikidata has 3 birth years (1522, 1525, 1520) |
| [Giovanni Pisano](https://www.wikidata.org/wiki/Q314932) | 1248–1315 | Wikidata has 2 death years (1318, 1315) |
| [Girolamo Cassar](https://www.wikidata.org/wiki/Q907536) | 1520–1586 | Wikidata has 2 death years (1586, 1592) |
| [Gita Mehta](https://www.wikidata.org/wiki/Q538719) | 1942–2023 | Wikidata has 2 birth years (1942, 1943) |
| [Giuseppe Parini](https://www.wikidata.org/wiki/Q529146) | 1729–1779 | Wikidata has 2 death years (1779, 1799) |
| [Glauber Rocha](https://www.wikidata.org/wiki/Q55426) | 1938–1981 | Wikidata has 2 birth years (1938, 1939) |
| [Gregorio Conrado Álvarez](https://www.wikidata.org/wiki/Q365334) | 1925–2016 | Wikidata has 2 birth years (1925, 1926) |
| [Gregory of Nazianzus](https://www.wikidata.org/wiki/Q44011) | 329–389 | Wikidata has 2 birth years (330, 329); Wikidata has 2 death years (390, 389) |
| [Guido Cavalcanti](https://www.wikidata.org/wiki/Q316876) | 1255–1300 | Wikidata has 2 birth years (1258, 1255) |
| [Guillaume Le Vasseur de Beauplan](https://www.wikidata.org/wiki/Q1285841) | 1595–1673 | Wikidata has 2 birth years (1600, 1595); Wikidata has 2 death years (1675, 1673) |
| [Gulbadan Begum](https://www.wikidata.org/wiki/Q2041521) | 1523–1603 | Wikidata has 2 birth years (1523, 1524) |
| [Guntram](https://www.wikidata.org/wiki/Q295086) | 532–592 | Wikidata has 2 death years (593, 592) |
| [Guo Xi](https://www.wikidata.org/wiki/Q536645) | 1020–1085 | Wikidata has 2 birth years (1020, 1023); Wikidata has 2 death years (1085, 1090) |
| [Haakon the Good](https://www.wikidata.org/wiki/Q314477) | 918–961 | Wikidata has 2 birth years (918, 920) |
| [Hakuin Ekaku](https://www.wikidata.org/wiki/Q177059) | 1685–1768 | Wikidata has 2 death years (1768, 1769) |
| [Han Suyin](https://www.wikidata.org/wiki/Q16400) | 1916–2012 | Wikidata has 2 birth years (1917, 1916) |
| [Hans Baldung Grien](https://www.wikidata.org/wiki/Q164696) | 1480–1545 | Wikidata has 2 birth years (1480, 1484) |
| [Hans Jakob Christoffel von Grimmelshausen](https://www.wikidata.org/wiki/Q31220) | 1622–1676 | Wikidata has 2 birth years (1622, 1625) |
| [Hans-Adam I, Prince of Liechtenstein](https://www.wikidata.org/wiki/Q581481) | 1657–1712 | Wikidata has 2 birth years (1656, 1657) |
| [Harald Bluetooth](https://www.wikidata.org/wiki/Q201041) | 911–985 | Wikidata has 2 death years (986, 985) |
| [Harry Harrison](https://www.wikidata.org/wiki/Q489193) | 1924–2012 | Wikidata has 2 birth years (1924, 1925) |
| [Hasdai Crescas](https://www.wikidata.org/wiki/Q528415) | 1340–1410 | Wikidata has 2 death years (1412, 1410) |
| [Hegesippus](https://www.wikidata.org/wiki/Q503230) | 110–180 | Wikidata has 2 birth years (110, 107) |
| [Henry II of Jerusalem](https://www.wikidata.org/wiki/Q546497) | 1270–1324 | Wikidata has 2 birth years (1270, 1271) |
| [Henry II the Pious](https://www.wikidata.org/wiki/Q53446) | 1191–1241 | Wikidata has 3 birth years (1191, 1192, 1196) |
| [Henry III](https://www.wikidata.org/wiki/Q61258) | 1215–1288 | Wikidata has 2 birth years (1215, 1218) |
| [Herodes Atticus](https://www.wikidata.org/wiki/Q311879) | 101–177 | Wikidata has 2 birth years (101, 102) |
| [Horia Sima](https://www.wikidata.org/wiki/Q442004) | 1903–1993 | Wikidata has 2 birth years (1903, 1906) |
| [Hubert Maga](https://www.wikidata.org/wiki/Q336242) | 1916–2000 | Wikidata has 2 death years (2002, 2000) |
| [Hürrem Sultan](https://www.wikidata.org/wiki/Q255809) | 1505–1558 | Wikidata has 2 birth years (1505, 1507); Wikidata has 2 death years (1561, 1558) |
| [Ibn Hawqal](https://www.wikidata.org/wiki/Q367330) | 943–977 | Wikidata has 2 death years (977, 978) |
| [Ibn Kathir](https://www.wikidata.org/wiki/Q369690) | 1301–1373 | Wikidata has 2 birth years (1301, 1302) |
| [Ibn Zuhr](https://www.wikidata.org/wiki/Q470914) | 1073–1162 | Wikidata has 3 birth years (1091, 1073, 1092) |
| [Ibn al-Nafis](https://www.wikidata.org/wiki/Q319146) | 1210–1280 | Wikidata has 2 birth years (1215, 1210); Wikidata has 2 death years (1280, 1288) |
| [Ibn al-Rawandi](https://www.wikidata.org/wiki/Q1399609) | 815–860 | Wikidata has 2 birth years (827, 815); Wikidata has 2 death years (911, 860) |
| [Idris I of Libya](https://www.wikidata.org/wiki/Q116430) | 1889–1983 | Wikidata has 2 birth years (1889, 1890) |
| [Ioannis Kolettis](https://www.wikidata.org/wiki/Q717119) | 1773–1847 | Wikidata has 3 birth years (1788, 1773, 1774) |
| [Ion Creangă](https://www.wikidata.org/wiki/Q204810) | 1837–1889 | Wikidata has 2 birth years (1837, 1839) |
| [Isabella I, Queen of Armenia](https://www.wikidata.org/wiki/Q4924) | 1212–1252 | Wikidata has 4 birth years (1217, 1216, 1213, 1212) |
| [Isidore of Kyiv](https://www.wikidata.org/wiki/Q707663) | 1380–1463 | Wikidata has 3 birth years (1380, 1385, 1390) |
| [Ismail Haniyeh](https://www.wikidata.org/wiki/Q152378) | 1962–2024 | Wikidata has 2 birth years (1962, 1963) |
| [Ismail al-Azhari](https://www.wikidata.org/wiki/Q255545) | 1900–1969 | Wikidata has 2 birth years (1901, 1900) |
| [Ismat Chughtai](https://www.wikidata.org/wiki/Q3080325) | 1925–1991 | Wikidata has 3 birth years (1911, 1915, 1925); Wikidata has 2 death years (1992, 1991) |
| [Ivan I of Moscow](https://www.wikidata.org/wiki/Q185316) | 1288–1340 | Wikidata has 2 birth years (1288, 1304); Wikidata has 2 death years (1341, 1340) |
| [Jack Haley](https://www.wikidata.org/wiki/Q927057) | 1898–1979 | Wikidata has 2 birth years (1897, 1898) |
| [Jacob Bernoulli](https://www.wikidata.org/wiki/Q122392) | 1654–1705 | Wikidata has 2 birth years (1654, 1655) |
| [Jacob L. Moreno](https://www.wikidata.org/wiki/Q89404) | 1889–1974 | Wikidata has 2 birth years (1889, 1892) |
| [Jacopone da Todi](https://www.wikidata.org/wiki/Q317267) | 1230–1307 | Wikidata has 2 birth years (1236, 1230) |
| [Jacques de Vitry](https://www.wikidata.org/wiki/Q654608) | 1160–1240 | Wikidata has 2 birth years (1170, 1160) |
| [Jamal al-Din al-Afghani](https://www.wikidata.org/wiki/Q298434) | 1838–1897 | Wikidata has 2 birth years (1838, 1839) |
| [Jan Asselijn](https://www.wikidata.org/wiki/Q541976) | 1600–1652 | Wikidata has 2 birth years (1600, 1610) |
| [Jan Fyt](https://www.wikidata.org/wiki/Q624802) | 1609–1661 | Wikidata has 2 birth years (1609, 1611) |
| [Jaufré Rudel](https://www.wikidata.org/wiki/Q5260) | 1000–? | Wikidata has 2 birth years (1113, 1000); Wikidata has 2 death years (1181, 1148) |
| [Jayavarman VII](https://www.wikidata.org/wiki/Q335273) | 1122–1218 | Wikidata has 3 birth years (1128, 1122, 1125); Wikidata has 2 death years (1218, 1219) |
| [Jean Fouquet](https://www.wikidata.org/wiki/Q311398) | 1410–1478 | Wikidata has 3 birth years (1410, 1425, 1420) |
| [Jean Gerson](https://www.wikidata.org/wiki/Q281179) | 1363–1429 | Wikidata has 2 birth years (1363, 1369) |
| [Jean Nicot](https://www.wikidata.org/wiki/Q318368) | 1530–1604 | Wikidata has 2 death years (1605, 1604) |
| [Jean-Baptiste Boussingault](https://www.wikidata.org/wiki/Q503318) | 1801–1887 | Wikidata has 2 birth years (1801, 1802) |
| [Jean-Joseph Rabéarivelo](https://www.wikidata.org/wiki/Q671601) | 1903–1937 | Wikidata has 2 birth years (1901, 1903) |
| [Jeanette Jerome](https://www.wikidata.org/wiki/Q243011) | 1851–1921 | Wikidata has 2 birth years (1854, 1851) |
| [Jeremiah Clarke](https://www.wikidata.org/wiki/Q440020) | 1674–1707 | Wikidata has 2 birth years (1674, 1670) |
| [Jigme Wangchuck](https://www.wikidata.org/wiki/Q318177) | 1905–1952 | Wikidata has 2 birth years (1905, 1906) |
| [Jimmy Smith](https://www.wikidata.org/wiki/Q318948) | 1925–2005 | Wikidata has 2 birth years (1928, 1925) |
| [Joachim Patinir](https://www.wikidata.org/wiki/Q442491) | 1475–1524 | Wikidata has 3 birth years (1475, 1480, 1485) |
| [Joachim of Fiore](https://www.wikidata.org/wiki/Q199991) | 1130–1202 | Wikidata has 2 birth years (1135, 1130) |
| [Joan Maragall](https://www.wikidata.org/wiki/Q562402) | 1860–1910 | Wikidata has 2 death years (1910, 1911) |
| [Joan of Kent](https://www.wikidata.org/wiki/Q234156) | 1327–1385 | Wikidata has 2 birth years (1328, 1327) |
| [Joanot Martorell](https://www.wikidata.org/wiki/Q363836) | 1413–1465 | Wikidata has 2 birth years (1410, 1413) |
| [Jobst of Moravia](https://www.wikidata.org/wiki/Q158181) | 1351–1411 | Wikidata has 2 birth years (1354, 1351) |
| [Johann Hermann Schein](https://www.wikidata.org/wiki/Q57827) | 1586–1630 | Wikidata has 2 birth years (1586, 1986) |
| [John Argyropoulos](https://www.wikidata.org/wiki/Q26648) | 1415–1480 | Wikidata has 2 birth years (1415, 1416); Wikidata has 3 death years (1480, 1486, 1487) |
| [John Cromwell](https://www.wikidata.org/wiki/Q1348309) | 1886–1979 | Wikidata has 2 birth years (1887, 1886) |
| [John II Komnenos](https://www.wikidata.org/wiki/Q41628) | 1087–1143 | Wikidata has 2 birth years (1087, 1088) |
| [John XXI](https://www.wikidata.org/wiki/Q172916) | 1210–1277 | Wikidata has 2 birth years (1215, 1210) |
| [Joos van Cleve](https://www.wikidata.org/wiki/Q153472) | 1475–1540 | Wikidata has 2 birth years (1475, 1485) |
| [Joseph Paxton](https://www.wikidata.org/wiki/Q318372) | 1803–1865 | Wikidata has 2 birth years (1804, 1803) |
| [Joseph Süß Oppenheimer](https://www.wikidata.org/wiki/Q60535) | 1692–1738 | Wikidata has 2 birth years (1692, 1698) |
| [Joseph Whitworth](https://www.wikidata.org/wiki/Q712307) | 1804–1887 | Wikidata has 2 birth years (1804, 1803) |
| [Josquin des Prez](https://www.wikidata.org/wiki/Q143100) | 1440–1521 | Wikidata has 2 birth years (1455, 1440) |
| [José Carlos Mariátegui](https://www.wikidata.org/wiki/Q335544) | 1894–1930 | Wikidata has 2 birth years (1894, 1895) |
| [José Martínez Ruiz](https://www.wikidata.org/wiki/Q443403) | 1873–1967 | Wikidata has 2 birth years (1874, 1873) |
| [José Vasconcelos](https://www.wikidata.org/wiki/Q1091141) | 1881–1959 | Wikidata has 2 birth years (1881, 1882) |
| [Juan José Arévalo](https://www.wikidata.org/wiki/Q881158) | 1904–1990 | Wikidata has 2 birth years (1904, 1905) |
| [Juan Sebastián Elcano](https://www.wikidata.org/wiki/Q201510) | 1486–1526 | Wikidata has 2 birth years (1486, 1487) |
| [Judah Leon Abravanel](https://www.wikidata.org/wiki/Q467062) | 1460–1521 | Wikidata has 2 death years (1521, 1530) |
| [Julian of Norwich](https://www.wikidata.org/wiki/Q236699) | 1342–? | Wikidata has 2 birth years (1342, 1343); death year none vs Wikidata 1500 (known only roughly) |
| [Julius Firmicus Maternus](https://www.wikidata.org/wiki/Q367422) | 314–360 | Wikidata has 2 birth years (314, 400); Wikidata has 2 death years (400, 360) |
| [Kabir](https://www.wikidata.org/wiki/Q312551) | 1398–1518 | Wikidata has 2 birth years (1398, 1440) |
| [Kadambini Ganguly](https://www.wikidata.org/wiki/Q3347358) | 1861–1923 | Wikidata has 2 birth years (1862, 1861) |
| [Kamala Sohonie](https://www.wikidata.org/wiki/Q7406) | 1911–1998 | Wikidata has 2 birth years (1912, 1911) |
| [Karl Philipp Moritz](https://www.wikidata.org/wiki/Q215781) | 1756–1793 | Wikidata has 2 birth years (1757, 1756) |
| [Kelzang Gyatso](https://www.wikidata.org/wiki/Q25249) | 1708–1757 | Wikidata has 2 death years (1757, 1758) |
| [Khalid of Saudi Arabia](https://www.wikidata.org/wiki/Q208301) | 1911–1982 | Wikidata has 2 birth years (1911, 1912) |
| [Ki no Tsurayuki](https://www.wikidata.org/wiki/Q468288) | 872–945 | Wikidata has 2 birth years (866, 872) |
| [Kitagawa Utamaro](https://www.wikidata.org/wiki/Q272045) | 1753–1806 | Wikidata has 2 birth years (1754, 1753) |
| [Konstantinos Kanaris](https://www.wikidata.org/wiki/Q365201) | 1790–1877 | Wikidata has 3 birth years (1793, 1795, 1790) |
| [Köprülü Mehmed Paşa](https://www.wikidata.org/wiki/Q728324) | 1580–1661 | Wikidata has 2 birth years (1580, 1578) |
| [Kılıç Ali Paşa](https://www.wikidata.org/wiki/Q465269) | 1519–1587 | Wikidata has 2 birth years (1519, 1500) |
| [Ladislaus III of Hungary](https://www.wikidata.org/wiki/Q86932) | 1199–1205 | Wikidata has 2 birth years (1199, 1201) |
| [Laura Betti](https://www.wikidata.org/wiki/Q285431) | 1927–2004 | Wikidata has 2 birth years (1927, 1934) |
| [Laza Lazarević](https://www.wikidata.org/wiki/Q975807) | 1851–1890 | Wikidata has 2 death years (1890, 1891) |
| [Lebna Dengel](https://www.wikidata.org/wiki/Q558437) | 1500–1540 | Wikidata has 2 birth years (1500, 1496) |
| [Leo I](https://www.wikidata.org/wiki/Q43954) | 400–461 | Wikidata has 2 birth years (390, 400) |
| [Leo VI](https://www.wikidata.org/wiki/Q103795) | 880–928 | Wikidata has 2 death years (928, 929) |
| [Leonardo Bruni](https://www.wikidata.org/wiki/Q314488) | 1369–1444 | Wikidata has 2 birth years (1369, 1370) |
| [Li He](https://www.wikidata.org/wiki/Q856223) | 805–816 | Wikidata has 2 birth years (790, 805); Wikidata has 2 death years (831, 816) |
| [Li Tsung-jen](https://www.wikidata.org/wiki/Q20297) | 1889–1969 | Wikidata has 3 birth years (1890, 1889, 1891) |
| [Li Wenliang](https://www.wikidata.org/wiki/Q84497471) | 1985–2020 | Wikidata has 2 birth years (1985, 1986) |
| [Li Yu](https://www.wikidata.org/wiki/Q310898) | 1610–1680 | Wikidata has 2 birth years (1610, 1611) |
| [Liam O'Flaherty](https://www.wikidata.org/wiki/Q370973) | 1896–1984 | Wikidata has 2 birth years (1896, 1897) |
| [Lluís Companys](https://www.wikidata.org/wiki/Q7981) | 1882–1940 | Wikidata has 2 birth years (1882, 1883) |
| [Lola Anglada](https://www.wikidata.org/wiki/Q459343) | 1891–1984 | Wikidata has 2 birth years (1892, 1891) |
| [Louis IV of France](https://www.wikidata.org/wiki/Q193658) | 920–954 | Wikidata has 2 birth years (921, 920) |
| [Louis IX of France](https://www.wikidata.org/wiki/Q346) | 1214–1270 | Wikidata has 2 birth years (1214, 1215) — ✅ **Resolved (Oct 2026):** Poissy, 25 Apr 1214 (the pin). 1215 is wrong. Sources: [wikipedia.org](https://en.wikipedia.org/wiki/Louis_IX_of_France), [britannica.com](https://www.britannica.com/summary/Louis-IX) |
| [Louis Le Vau](https://www.wikidata.org/wiki/Q310530) | 1613–1670 | Wikidata has 2 birth years (1613, 1612) |
| [Louis de Freycinet](https://www.wikidata.org/wiki/Q520189) | 1779–1841 | Wikidata has 2 death years (1842, 1841) |
| [Luca Giordano](https://www.wikidata.org/wiki/Q332494) | 1632–1705 | Wikidata has 2 birth years (1632, 1634) |
| [Lucius Annaeus Florus](https://www.wikidata.org/wiki/Q316483) | 70–140 | Wikidata has 2 birth years (74, 70) |
| [Ludovico Manin](https://www.wikidata.org/wiki/Q458677) | 1725–1802 | Wikidata has 2 birth years (1725, 1726) |
| [Luis Ramírez de Lucena](https://www.wikidata.org/wiki/Q357782) | 1465–1530 | Wikidata has 2 birth years (1475, 1465) |
| [Luo Guanzhong](https://www.wikidata.org/wiki/Q264517) | 1330–1400 | Wikidata has 2 birth years (1330, 1334) |
| [Lutfi Pasha](https://www.wikidata.org/wiki/Q1584707) | 1488–1553 | Wikidata has 5 death years (1563, 1564, 1562, 1553, 1554) |
| [Lygia Fagundes Telles](https://www.wikidata.org/wiki/Q465421) | 1918–2022 | Wikidata has 2 birth years (1918, 1923) |
| [M. Visvesvaraya](https://www.wikidata.org/wiki/Q741700) | 1860–1962 | Wikidata has 2 birth years (1861, 1860) |
| [Macrinus](https://www.wikidata.org/wiki/Q1752) | 164–218 | Wikidata has 2 birth years (164, 165) |
| [Maeve Binchy](https://www.wikidata.org/wiki/Q152690) | 1939–2012 | Wikidata has 2 birth years (1939, 1940) |
| [Mah Şeref Han](https://www.wikidata.org/wiki/Q464670) | 1805–1847 | Wikidata has 2 death years (1847, 1848) |
| [Maharishi Mahesh Yogi](https://www.wikidata.org/wiki/Q244968) | 1917–2008 | Wikidata has 2 birth years (1917, 1918) |
| [Mahmud Shevket Pasha](https://www.wikidata.org/wiki/Q722306) | 1856–1913 | Wikidata has 2 birth years (1856, 1858) |
| [Manco Capac](https://www.wikidata.org/wiki/Q165968) | 1200–1230 | Wikidata has 2 death years (1230, 1300) |
| [Manco Inca](https://www.wikidata.org/wiki/Q332049) | 1500–1544 | Wikidata has 2 birth years (1515, 1500); Wikidata has 2 death years (1545, 1544) |
| [Mani](https://www.wikidata.org/wiki/Q203922) | 216–274 | Wikidata has 2 death years (274, 277) |
| [Margaret Cavendish, Duchess of Newcastle-upon-Tyne](https://www.wikidata.org/wiki/Q242640) | 1617–1673 | Wikidata has 2 birth years (1623, 1617) |
| [Marie Tussaud](https://www.wikidata.org/wiki/Q219572) | 1760–1850 | Wikidata has 2 birth years (1761, 1760) |
| [Markian Popov](https://www.wikidata.org/wiki/Q462301) | 1902–1969 | Wikidata has 2 birth years (1902, 1904) |
| [Martin I of Sicily](https://www.wikidata.org/wiki/Q468616) | 1374–1409 | Wikidata has 3 birth years (1376, 1374, 1375) |
| [Martin V](https://www.wikidata.org/wiki/Q169612) | 1368–1431 | Wikidata has 2 birth years (1369, 1368) |
| [Martin Waldseemüller](https://www.wikidata.org/wiki/Q57197) | 1470–1520 | Wikidata has 2 death years (1520, 1521) |
| [Matteo Maria Boiardo](https://www.wikidata.org/wiki/Q319557) | 1441–1494 | Wikidata has 2 death years (1495, 1494) |
| [Max Fleischer](https://www.wikidata.org/wiki/Q93788) | 1883–1972 | Wikidata has 2 birth years (1883, 1885) |
| [Maximian](https://www.wikidata.org/wiki/Q46768) | 240–310 | Wikidata has 2 birth years (250, 240) |
| [Meera](https://www.wikidata.org/wiki/Q466330) | 1498–1546 | Wikidata has 2 birth years (1498, 1504); Wikidata has 3 death years (1547, 1546, 1552) |
| [Menander Protector](https://www.wikidata.org/wiki/Q336070) | 550–600 | Wikidata has 2 death years (605, 600) |
| [Michael Attaleiates](https://www.wikidata.org/wiki/Q181919) | 1030–1080 | Wikidata has 2 birth years (1021, 1030); Wikidata has 2 death years (1085, 1080) |
| [Michael Sittow](https://www.wikidata.org/wiki/Q372203) | 1459–1525 | Wikidata has 2 birth years (1459, 1468) |
| [Miguel Ricardo de Álava y Esquivel](https://www.wikidata.org/wiki/Q451113) | 1770–1843 | Wikidata has 3 birth years (1770, 1772, 1771) |
| [Mikhail Miloradovich](https://www.wikidata.org/wiki/Q176306) | 1770–1825 | Wikidata has 2 birth years (1771, 1770) |
| [Mikhail of Tver](https://www.wikidata.org/wiki/Q380373) | 1271–1318 | Wikidata has 2 death years (1318, 1319) |
| [Mohsen Fakhrizadeh](https://www.wikidata.org/wiki/Q2895606) | 1961–2020 | Wikidata has 2 birth years (1961, 1958) |
| [Morteza Motahhari](https://www.wikidata.org/wiki/Q1397229) | 1919–1979 | Wikidata has 2 birth years (1919, 1920) |
| [Moses of Chorene](https://www.wikidata.org/wiki/Q365695) | 410–487 | Wikidata has 2 death years (487, 490) |
| [Moshe ben Maimon](https://www.wikidata.org/wiki/Q127398) | 1135–1204 | Wikidata has 2 birth years (1135, 1138) |
| [Muhammad Husayn Tabatabaei](https://www.wikidata.org/wiki/Q737448) | 1892–1981 | Wikidata has 2 birth years (1904, 1892) |
| [Muhammad I of Granada](https://www.wikidata.org/wiki/Q510879) | 1199–1273 | Wikidata has 2 birth years (1194, 1199) |
| [Muhammad al-Badr](https://www.wikidata.org/wiki/Q711230) | 1929–1996 | Wikidata has 2 birth years (1929, 1926) |
| [Muhammad al-Shaybani](https://www.wikidata.org/wiki/Q293612) | 749–805 | Wikidata has 2 birth years (749, 750) |
| [Nader Shah](https://www.wikidata.org/wiki/Q192868) | 1688–1747 | Wikidata has 2 birth years (1698, 1688) |
| [Narayana Guru](https://www.wikidata.org/wiki/Q1260858) | 1855–1928 | Wikidata has 2 birth years (1856, 1855) |
| [Narses](https://www.wikidata.org/wiki/Q294781) | 478–568 | Wikidata has 2 death years (574, 568) |
| [Naum Gabo](https://www.wikidata.org/wiki/Q309482) | 1890–1973 | Wikidata has 2 death years (1973, 1977) |
| [Nayef bin Abdul-Aziz Al Saud](https://www.wikidata.org/wiki/Q317832) | 1933–2012 | Wikidata has 2 birth years (1933, 1934) |
| [Nellie Bly](https://www.wikidata.org/wiki/Q230299) | 1864–1922 | Wikidata has 2 birth years (1864, 1865) |
| [Niccolò dell'Abbate](https://www.wikidata.org/wiki/Q333563) | 1509–1571 | Wikidata has 2 birth years (1509, 1512) |
| [Nigâr Hanım](https://www.wikidata.org/wiki/Q7034181) | 1862–1918 | Wikidata has 2 birth years (1862, 1856) |
| [Nikephoros I of Constantinople](https://www.wikidata.org/wiki/Q116639) | 750–828 | Wikidata has 2 birth years (750, 758) |
| [Nikolai Fyodorovich Fyodorov](https://www.wikidata.org/wiki/Q463723) | 1828–1903 | Wikidata has 2 birth years (1829, 1828) |
| [Nizami Ganjavi](https://www.wikidata.org/wiki/Q234908) | 1141–1202 | Wikidata has 3 death years (1214, 1202, 1209) |
| [Nâzım Hikmet](https://www.wikidata.org/wiki/Q184906) | 1901–1963 | Wikidata has 2 birth years (1901, 1902) |
| [Og Mandino](https://www.wikidata.org/wiki/Q2500222) | 1924–1996 | Wikidata has 2 birth years (1924, 1923) |
| [Orcagna](https://www.wikidata.org/wiki/Q366499) | 1308–1368 | Wikidata has 3 birth years (1320, 1308, 1315) |
| [Origen](https://www.wikidata.org/wiki/Q170472) | 184–254 | Wikidata has 2 birth years (185, 184) |
| [Oruç Reis](https://www.wikidata.org/wiki/Q470634) | 1474–1518 | Wikidata has 2 birth years (1473, 1474) |
| [Ottokar I of Bohemia](https://www.wikidata.org/wiki/Q312938) | 1155–1230 | Wikidata has 2 birth years (1167, 1155) |
| [Papias of Hierapolis](https://www.wikidata.org/wiki/Q273053) | 60–140 | Wikidata has 2 death years (140, 150) |
| [Park Hon-young](https://www.wikidata.org/wiki/Q334297) | 1900–1955 | Wikidata has 2 death years (1955, 1956) |
| [Paul-Émile Lecoq de Boisbaudran](https://www.wikidata.org/wiki/Q366827) | 1836–1912 | Wikidata has 2 birth years (1836, 1838) |
| [Pausanias](https://www.wikidata.org/wiki/Q192931) | 110–180 | Wikidata has 2 birth years (115, 110) |
| [Pavlos Kountouriotis](https://www.wikidata.org/wiki/Q374655) | 1854–1935 | Wikidata has 2 birth years (1855, 1854) |
| [Pedro de Alvarado](https://www.wikidata.org/wiki/Q210900) | 1485–1541 | Wikidata has 2 birth years (1486, 1485) |
| [Peire Vidal](https://www.wikidata.org/wiki/Q5269) | 1175–1205 | Wikidata has 3 death years (1210, 1205, 1215) |
| [Pepin the Short](https://www.wikidata.org/wiki/Q81212) | 714–768 | Wikidata has 2 birth years (714, 715) |
| [Peter, King of Hungary](https://www.wikidata.org/wiki/Q314218) | 1011–1046 | Wikidata has 3 death years (1050, 1046, 1059) |
| [Petrus Christus](https://www.wikidata.org/wiki/Q312616) | 1410–1475 | Wikidata has 3 birth years (1410, 1425, 1415) |
| [Petrus Plancius](https://www.wikidata.org/wiki/Q333534) | 1522–1622 | Wikidata has 2 birth years (1552, 1522) |
| [Philip Johnson](https://www.wikidata.org/wiki/Q183528) | 1906–2007 | Wikidata has 2 death years (2005, 2007) |
| [Philostratus](https://www.wikidata.org/wiki/Q2274948) | 170–245 | Wikidata has 2 death years (250, 245) |
| [Photios I of Constantinople](https://www.wikidata.org/wiki/Q243187) | 820–900 | Wikidata has 2 birth years (820, 827) |
| [Piero di Cosimo](https://www.wikidata.org/wiki/Q280851) | 1461–1522 | Wikidata has 2 birth years (1462, 1461) |
| [Pieter Claesz](https://www.wikidata.org/wiki/Q354832) | 1596–1660 | Wikidata has 2 birth years (1597, 1596) |
| [Pieter de Hooch](https://www.wikidata.org/wiki/Q314889) | 1629–1683 | Wikidata has 2 death years (1684, 1683) |
| [Piri Reis](https://www.wikidata.org/wiki/Q217915) | 1470–1553 | Wikidata has 2 death years (1554, 1553) |
| [Polycarp](https://www.wikidata.org/wiki/Q192371) | 69–155 | Wikidata has 2 birth years (70, 69) |
| [Pontormo](https://www.wikidata.org/wiki/Q207929) | 1494–1556 | Wikidata has 2 death years (1557, 1556) |
| [Prithviraj Chauhan](https://www.wikidata.org/wiki/Q558219) | 1166–1192 | Wikidata has 2 birth years (1159, 1166) |
| [Procopius](https://www.wikidata.org/wiki/Q186153) | 500–558 | Wikidata has 2 death years (558, 565) |
| [Pupienus](https://www.wikidata.org/wiki/Q1797) | 170–238 | Wikidata has 2 birth years (170, 178) |
| [Qiu Jin](https://www.wikidata.org/wiki/Q465324) | 1879–1907 | Wikidata has 2 birth years (1879, 1875) |
| [Quinten Metsys](https://www.wikidata.org/wiki/Q314275) | 1456–1530 | Wikidata has 3 birth years (1466, 1465, 1456) |
| [Rabanus Maurus](https://www.wikidata.org/wiki/Q160441) | 776–856 | Wikidata has 3 birth years (776, 780, 784) |
| [Raden Saleh](https://www.wikidata.org/wiki/Q1375979) | 1807–1880 | Wikidata has 3 birth years (1811, 1814, 1807) |
| [Rama Khamhaeng](https://www.wikidata.org/wiki/Q349249) | 1239–1298 | Wikidata has 2 birth years (1239, 1279) |
| [Ramana Maharshi](https://www.wikidata.org/wiki/Q288441) | 1879–1922 | Wikidata has 2 death years (1922, 1950) |
| [Ramananda](https://www.wikidata.org/wiki/Q2672093) | 1400–1470 | Wikidata has 2 death years (1476, 1470) |
| [Ramón Grau](https://www.wikidata.org/wiki/Q455365) | 1881–1969 | Wikidata has 2 birth years (1887, 1881) |
| [Red Cloud](https://www.wikidata.org/wiki/Q312721) | 1822–1909 | Wikidata has 2 death years (1910, 1909) |
| [Riad Al Solh](https://www.wikidata.org/wiki/Q950579) | 1894–1951 | Wikidata has 2 birth years (1894, 1893) |
| [Richard Cantillon](https://www.wikidata.org/wiki/Q364975) | 1675–1734 | Wikidata has 2 birth years (1680, 1675) |
| [Richard Crashaw](https://www.wikidata.org/wiki/Q553900) | 1612–1649 | Wikidata has 2 birth years (1612, 1613) |
| [Richard Howe, 1st Earl Howe](https://www.wikidata.org/wiki/Q332616) | 1725–1799 | Wikidata has 2 birth years (1726, 1725) |
| [Richard Lovelace](https://www.wikidata.org/wiki/Q2016121) | 1617–1658 | Wikidata has 2 birth years (1617, 1618) |
| [Robert Kerr](https://www.wikidata.org/wiki/Q472232) | 1755–1813 | Wikidata has 2 birth years (1755, 1757) |
| [Robert, King of Naples](https://www.wikidata.org/wiki/Q290720) | 1277–1343 | Wikidata has 2 birth years (1278, 1277) |
| [Rodolphus Agricola](https://www.wikidata.org/wiki/Q365557) | 1443–1485 | Wikidata has 2 birth years (1444, 1443) |
| [Roger Ascham](https://www.wikidata.org/wiki/Q965811) | 1515–1568 | Wikidata has 2 death years (1569, 1568) |
| [Rosario Castellanos](https://www.wikidata.org/wiki/Q260862) | 1924–1974 | Wikidata has 2 birth years (1925, 1924) |
| [Rudolf Höss](https://www.wikidata.org/wiki/Q76975) | 1900–1947 | Wikidata has 2 birth years (1901, 1900) |
| [Ruhollah Khomeini](https://www.wikidata.org/wiki/Q38823) | 1900–1989 | Wikidata has 2 birth years (1902, 1900) — ❔ **Still uncertain (Oct 2026), panel says so:** Still uncertain (1900 or 1902). The panel now says so. Sources: [wikipedia.org](https://en.wikipedia.org/wiki/Ruhollah_Khomeini) |
| [Rutebeuf](https://www.wikidata.org/wiki/Q918599) | 1230–1285 | Wikidata has 2 birth years (1245, 1230) |
| [Saad Zaghloul](https://www.wikidata.org/wiki/Q328734) | 1857–1927 | Wikidata has 3 birth years (1859, 1858, 1857) |
| [Sadegh Hedayat](https://www.wikidata.org/wiki/Q315017) | 1902–1951 | Wikidata has 2 birth years (1903, 1902) |
| [Saint Sava](https://www.wikidata.org/wiki/Q138465) | 1169–1235 | Wikidata has 4 birth years (1174, 1169, 1175, 1176); Wikidata has 2 death years (1236, 1235) |
| [Saint Wenceslaus I, Duke of Bohemia](https://www.wikidata.org/wiki/Q196527) | 903–935 | Wikidata has 2 birth years (907, 903) |
| [Salomon van Ruysdael](https://www.wikidata.org/wiki/Q247005) | 1600–1670 | Wikidata has 2 birth years (1600, 1602) |
| [Sam Jaffe](https://www.wikidata.org/wiki/Q719247) | 1891–1984 | Wikidata has 2 birth years (1893, 1891) |
| [Samuel Goldwyn](https://www.wikidata.org/wiki/Q72579) | 1879–1974 | Wikidata has 2 birth years (1882, 1879) |
| [Samuel Richardson](https://www.wikidata.org/wiki/Q295941) | 1689–1761 | Wikidata has 2 birth years (1687, 1689) |
| [Samuel de Champlain](https://www.wikidata.org/wiki/Q68529) | 1567–1635 | Wikidata has 2 birth years (1574, 1567) |
| [Samuel ibn Naghrillah](https://www.wikidata.org/wiki/Q467161) | 993–1055 | Wikidata has 2 death years (1056, 1055) |
| [Saxo Grammaticus](https://www.wikidata.org/wiki/Q106837) | 1150–1206 | Wikidata has 2 death years (1206, 1220) |
| [Sayyid Qutb](https://www.wikidata.org/wiki/Q211379) | 1906–1966 | Wikidata has 2 death years (1967, 1966) |
| [Scott Joplin](https://www.wikidata.org/wiki/Q191499) | 1867–1917 | Wikidata has 2 birth years (1868, 1867) |
| [Sebastian Cabot](https://www.wikidata.org/wiki/Q348340) | 1476–1557 | Wikidata has 2 birth years (1484, 1476) |
| [Severus of Antioch](https://www.wikidata.org/wiki/Q729105) | 456–538 | Wikidata has 2 birth years (465, 456) |
| [Shakuntala Devi](https://www.wikidata.org/wiki/Q3181898) | 1929–2013 | Wikidata has 2 birth years (1929, 1939) |
| [Sher Ali Khan](https://www.wikidata.org/wiki/Q40427) | 1823–1879 | Wikidata has 2 birth years (1825, 1823) |
| [Sher Shah Suri](https://www.wikidata.org/wiki/Q83680) | 1472–1545 | Wikidata has 2 birth years (1472, 1486) |
| [Shi Nai'an](https://www.wikidata.org/wiki/Q1777502) | 1296–1365 | Wikidata has 2 birth years (1290, 1296); Wikidata has 3 death years (1372, 1371, 1365) |
| [Shitao](https://www.wikidata.org/wiki/Q469439) | 1630–1707 | Wikidata has 3 birth years (1630, 1642, 1641) |
| [Shvarn](https://www.wikidata.org/wiki/Q324493) | 1230–1269 | Wikidata has 2 death years (1269, 1270) |
| [Sigurd the Crusader](https://www.wikidata.org/wiki/Q313005) | 1089–1130 | Wikidata has 2 birth years (1090, 1089) |
| [Simeon Stylites](https://www.wikidata.org/wiki/Q310987) | 389–459 | Wikidata has 2 birth years (389, 390) |
| [Soh Jaipil](https://www.wikidata.org/wiki/Q319934) | 1864–1951 | Wikidata has 2 birth years (1864, 1866) |
| [Solomon ibn Gabirol](https://www.wikidata.org/wiki/Q239355) | 1020–1057 | Wikidata has 2 birth years (1021, 1020); Wikidata has 3 death years (1057, 1070, 1058) |
| [Songtsän Gampo](https://www.wikidata.org/wiki/Q320122) | 604–650 | Wikidata has 2 birth years (604, 617) |
| [Sozomen](https://www.wikidata.org/wiki/Q354350) | 400–447 | Wikidata has 3 death years (450, 447, 448) |
| [Spiro Samara](https://www.wikidata.org/wiki/Q381436) | 1861–1917 | Wikidata has 2 birth years (1861, 1863) |
| [Sufyan al-Thawri](https://www.wikidata.org/wiki/Q205788) | 716–778 | Wikidata has 2 death years (778, 784) |
| [Sunjata Keïta](https://www.wikidata.org/wiki/Q175772) | 1190–1255 | Wikidata has 2 birth years (1215, 1190) |
| [Söyembikä of Kazan](https://www.wikidata.org/wiki/Q470208) | 1516–1554 | Wikidata has 2 death years (1554, 1557) |
| [T. V. Soong](https://www.wikidata.org/wiki/Q716051) | 1893–1971 | Wikidata has 3 birth years (1893, 1891, 1894) |
| [Taliesin](https://www.wikidata.org/wiki/Q357835) | 518–599 | Wikidata has 2 birth years (518, 534) |
| [Tanaka Giichi](https://www.wikidata.org/wiki/Q145416) | 1864–1929 | Wikidata has 2 birth years (1864, 1863) |
| [Taqi al-Din Muhammad ibn Ma'ruf](https://www.wikidata.org/wiki/Q1379164) | 1525–1580 | Wikidata has 2 birth years (1526, 1525); Wikidata has 2 death years (1585, 1580) |
| [Teofilo Folengo](https://www.wikidata.org/wiki/Q32833) | 1491–1544 | Wikidata has 2 birth years (1496, 1491); Wikidata has 2 death years (1544, 1554) |
| [Theodelinda](https://www.wikidata.org/wiki/Q232525) | 570–627 | Wikidata has 2 death years (628, 627) |
| [Theodora](https://www.wikidata.org/wiki/Q204843) | 497–548 | Wikidata has 2 birth years (497, 500) |
| [Theodore II Laskaris](https://www.wikidata.org/wiki/Q37082) | 1221–1258 | Wikidata has 2 birth years (1221, 1222) |
| [Theodoret](https://www.wikidata.org/wiki/Q317029) | 393–450 | Wikidata has 3 death years (466, 457, 450) |
| [Thomas à Kempis](https://www.wikidata.org/wiki/Q220976) | 1379–1471 | Wikidata has 2 birth years (1379, 1380) |
| [Trinle Gyatso](https://www.wikidata.org/wiki/Q25240) | 1856–1875 | Wikidata has 2 birth years (1857, 1856) |
| [Tulsidas](https://www.wikidata.org/wiki/Q312976) | 1511–1623 | Wikidata has 2 birth years (1532, 1511) |
| [Unsuri](https://www.wikidata.org/wiki/Q32842) | 970–1039 | Wikidata has 2 birth years (980, 970) |
| [Urwah ibn Zubayr](https://www.wikidata.org/wiki/Q423774) | 644–713 | Wikidata has 2 birth years (644, 649); Wikidata has 2 death years (717, 713) |
| [Uthman ibn Affan](https://www.wikidata.org/wiki/Q37731) | 574–656 | Wikidata has 2 birth years (574, 575) |
| [Vakhtang I of Iberia](https://www.wikidata.org/wiki/Q359956) | 440–502 | Wikidata has 2 birth years (442, 440) |
| [Valerian](https://www.wikidata.org/wiki/Q46750) | 199–260 | Wikidata has 2 birth years (200, 199); Wikidata has 2 death years (264, 260) |
| [Vasco da Gama](https://www.wikidata.org/wiki/Q7328) | 1469–1525 | Wikidata has 2 birth years (1469, 1460) — ❔ **Still uncertain (Oct 2026), panel says so:** Still uncertain (about 1460 or 1469). The panel now says so. Sources: [wikipedia.org](https://en.wikipedia.org/wiki/Vasco_da_Gama) |
| [Vasily of Kostroma](https://www.wikidata.org/wiki/Q548014) | 1236–1276 | Wikidata has 2 birth years (1241, 1236) |
| [Vicente López y Planes](https://www.wikidata.org/wiki/Q441072) | 1784–1856 | Wikidata has 2 birth years (1785, 1784) |
| [Victoriano Huerta](https://www.wikidata.org/wiki/Q299168) | 1850–1916 | Wikidata has 2 birth years (1854, 1850) |
| [Vidyapati](https://www.wikidata.org/wiki/Q2429461) | 1360–1448 | Wikidata has 2 birth years (1352, 1360) |
| [Vilhelm Bjerknes](https://www.wikidata.org/wiki/Q164389) | 1862–1951 | Wikidata has 2 birth years (1862, 1863) |
| [Vincent of Beauvais](https://www.wikidata.org/wiki/Q455162) | 1190–1264 | Wikidata has 2 death years (1267, 1264) |
| [Vincent of Lérins](https://www.wikidata.org/wiki/Q644057) | 500–? | Wikidata has 2 death years (450, 445) |
| [Vitale Faliero](https://www.wikidata.org/wiki/Q653624) | 1100–? | Wikidata has 2 death years (1096, 1095) |
| [Vitiges](https://www.wikidata.org/wiki/Q312607) | 475–541 | Wikidata has 2 death years (542, 541) |
| [Vittore Carpaccio](https://www.wikidata.org/wiki/Q5581) | 1465–1520 | Wikidata has 2 death years (1526, 1520) |
| [Vladimir Atlasov](https://www.wikidata.org/wiki/Q380386) | 1660–1711 | Wikidata has 3 birth years (1661, 1660, 1663) |
| [Vladimir K. Zworykin](https://www.wikidata.org/wiki/Q296545) | 1888–1982 | Wikidata has 2 birth years (1888, 1889) |
| [Vratislaus I, Duke of Bohemia](https://www.wikidata.org/wiki/Q552696) | 875–921 | Wikidata has 3 birth years (888, 875, 880) |
| [Wace](https://www.wikidata.org/wiki/Q5382) | 1100–1174 | Wikidata has 2 death years (1175, 1174) |
| [Waldemar Haffkine](https://www.wikidata.org/wiki/Q2142351) | 1856–1930 | Wikidata has 2 birth years (1856, 1860) |
| [Walter Raleigh](https://www.wikidata.org/wiki/Q189144) | 1552–1618 | Wikidata has 2 birth years (1552, 1554) |
| [Walter Rodney](https://www.wikidata.org/wiki/Q1394990) | 1942–1979 | Wikidata has 2 death years (1980, 1979) |
| [Wang Wei](https://www.wikidata.org/wiki/Q313605) | 699–759 | Wikidata has 2 death years (759, 761) |
| [Wang Xizhi](https://www.wikidata.org/wiki/Q378564) | 303–361 | Wikidata has 2 birth years (321, 303) |
| [Wellington Koo](https://www.wikidata.org/wiki/Q317462) | 1888–1985 | Wikidata has 2 birth years (1888, 1887) |
| [Willem Schouten](https://www.wikidata.org/wiki/Q316391) | 1567–1625 | Wikidata has 3 birth years (1580, 1567, 1577) |
| [William Kent](https://www.wikidata.org/wiki/Q445433) | 1684–1748 | Wikidata has 2 birth years (1684, 1685) |
| [William Magear Tweed](https://www.wikidata.org/wiki/Q1353450) | 1824–1878 | Wikidata has 2 birth years (1824, 1823) |
| [William of Rubruck](https://www.wikidata.org/wiki/Q316083) | 1210–1293 | Wikidata has 2 birth years (1220, 1210) |
| [William the Lion](https://www.wikidata.org/wiki/Q312594) | 1142–1214 | Wikidata has 2 birth years (1143, 1142) |
| [Wu Cheng'en](https://www.wikidata.org/wiki/Q228889) | 1500–1582 | Wikidata has 2 birth years (1504, 1500) |
| [Wu Peifu](https://www.wikidata.org/wiki/Q697046) | 1874–1939 | Wikidata has 2 birth years (1874, 1878) |
| [Władysław III Spindleshanks](https://www.wikidata.org/wiki/Q54052) | 1165–1231 | Wikidata has 2 birth years (1168, 1165) |
| [Yelü Chucai](https://www.wikidata.org/wiki/Q117449) | 1189–1243 | Wikidata has 2 birth years (1189, 1190); Wikidata has 2 death years (1244, 1243) |
| [Yerofey Khabarov](https://www.wikidata.org/wiki/Q469684) | 1603–1671 | Wikidata has 3 birth years (1607, 1605, 1603) |
| [Yevgenia Ginzburg](https://www.wikidata.org/wiki/Q242834) | 1903–1977 | Wikidata has 2 birth years (1903, 1904) |
| [Yevgeny Petrov](https://www.wikidata.org/wiki/Q714739) | 1903–1942 | Wikidata has 2 birth years (1903, 1902) |
| [Yun Ch'iho](https://www.wikidata.org/wiki/Q192111) | 1864–1945 | Wikidata has 2 birth years (1864, 1865) |
| [Zheng He](https://www.wikidata.org/wiki/Q7333) | 1371–1433 | Wikidata has 2 death years (1433, 1435) |
| [Ziryab](https://www.wikidata.org/wiki/Q1267054) | 777–845 | Wikidata has 2 death years (845, 857) |
| [Álvar Núñez Cabeza de Vaca](https://www.wikidata.org/wiki/Q250763) | 1485–1559 | Wikidata has 5 birth years (1495, 1485, 1490, 1507, 1500) |
| [Æthelred the Unready](https://www.wikidata.org/wiki/Q183499) | 967–1016 | Wikidata has 2 birth years (967, 968) |
| [İbrahim Müteferrika](https://www.wikidata.org/wiki/Q561445) | 1670–1745 | Wikidata has 2 birth years (1674, 1670); Wikidata has 2 death years (1747, 1745) |

### BCE, legendary or traditional figures (75)

| Person | On the globe | What disagrees |
|---|---|---|
| [Aesop](https://www.wikidata.org/wiki/Q43423) | -620–-564 | BCE figure — dates and places are often reconstructed; Wikidata has 2 birthplaces (Mesembria; Samos) |
| [Alexandros Polyhistor](https://www.wikidata.org/wiki/Q441138) | -100–-40 | BCE figure — dates and places are often reconstructed; Wikidata has 2 birthplaces (Phrygia; Miletus) |
| [Anaximenes of Miletus](https://www.wikidata.org/wiki/Q80612) | -585–-528 | BCE figure — dates and places are often reconstructed; Wikidata has 2 death years (-528, -525) |
| [Antiochus VII Sidetes](https://www.wikidata.org/wiki/Q294945) | -164–-130 | BCE figure — dates and places are often reconstructed; Wikidata has 2 birth years (-164, -159); Wikidata has 2 death years (-129, -130) |
| [Antiochus of Ascalon](https://www.wikidata.org/wiki/Q320042) | -130–-68 | BCE figure — dates and places are often reconstructed; Wikidata has 3 birth years (-127, -124, -130) |
| [Apion](https://www.wikidata.org/wiki/Q458108) | -20–45 | BCE figure — dates and places are often reconstructed; Wikidata has 2 birthplaces (Alexandria; Siwa Oasis) |
| [Apollonius of Rhodes](https://www.wikidata.org/wiki/Q192638) | -295–-215 | BCE figure — dates and places are often reconstructed; Wikidata has 2 birth years (-290, -295) |
| [Archelaus](https://www.wikidata.org/wiki/Q343607) | -500–? | BCE figure — dates and places are often reconstructed; Wikidata has 2 birthplaces (Athens; Miletus) |
| [Archimedes](https://www.wikidata.org/wiki/Q8739) | -287–-211 | BCE figure — dates and places are often reconstructed; death year -211 vs Wikidata -212 (date sits at New Year — calendar change?) |
| [Aristippus](https://www.wikidata.org/wiki/Q189506) | -435–-366 | BCE figure — dates and places are often reconstructed; Wikidata has 2 death years (-355, -366) |
| [Ariston of Chios](https://www.wikidata.org/wiki/Q646951) | -300–? | BCE figure — dates and places are often reconstructed; death year none vs Wikidata -300 (known only roughly) |
| [Arsinoe II](https://www.wikidata.org/wiki/Q40234) | -316–-270 | BCE figure — dates and places are often reconstructed; Wikidata has 2 death years (-268, -270) |
| [Arsinoe III of Egypt](https://www.wikidata.org/wiki/Q40258) | -246–-204 | BCE figure — dates and places are often reconstructed; Wikidata has 2 birth years (-244, -246) |
| [Cicero](https://www.wikidata.org/wiki/Q1541) | -106–-43 | BCE figure — dates and places are often reconstructed; birth year -106 vs Wikidata -107 (date sits at New Year — calendar change?) |
| [Cleisthenes](https://www.wikidata.org/wiki/Q207634) | -565–-500 | BCE figure — dates and places are often reconstructed; Wikidata has 2 birth years (-565, -570) |
| [Cornelius Nepos](https://www.wikidata.org/wiki/Q109594) | -100–-25 | BCE figure — dates and places are often reconstructed; Wikidata has 2 birthplaces (Pavia; Ostiglia) |
| [Democritus](https://www.wikidata.org/wiki/Q41980) | -460–-360 | BCE figure — dates and places are often reconstructed; Wikidata has 2 birthplaces (Miletus; Ancient Abdera) |
| [Dicaearchus](https://www.wikidata.org/wiki/Q352621) | -350–-285 | BCE figure — dates and places are often reconstructed; Wikidata has 2 birth years (-345, -350) |
| [Didymus Chalcenterus](https://www.wikidata.org/wiki/Q506540) | -65–10 | BCE figure — dates and places are often reconstructed; Wikidata has 2 birth years (-65, -63) |
| [Diogenes of Apollonia](https://www.wikidata.org/wiki/Q191964) | -460–? | BCE figure — dates and places are often reconstructed; death year none vs Wikidata -500 (known only roughly) |
| [Dionysius I of Syracuse](https://www.wikidata.org/wiki/Q332750) | -431–-367 | BCE figure — dates and places are often reconstructed; Wikidata has 2 birth years (-430, -431) |
| [Diotima of Mantinea](https://www.wikidata.org/wiki/Q1227107) | -450–? | BCE figure — dates and places are often reconstructed; death year none vs Wikidata -300 (known only roughly) |
| [Epicharmus of Kos](https://www.wikidata.org/wiki/Q312410) | -540–-448 | BCE figure — dates and places are often reconstructed; Wikidata has 2 birth years (-540, -524); Wikidata has 2 death years (-435, -448) |
| [Erasistratus](https://www.wikidata.org/wiki/Q377781) | -305–-250 | BCE figure — dates and places are often reconstructed; Wikidata has 2 birth years (-330, -305); Wikidata has 2 death years (-250, -249) |
| [Erinna](https://www.wikidata.org/wiki/Q256241) | -400–-400 | BCE figure — dates and places are often reconstructed; Wikidata has 4 birthplaces (Rhodes; Lesbos; Tinos; Tilos) |
| [Euclid of Megara](https://www.wikidata.org/wiki/Q312682) | -450–-365 | BCE figure — dates and places are often reconstructed; Wikidata has 2 birth years (-436, -450); Wikidata has 2 birthplaces (Megara; Gela) |
| [Eumenes](https://www.wikidata.org/wiki/Q297366) | -363–-316 | BCE figure — dates and places are often reconstructed; Wikidata has 2 birth years (-362, -363) |
| [Gaius Asinius Pollio](https://www.wikidata.org/wiki/Q319273) | -76–4 | BCE figure — dates and places are often reconstructed; Wikidata has 2 birth years (-75, -76) |
| [Gaius Claudius Nero](https://www.wikidata.org/wiki/Q441191) | -242–? | BCE figure — dates and places are often reconstructed; death year none vs Wikidata -260 (known only roughly) |
| [Gaius Marius](https://www.wikidata.org/wiki/Q177975) | -158–-86 | BCE figure — dates and places are often reconstructed; Wikidata has 2 birth years (-158, -157) |
| [Hanno the Great](https://www.wikidata.org/wiki/Q313555) | -300–-193 | BCE figure — dates and places are often reconstructed; Wikidata has 2 birth years (-300, -290) |
| [Hecataeus of Miletus](https://www.wikidata.org/wiki/Q242270) | -600–? | BCE figure — dates and places are often reconstructed; death year none → -475 |
| [Herod Antipas](https://www.wikidata.org/wiki/Q192950) | -21–? | BCE figure — dates and places are often reconstructed; Wikidata has 2 birth years (-20, -21); death year none → 39 |
| [Hypereides](https://www.wikidata.org/wiki/Q314447) | -390–-322 | BCE figure — dates and places are often reconstructed; Wikidata has 3 birth years (-388, -389, -390) |
| [Jeremiah](https://www.wikidata.org/wiki/Q158825) | -645–-587 | marked traditional — a script does not change these; pin 440 km from birthplace Anathoth |
| [Jimmu](https://www.wikidata.org/wiki/Q200188) | -711–? | BCE figure — dates and places are often reconstructed; death year none → -585 |
| [John the Apostle](https://www.wikidata.org/wiki/Q44015) | 11–99 | marked traditional — a script does not change these; pin 936 km from birthplace Bethsaida |
| [Juba II](https://www.wikidata.org/wiki/Q315670) | -52–23 | BCE figure — dates and places are often reconstructed; Wikidata has 2 birth years (-48, -52) |
| [Laozi](https://www.wikidata.org/wiki/Q9333) | -579–-500 | BCE figure — dates and places are often reconstructed; Wikidata has 2 birthplaces (Zhoukou; Chu) |
| [Livia](https://www.wikidata.org/wiki/Q469701) | -59–29 | BCE figure — dates and places are often reconstructed; Wikidata has 2 birth years (-58, -59) |
| [Lucius Accius](https://www.wikidata.org/wiki/Q311287) | -170–-85 | BCE figure — dates and places are often reconstructed; Wikidata has 2 death years (-85, -84) |
| [Lucius Munatius Plancus](https://www.wikidata.org/wiki/Q435167) | -89–-15 | BCE figure — dates and places are often reconstructed; Wikidata has 2 birth years (-87, -89) |
| [Lysias](https://www.wikidata.org/wiki/Q310164) | -445–-380 | BCE figure — dates and places are often reconstructed; Wikidata has 2 birthplaces (Athens; Syracuse) |
| [Lysimachus](https://www.wikidata.org/wiki/Q32133) | -361–-281 | BCE figure — dates and places are often reconstructed; Wikidata has 2 birth years (-361, -355) |
| [Mandane of Media](https://www.wikidata.org/wiki/Q271260) | -591–-559 | BCE figure — dates and places are often reconstructed; birth year -591 vs Wikidata -600 (too big a change for a script) |
| [Marcus Atilius Regulus](https://www.wikidata.org/wiki/Q318718) | -299–-250 | BCE figure — dates and places are often reconstructed; Wikidata has 2 death years (-246, -250) |
| [Metrodorus of Lampsacus](https://www.wikidata.org/wiki/Q780259) | -331–-278 | BCE figure — dates and places are often reconstructed; Wikidata has 2 birth years (-330, -331); Wikidata has 2 death years (-277, -278) |
| [Mithridates I of Pontus](https://www.wikidata.org/wiki/Q318021) | -400–? | BCE figure — dates and places are often reconstructed; death year none → -266 |
| [Musa of Parthia](https://www.wikidata.org/wiki/Q467466) | -46–? | BCE figure — dates and places are often reconstructed; death year none vs Wikidata 100 (known only roughly) |
| [Nebuchadnezzar II](https://www.wikidata.org/wiki/Q12591) | -642–-562 | BCE figure — dates and places are often reconstructed; Wikidata has 2 death years (-562, -561) |
| [Parthenius of Nicaea](https://www.wikidata.org/wiki/Q729109) | -1–? | BCE figure — dates and places are often reconstructed; death year none vs Wikidata -100 (known only roughly) |
| [Philolaus](https://www.wikidata.org/wiki/Q212338) | -470–-390 | BCE figure — dates and places are often reconstructed; Wikidata has 2 birthplaces (Crotone; Taras) |
| [Phocylides](https://www.wikidata.org/wiki/Q972799) | -560–? | BCE figure — dates and places are often reconstructed; death year none vs Wikidata -600 (known only roughly) |
| [Pisistratus](https://www.wikidata.org/wiki/Q242172) | -600–-527 | BCE figure — dates and places are often reconstructed; Wikidata has 2 birth years (-600, -550) |
| [Polemon](https://www.wikidata.org/wiki/Q553856) | -400–? | BCE figure — dates and places are often reconstructed; death year none → -270 |
| [Prodicus](https://www.wikidata.org/wiki/Q297402) | -464–-380 | BCE figure — dates and places are often reconstructed; Wikidata has 2 birth years (-464, -460) |
| [Prusias II of Bithynia](https://www.wikidata.org/wiki/Q359222) | -300–? | BCE figure — dates and places are often reconstructed; death year none → -149 |
| [Quintus Caecilius Metellus Macedonicus](https://www.wikidata.org/wiki/Q355768) | -200–-115 | BCE figure — dates and places are often reconstructed; Wikidata has 2 birth years (-200, -190) |
| [Quintus Caecilius Metellus Pius Scipio Nasica](https://www.wikidata.org/wiki/Q316825) | -99–-46 | BCE figure — dates and places are often reconstructed; Wikidata has 2 birth years (-95, -99) |
| [Quintus Lutatius Catulus](https://www.wikidata.org/wiki/Q352035) | -150–-87 | BCE figure — dates and places are often reconstructed; Wikidata has 2 birth years (-149, -150) |
| [Senenmut](https://www.wikidata.org/wiki/Q328732) | -1600–? | BCE figure — dates and places are often reconstructed; death year none → -1463 |
| [Servius Tullius](https://www.wikidata.org/wiki/Q192998) | -600–-535 | BCE figure — dates and places are often reconstructed; Wikidata has 2 death years (-535, -534) |
| [Simonides of Ceos](https://www.wikidata.org/wiki/Q273003) | -556–-469 | BCE figure — dates and places are often reconstructed; Wikidata has 2 death years (-468, -469) |
| [Spurius Cassius Vecellinus](https://www.wikidata.org/wiki/Q444151) | -542–-486 | BCE figure — dates and places are often reconstructed; death year -486 vs Wikidata -485 (date sits at New Year — calendar change?) |
| [Sun Tzu](https://www.wikidata.org/wiki/Q37151) | -544–-496 | BCE figure — dates and places are often reconstructed; Wikidata has 2 death years (-496, -470) |
| [Tadukhipa](https://www.wikidata.org/wiki/Q262428) | -1365–? | BCE figure — dates and places are often reconstructed; death year none vs Wikidata -1400 (known only roughly) |
| [Terpander](https://www.wikidata.org/wiki/Q113417) | -712–-645 | BCE figure — dates and places are often reconstructed; Wikidata has 3 birthplaces (Antissa; Cyme; Arne) |
| [Theaetetus](https://www.wikidata.org/wiki/Q920912) | -416–-369 | BCE figure — dates and places are often reconstructed; birth year -416 vs Wikidata -417 (date sits at New Year — calendar change?) |
| [Theocritus](https://www.wikidata.org/wiki/Q219484) | -400–? | BCE figure — dates and places are often reconstructed; Wikidata has 2 birthplaces (Kos; Syracuse); death year none → -260 |
| [Theopompus](https://www.wikidata.org/wiki/Q4318) | -380–-320 | BCE figure — dates and places are often reconstructed; Wikidata has 2 birth years (-380, -378); Wikidata has 2 death years (-315, -320) |
| [Valerius Maximus](https://www.wikidata.org/wiki/Q379991) | -100–? | BCE figure — dates and places are often reconstructed; death year none vs Wikidata 100 (known only roughly) |
| [Verres](https://www.wikidata.org/wiki/Q368219) | -200–? | BCE figure — dates and places are often reconstructed; death year none → -43 |
| [Wolverine](https://www.wikidata.org/wiki/Q186422) | 1832–? | marked traditional — a script does not change these; Wikidata has 2 birthplaces (Canada; Alberta) |
| [Yermak Timofeyevich](https://www.wikidata.org/wiki/Q297047) | 1532–1585 | marked traditional — a script does not change these; Wikidata has 2 birth years (1532, 1537) |
| [Zechariah](https://www.wikidata.org/wiki/Q139464) | -100–? | marked traditional — a script does not change these; death year none vs Wikidata 100 (known only roughly) |

### Other (rough dates, big jumps, death before birth on file) (34)

| Person | On the globe | What disagrees |
|---|---|---|
| [Abdul Rahim Khan-I-Khana](https://www.wikidata.org/wiki/Q317364) | 1556–1626 | death year 1626 vs Wikidata 1627 (date sits at New Year — calendar change?) |
| [Abraha](https://www.wikidata.org/wiki/Q323363) | 600–? | death year 570 is before the birth year on file (600) |
| [Abu Saʿīd Gardēzī](https://www.wikidata.org/wiki/Q563574) | 1100–? | death year 1061 is before the birth year on file (1100) |
| [Abu-Mansur Daqiqi](https://www.wikidata.org/wiki/Q538902) | 1000–? | death year 977 is before the birth year on file (1000) |
| [Adam of Bremen](https://www.wikidata.org/wiki/Q109244) | 1100–? | death year none vs Wikidata 1085 (known only roughly) |
| [Afanasy Nikitin](https://www.wikidata.org/wiki/Q48624) | 1500–? | death year 1475 is before the birth year on file (1500) |
| [Aristidis of Athens](https://www.wikidata.org/wiki/Q349916) | 150–? | death year 134 is before the birth year on file (150) |
| [Basiliscus](https://www.wikidata.org/wiki/Q193056) | 500–? | death year 476 is before the birth year on file (500) |
| [Carausius](https://www.wikidata.org/wiki/Q317232) | 300–? | death year 293 is before the birth year on file (300) |
| [Clement](https://www.wikidata.org/wiki/Q42887) | 100–? | death year 99 is before the birth year on file (100) |
| [Cornelia Salonina](https://www.wikidata.org/wiki/Q239015) | 300–? | death year 268 is before the birth year on file (300) |
| [Cosmas Indicopleustes](https://www.wikidata.org/wiki/Q355633) | 600–? | death year none vs Wikidata 550 (known only roughly) |
| [Daṇḍin](https://www.wikidata.org/wiki/Q1190757) | 501–? | death year none vs Wikidata 700 (known only roughly) |
| [Eugene III](https://www.wikidata.org/wiki/Q167610) | 1200–? | death year 1153 is before the birth year on file (1200) |
| [Eutropios](https://www.wikidata.org/wiki/Q371999) | 400–? | death year 399 is before the birth year on file (400) |
| [Galen](https://www.wikidata.org/wiki/Q8778) | 129–? | death year none vs Wikidata 300 (known only roughly) |
| [Giovanni Francesco Straparola](https://www.wikidata.org/wiki/Q387199) | 1480–? | death year none vs Wikidata 1557 (known only roughly) |
| [Gunnbjörn Ulfsson](https://www.wikidata.org/wiki/Q352985) | 950–? | death year none vs Wikidata 901 (known only roughly) |
| [Heliodorus of Emesa](https://www.wikidata.org/wiki/Q313011) | 250–? | death year none vs Wikidata 400 (known only roughly) |
| [Idris Ibn Abdallah](https://www.wikidata.org/wiki/Q438601) | 745–791 | birth year 745 vs Wikidata 2013 (too big a change for a script) |
| [John XV](https://www.wikidata.org/wiki/Q228649) | 1000–? | death year 996 is before the birth year on file (1000) |
| [Juvenal](https://www.wikidata.org/wiki/Q193800) | 55–? | death year none vs Wikidata 200 (known only roughly) |
| [Ka'b bin Zuhayr](https://www.wikidata.org/wiki/Q953200) | 700–? | death year 647 is before the birth year on file (700) |
| [Marie de France](https://www.wikidata.org/wiki/Q5617) | 1101–? | death year none vs Wikidata 1300 (known only roughly) |
| [Murasaki Shikibu](https://www.wikidata.org/wiki/Q81731) | 970–? | death year none vs Wikidata 1100 (known only roughly) |
| [Nepotianus](https://www.wikidata.org/wiki/Q367598) | 400–? | death year 350 is before the birth year on file (400) |
| [Olybrius](https://www.wikidata.org/wiki/Q193678) | 500–? | death year 472 is before the birth year on file (500) |
| [Orso Ipato](https://www.wikidata.org/wiki/Q374599) | 1000–? | death year 737 is before the birth year on file (1000); pin 343 km from birthplace Eraclea |
| [Saud bin Faisal bin Abdulaziz Al Saud](https://www.wikidata.org/wiki/Q58156) | 1940–2015 | birth year 1940 vs Wikidata 1950 (too big a change for a script) |
| [Syrianus](https://www.wikidata.org/wiki/Q1373037) | 500–? | death year 437 is before the birth year on file (500) |
| [Urban III](https://www.wikidata.org/wiki/Q171520) | 1200–? | death year 1187 is before the birth year on file (1200) |
| [Vicente Yáñez Pinzón](https://www.wikidata.org/wiki/Q312765) | 1462–? | death year none vs Wikidata 1600 (known only roughly) |
| [Victorinus](https://www.wikidata.org/wiki/Q333770) | 300–? | death year 271 is before the birth year on file (300) |
| [al-Jazari](https://www.wikidata.org/wiki/Q81627) | 1164–1206 | birth year 1164 vs Wikidata 1136 (too big a change for a script) |
