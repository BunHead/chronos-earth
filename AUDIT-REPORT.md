# Chronos Earth — Monument & Battle Audit

_Generated 2026-08-27 11:22 by `npm run audit`. Reads only; changes nothing._

This is the worksheet for the "old template" problem. It lists every monument
and battle, the 3D archetype the app hands it, **how** it got that archetype,
and every entry that looks wrong, generic, out-of-period, or frozen in time.

## At a glance

- **Monuments checked:** 716  (19 curated sites + 697 imported)
- Monuments with a 3D model: **136** · with no 3D button: **580**
- **Battles checked:** 1227  (92 named + 1135 imported)
- Battles with hand-crafted phased choreography: **34** · running the generic template: **1193**

### Flags raised (monuments)

| Count | Flag |
|------:|------|
| 5 | 🔴 False-friend keyword (probably the wrong model) |
| 10 | 🟡 Known to have been destroyed/rebuilt — deserves phases over time |
| 580 | ⚪ No 3D model at all (panel only, no "View in 3D") |

## Worst offenders (top 40)

The entries most worth fixing first, hardest-first by severity.

| Monument | Date | Source | Model | How it was chosen | Problems |
|----------|------|--------|-------|-------------------|----------|
| Fort Jesus Museum | 1593 CE | imported event | castle | castle/fort/palace keyword (word-boundaried) | suspicious keyword |
| Drottningholm Palace Theatre | 1766 CE | imported event | castle | castle/fort/palace keyword (word-boundaried) | suspicious keyword |
| Sydney Opera House | 1973 CE | imported event | opera-house | Sydney Opera House keyword (Sydney-specific — not a generic opera house) | suspicious keyword |
| Sydney Opera House | 1973 CE | imported event | opera-house | Sydney Opera House keyword (Sydney-specific — not a generic opera house) | suspicious keyword |
| Royal Palace Museum | 1988 CE | imported event | castle | castle/fort/palace keyword (word-boundaried) | suspicious keyword |
| Hagia Sophia | 537 CE | imported event | — | no keyword matched → no 3D button | no 3d; should be phased |
| Lighthouse of Alexandria (Pharos) | 280 BCE | curated site | pharos | explicit .model field | should be phased |
| Parthenon | 438 BCE | imported event | greek-temple | greek-temple keyword | should be phased |
| Colosseum | 80 CE | imported event | amphitheatre | amphitheatre keyword | should be phased |
| Colosseum | 82 CE | imported event | amphitheatre | amphitheatre keyword | should be phased |
| Nottingham Castle | 1068 CE | imported event | castle | castle/fort/palace keyword (word-boundaried) | should be phased |
| Notre-Dame de Chartres | 1145 CE | imported event | cathedral | cathedral/church keyword | should be phased |
| Notre-Dame d'Amiens | 1220 CE | imported event | cathedral | cathedral/church keyword | should be phased |
| Notre-Dame de Paris | 1345 CE | imported event | cathedral | cathedral/church keyword | should be phased |
| Ruins of St. Paul's | 1602 CE | imported event | st-pauls | St Paul's Cathedral keyword (before the cathedral bucket) | should be phased |
| Blombos Cave engravings | 71000 BCE | imported event | — | no keyword matched → no 3D button | no 3d |
| Sulawesi cave paintings | 42000 BCE | imported event | — | no keyword matched → no 3D button | no 3d |
| Chauvet Cave paintings | 34000 BCE | imported event | — | no keyword matched → no 3D button | no 3d |
| Altamira cave art | 33000 BCE | imported event | — | no keyword matched → no 3D button | no 3d |
| Lascaux cave paintings | 15000 BCE | imported event | — | no keyword matched → no 3D button | no 3d |
| Creswell Crags cave art | 11000 BCE | imported event | — | no keyword matched → no 3D button | no 3d |
| Uluru (Ayers Rock) | 10000 BCE | imported event | — | no keyword matched → no 3D button | no 3d |
| Göbekli Tepe | 9999 BCE | imported event | — | no keyword matched → no 3D button | no 3d |
| Tell es-Sultan | 9600 BCE | imported event | — | no keyword matched → no 3D button | no 3d |
| Byblos | 8000 BCE | imported event | — | no keyword matched → no 3D button | no 3d |
| Bhimbetka rock art | 8000 BCE | imported event | — | no keyword matched → no 3D button | no 3d |
| Çatalhöyük | 7499 BCE | imported event | — | no keyword matched → no 3D button | no 3d |
| Cueva de las Manos (Cave of Hands) | 7300 BCE | imported event | — | no keyword matched → no 3D button | no 3d |
| Khirokitia | 7000 BCE | imported event | — | no keyword matched → no 3D button | no 3d |
| Mehrgarh | 6999 BCE | imported event | — | no keyword matched → no 3D button | no 3d |
| Susa | 3999 BCE | imported event | — | no keyword matched → no 3D button | no 3d |
| Ur | 3799 BCE | imported event | — | no keyword matched → no 3D button | no 3d |
| Megalithic Temples of Malta | 3599 BCE | imported event | — | no keyword matched → no 3D button | no 3d |
| Brú na Bóinne | 3499 BCE | imported event | — | no keyword matched → no 3D button | no 3d |
| Thebes | 3199 BCE | imported event | — | no keyword matched → no 3D button | no 3d |
| Troy | 2999 BCE | imported event | — | no keyword matched → no 3D button | no 3d |
| Mari | 2900 BCE | imported event | — | no keyword matched → no 3D button | no 3d |
| Mohenjo-daro | 2500 BCE | imported event | — | no keyword matched → no 3D button | no 3d |
| Assur | 2499 BCE | imported event | — | no keyword matched → no 3D button | no 3d |
| Acre | 1499 BCE | imported event | — | no keyword matched → no 3D button | no 3d |

## Full lists by problem

### 🔴 False-friend keyword (probably the wrong model) — 5

- **Fort Jesus Museum** (1593 CE, imported event) → `castle` — _castle/fort/palace keyword (word-boundaried)_
- **Drottningholm Palace Theatre** (1766 CE, imported event) → `castle` — _castle/fort/palace keyword (word-boundaried)_
- **Sydney Opera House** (1973 CE, imported event) → `opera-house` — _Sydney Opera House keyword (Sydney-specific — not a generic opera house)_
- **Sydney Opera House** (1973 CE, imported event) → `opera-house` — _Sydney Opera House keyword (Sydney-specific — not a generic opera house)_
- **Royal Palace Museum** (1988 CE, imported event) → `castle` — _castle/fort/palace keyword (word-boundaried)_

### 🟡 Known to have been destroyed/rebuilt — deserves phases over time — 10

- **Parthenon** (438 BCE, imported event) → `greek-temple` — _greek-temple keyword_
- **Lighthouse of Alexandria (Pharos)** (280 BCE, curated site) → `pharos` — _explicit .model field_
- **Colosseum** (80 CE, imported event) → `amphitheatre` — _amphitheatre keyword_
- **Colosseum** (82 CE, imported event) → `amphitheatre` — _amphitheatre keyword_
- **Hagia Sophia** (537 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Nottingham Castle** (1068 CE, imported event) → `castle` — _castle/fort/palace keyword (word-boundaried)_
- **Notre-Dame de Chartres** (1145 CE, imported event) → `cathedral` — _cathedral/church keyword_
- **Notre-Dame d'Amiens** (1220 CE, imported event) → `cathedral` — _cathedral/church keyword_
- **Notre-Dame de Paris** (1345 CE, imported event) → `cathedral` — _cathedral/church keyword_
- **Ruins of St. Paul's** (1602 CE, imported event) → `st-pauls` — _St Paul's Cathedral keyword (before the cathedral bucket)_

### ⚪ No 3D model at all (panel only, no "View in 3D") — 580

- **Blombos Cave engravings** (71000 BCE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Sulawesi cave paintings** (42000 BCE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Chauvet Cave paintings** (34000 BCE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Altamira cave art** (33000 BCE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Lascaux cave paintings** (15000 BCE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Creswell Crags cave art** (11000 BCE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Uluru (Ayers Rock)** (10000 BCE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Göbekli Tepe** (9999 BCE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Tell es-Sultan** (9600 BCE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Byblos** (8000 BCE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Bhimbetka rock art** (8000 BCE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Çatalhöyük** (7499 BCE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Cueva de las Manos (Cave of Hands)** (7300 BCE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Khirokitia** (7000 BCE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Mehrgarh** (6999 BCE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Susa** (3999 BCE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Ur** (3799 BCE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Megalithic Temples of Malta** (3599 BCE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Brú na Bóinne** (3499 BCE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Thebes** (3199 BCE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Troy** (2999 BCE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Mari** (2900 BCE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Mohenjo-daro** (2500 BCE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Assur** (2499 BCE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Poverty Point earthworks** (1700 BCE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Acre** (1499 BCE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Carchemish** (1320 BCE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Abu Simbel** (1273 BCE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Chavín de Huántar** (1200 BCE, imported event) → `no model` — _no keyword matched → no 3D button_
- **La Venta (Olmec)** (900 BCE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Meroë (Kush)** (800 BCE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Petra** (799 BCE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Erebuni Fortress** (781 BCE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Aigai** (749 BCE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Leptis Magna** (700 BCE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Shahrisabz** (700 BCE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Cyrene** (629 BCE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Tipasa** (600 BCE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Verona** (549 BCE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Persepolis** (515 BCE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Persepolis** (510 BCE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Porta Urbica** (400 BCE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Volubilis** (399 BCE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Appian Way** (311 BCE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Seleucia** (304 BCE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Petra** (300 BCE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Great Serpent Mound** (300 BCE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Nicomedia** (263 BCE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Terracotta Army** (247 BCE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Terracotta Army** (210 BCE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Italica** (205 BCE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Ajanta Caves** (200 BCE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Nazca Lines** (200 BCE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Nazca Lines** (199 BCE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Walls of Jerusalem** (18 BCE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Trinidad and the Valley de los Ingenios** (16 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Bath** (43 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Tower of Hercules** (100 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Limes Dacicus** (106 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Tiwanaku** (110 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Hadrian's Wall** (122 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Antonine Wall** (142 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Bagan** (200 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Palenque (Maya)** (226 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Calakmul (Maya)** (250 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Temple of Anahita at Bishapur** (266 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Iwan-e Mosaic** (266 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Church of the Nativity** (327 CE, imported event) → `no model` — _suppressed — a generic model would misrepresent it_
- **Yaxchilán (Maya)** (359 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Quiriguá (Maya)** (426 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Derbent** (438 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **iron pillar of Delhi** (500 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Hagia Sophia** (537 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Bonampak — the painted rooms** (580 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Itsukushima Shrine** (593 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Mesa Verde** (600 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Danevirke** (600 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Alodia** (600 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Tmutarakan** (600 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Armenian Monastic Ensembles of Iran** (601 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Descent of the Ganges** (650 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Xochicalco** (650 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Kairouan** (670 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Dome of the Rock** (691 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Al-Aqsa Mosque** (710 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Madara Rider** (710 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Borobudur** (750 CE, imported event) → `no model` — _suppressed — a generic model would misrepresent it_
- **Mosque-Cathedral of Cordoba** (786 CE, imported event) → `no model` — _suppressed — a generic model would misrepresent it_
- **Pattadakal Group of Monuments** (800 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Birka and Hovgården** (800 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Borobudur Temple** (800 CE, imported event) → `no model` — _suppressed — a generic model would misrepresent it_
- **Aachen Cathedral** (801 CE, imported event) → `no model` — _suppressed — a generic model would misrepresent it_
- **Leshan Giant Buddha** (803 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Chan Chan** (850 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Chaco Canyon** (850 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Falun Mine** (900 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Mont-Saint-Michel** (1000 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Major Oak, Sherwood Forest** (1000 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Madinat Al-Zahra** (1000 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Falun Mine** (1000 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Qal'at Bani Hammad** (1007 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Saint Sophia Cathedral** (1011 CE, imported event) → `no model` — _suppressed — a generic model would misrepresent it_
- **Cahokia** (1050 CE, imported event) → `no model` — _suppressed — a generic model would misrepresent it_
- **Wartburg** (1067 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Hohensalzburg Fortress** (1077 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Speyer Cathedral** (1080 CE, imported event) → `no model` — _suppressed — a generic model would misrepresent it_
- **Peveril Castle** (1086 CE, imported event) → `no model` — _suppressed — a generic model would misrepresent it_
- **Haddon Hall** (1087 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Great Zimbabwe** (1100 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Burana Tower** (1100 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Western Xia Mausoleums** (1100 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Tournai Cathedral** (1101 CE, imported event) → `no model` — _suppressed — a generic model would misrepresent it_
- **Studenica monastery** (1101 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Gelati Monastery** (1106 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Angkor Wat** (1122 CE, imported event) → `no model` — _suppressed — a generic model would misrepresent it_
- **Maulbronn Monastery** (1147 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Poblet Monastery** (1150 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Newstead Abbey** (1170 CE, imported event) → `no model` — _suppressed — a generic model would misrepresent it_
- **pont Saint-Bénézet** (1177 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Nan Madol** (1180 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Walls of Benin City** (1180 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Rock churches of Lalibela** (1181 CE, imported event) → `no model` — _suppressed — a generic model would misrepresent it_
- **Alcobaça Monastery** (1187 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Ye Olde Trip to Jerusalem** (1189 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Minaret of Jam** (1194 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Spišská Kapitula** (1200 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Angkor Wat** (1200 CE, imported event) → `no model` — _suppressed — a generic model would misrepresent it_
- **Tulum — the walled port** (1200 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Konark Sun Temple** (1201 CE, imported event) → `no model` — _suppressed — a generic model would misrepresent it_
- **Geghard** (1215 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Karakorum** (1220 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Alhambra** (1238 CE, imported event) → `no model` — _suppressed — a generic model would misrepresent it_
- **Castel del Monte** (1240 CE, imported event) → `no model` — _suppressed — a generic model would misrepresent it_
- **Great Mosque of Djenné** (1240 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Moai (Rapa Nui)** (1250 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Königsberg** (1255 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Malbork Castle** (1270 CE, imported event) → `no model` — _suppressed — a generic model would misrepresent it_
- **The Great Mosque of New Fez** (1276 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Castles and Town Walls of King Edward in Gwynedd** (1280 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Medina of Tétouan** (1305 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Gračanica monastery** (1315 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Ponte Vecchio** (1335 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Visoki Dečani** (1335 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Trinity Lavra of St. Sergius** (1337 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Himeji Castle** (1346 CE, imported event) → `no model` — _suppressed — a generic model would misrepresent it_
- **Historic City of Ayutthaya** (1350 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Phra Ratchawang Boran** (1351 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Chesterfield Crooked Spire** (1362 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Bruges City Hall** (1377 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Batalha Monastery** (1386 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Ferapontov Monastery** (1398 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Ruins of Loropéni** (1400 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Mausoleum of Khoja Ahmed Yasawi** (1400 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Town Hall of Bremen** (1400 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Santa Maria delle Grazie** (1401 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Forbidden City** (1420 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Tour Pey-Berland** (1440 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Machu Picchu** (1450 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Machu Picchu** (1450 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Cidade Velha** (1462 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Elmina Castle** (1482 CE, imported event) → `no model` — _suppressed — a generic model would misrepresent it_
- **A-Ma Temple** (1488 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Tomb of Askia** (1495 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **San Cristóbal de La Laguna** (1496 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Colegio Mayor de San Ildefonso** (1499 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **University and Historic Precinct of Alcalá de Henares** (1499 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **El Camino Real de Tierra Adentro** (1500 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Mazagan** (1502 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Jerónimos Monastery** (1502 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Château de Chambord** (1519 CE, imported event) → `no model` — _suppressed — a generic model would misrepresent it_
- **Ruínas de León Viejo** (1524 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Novodevichy Convent** (1524 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Iwami Ginzan Silver Mine** (1527 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **La Fortaleza and San Juan National Historic Site** (1533 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Santa Cruz de Mompós** (1537 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Sacro Monte di Ossuccio** (1537 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Historic City of Sucre** (1538 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Sosu Seowon** (1543 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Renaissance facade of the Colegio Mayor de San Ildefonso, University of Alcalá** (1543 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Padova botanical garden** (1545 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Monastery of San Francisco** (1546 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Salvador** (1549 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Historic Centre of Salvador da Bahia** (1549 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Chatsworth House** (1553 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Sviyazhsk Assumption Monastery** (1555 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Cusco Cathedral** (1559 CE, imported event) → `no model` — _suppressed — a generic model would misrepresent it_
- **Saint Basil's Cathedral** (1561 CE, imported event) → `no model` — _suppressed — a generic model would misrepresent it_
- **Agra Fort** (1565 CE, imported event) → `no model` — _suppressed — a generic model would misrepresent it_
- **Selimiye Mosque** (1575 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Wollaton Hall** (1580 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Old City of Zamość** (1580 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Hardwick Hall** (1590 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Paraty** (1597 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Naqsh-e Jahan Square** (1598 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Shibam** (1600 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Sacred Mijikenda Kaya Forests** (1600 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Varlaam monastery** (1600 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **College of the Company of Jesus** (1608 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Jesuit missions among the Guaraní** (1609 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Palazzo Gio Battista Grimaldi** (1610 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Palazzo Centurione Gio. Battista** (1611 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Fortaleza do Monte** (1617 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Palazzo Giacomo Lomellini** (1623 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Gardens of Versailles** (1624 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Taj Mahal** (1631 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Taj Mahal** (1643 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Santa Maria della Concezione** (1651 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Capilla de Loreto** (1653 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Palace of Versailles** (1661 CE, imported event) → `no model` — _suppressed — a generic model would misrepresent it_
- **Palazzo Gio Carlo Brignole** (1671 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Palazzo Rosso** (1677 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Grand-Pré** (1680 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Engelsberg Ironworks** (1681 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Horezu monastery** (1687 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Duchess Anna Amalia Library** (1691 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Grünhirscher Stollen** (1692 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Drottningholm Palace** (1699 CE, imported event) → `no model` — _suppressed — a generic model would misrepresent it_
- **Antigua Naval Dockyard and Related Archaeological Sites** (1704 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Blenheim Palace** (1705 CE, imported event) → `no model` — _suppressed — a generic model would misrepresent it_
- **Kizhi Pogost** (1714 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Holy Trinity Column in Olomouc** (1715 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Karlskirche** (1716 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Jaipur** (1727 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Jantar Mantar** (1738 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Margravial Opera House** (1744 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Suomenlinna** (1748 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Blue John Cavern** (1750 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Sanctuary of the Madonna di San Luca** (1750 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Independence Hall** (1753 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Wieskirche** (1754 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Sanctuary of Bom Jesus de Matosinhos** (1757 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Aachen Chapel of Hungary** (1764 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Plaza de toros de Acho** (1766 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Fortkerk** (1769 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Bom Jesus do Monte** (1772 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Christiansfeld** (1773 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Via Cairoli** (1778 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Park an der Ilm** (1778 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Dessau-Wörlitz Garden Realm** (1780 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Eise Eisinga Planetarium** (1781 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **General Archive of the Indies** (1785 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Römisches Haus, Weimar** (1790 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Brandenburg Gate** (1791 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Sam Kai Vui Kun** (1792 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Clarence House** (1804 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Hospicio Cabañas** (1810 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Valongo Wharf** (1811 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Napoleonsturm** (1812 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Muskau Park** (1815 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Marceau-Denkmal** (1820 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **El Templete** (1827 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Altes Museum** (1830 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Babelsberg Park** (1833 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Astronomical Observatory of the University of Kazan** (1837 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Royal Armoury of Turin** (1837 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Igreja da Sé** (1844 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Tlacotalpan** (1847 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Zollverein Coal Mine Industrial Complex** (1847 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Ernst-August-Stollen** (1851 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Victoria Falls** (1855 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Singapore Botanic Gardens** (1859 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Santiniketan** (1863 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Residence of Bukovinian and Dalmatian Metropolitans** (1864 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Kyoto Prefecture** (1868 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Neuschwanstein Castle** (1869 CE, imported event) → `no model` — _suppressed — a generic model would misrepresent it_
- **Metz-Chambieres National Cemetery** (1870 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **King's House on Schachen** (1871 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Yellowstone National Park** (1872 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Yellowstone** (1872 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Crespi d'Adda** (1877 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Museum Plantin-Moretus** (1877 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Herrenchiemsee** (1878 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Fort de Loncin** (1881 CE, imported event) → `no model` — _suppressed — a generic model would misrepresent it_
- **Basilica and Expiatory Church of the Holy Family** (1882 CE, imported event) → `no model` — _suppressed — a generic model would misrepresent it_
- **Sagrada Família** (1882 CE, imported event) → `no model` — _suppressed — a generic model would misrepresent it_
- **Palazzo Bianco** (1884 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Neuschwanstein Castle** (1886 CE, imported event) → `no model` — _suppressed — a generic model would misrepresent it_
- **Tongariro National Park** (1887 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Sawahlunto** (1888 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Yosemite National Park** (1890 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Forth Bridge** (1890 CE, imported event) → `no model` — _suppressed — a generic model would misrepresent it_
- **Artists' Colony in Darmstadt** (1899 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Alminhas da Ponte** (1900 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Belvedere on the Pfingstberg** (1900 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Kaziranga National Park** (1905 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Salesian School of Cusco** (1905 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Stoclet Palace** (1905 CE, imported event) → `no model` — _suppressed — a generic model would misrepresent it_
- **Mesa Verde National Park** (1906 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Stora Sjöfallet National Park** (1909 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Tower of Iglesia de San Salvador** (1911 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Fagus Factory** (1911 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Centennial Hall** (1911 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **EDNI-020-P Teniente Club** (1914 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **EDNI-102-P Engineers office building** (1914 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Cutting National Cemetery** (1914 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Prowse Point Military Cemetery** (1914 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Ploegsteert Wood Military Cemetery** (1914 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Rifle House Cemetery** (1914 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Assevent French-German War Cemetery** (1914 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Strand Military Cemetery** (1914 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Hiroshima Peace Memorial** (1915 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Trottoir National Cemetery** (1915 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Wettstein National Cemetery** (1915 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **28th Brigade - La Ferme des Wacques National Cemetery** (1915 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Étaples Military Cemetery** (1915 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Hyde Park Corner (Royal Berks) Cemetery** (1915 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Berks Cemetery Extension** (1915 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Essex Farm Cemetery** (1915 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Hedge Row Trench Cemetery** (1915 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Woods Cemetery** (1915 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Bedford House Cemetery** (1915 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **First DCLI Cemetery, The Bluff** (1915 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Larch Wood (Railway Cutting) Cemetery** (1915 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Louvencourt Military Cemetery** (1915 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Hawaiʻi Volcanoes National Park** (1916 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **EDNI-103-P Staff house building** (1916 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Rancourt Military Cemetery** (1916 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Hunter's Cemetery** (1916 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Faubourg d'Amiens Cemetery** (1916 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **EDNI-106-P Public institutions building** (1917 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Tyne Cot Cemetery** (1917 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Canadian Cemetery No. 2** (1917 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Mill Road Cemetery** (1917 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Mud Corner Cemetery** (1917 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Givenchy Road Canadian Cemetery** (1917 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Track "X" Cemetery** (1917 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Buffs Road Cemetery** (1917 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **La Targette British Cemetery** (1917 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Toronto Avenue Cemetery** (1917 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Lichfield Crater, Thelus** (1917 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Louverval Military Cemetery** (1917 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Welsh Cemetery (Caesar's Nose)** (1917 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **No Man's Cot Cemetery** (1917 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Meuse-Argonne American Cemetery** (1918 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Italian Military Cemetery of Bligny** (1918 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Le Quesnoy Communal Cemetery Extension** (1918 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Grand Canyon National Park** (1919 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Grand Canyon** (1919 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Choquechaka street** (1919 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **EDNI-157-P Grand Hospital** (1919 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Saint-Benoît-la-Chipotte National Cemetery** (1919 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Neuville-St Vaast German war cemetery** (1919 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Douaumont ossuary** (1920 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Cuts National Cemetery** (1920 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Pierrepont National Cemetery** (1920 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Hohrod German war cemetery** (1920 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Delville Wood Cemetery** (1920 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Skogskyrkogården** (1920 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Rancourt German military cemetery** (1921 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Notre Dame de Lorette National Cemetery** (1921 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Wood Buffalo National Park** (1922 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Selous Game Reserve** (1922 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Sarrebourg National Prisoners of War Cemetery** (1922 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Hartmannswillerkopf National Monument** (1922 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Haute-Chevauchée ossuary** (1922 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **La Fontenelle National Cemetery** (1923 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Vauquois National Cemetery** (1923 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Saint Julien Memorial** (1923 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Richebourg-L'Avoue Portuguese National Cemetery** (1923 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Navarin Ossuary: Monument to the Dead of the Champagne Armies** (1924 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Craonnelle National Cemetery** (1924 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Rietveld Schröder House** (1924 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Virunga National Park** (1925 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Delville Wood South African National Memorial** (1926 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Menin Gate** (1927 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Nieuport Memorial** (1928 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Vatican City** (1929 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Fleury-devant-Douaumont National Cemetery** (1929 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Carlsbad Caverns National Park** (1930 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Yser Tower** (1930 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Cambrai Memorial to the Missing** (1930 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Loos Memorial** (1930 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Villa Tugendhat** (1930 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Empire State Building** (1931 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Christ the Redeemer** (1931 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Van Nelle Factory** (1931 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Ploegsteert Memorial to the Missing** (1931 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Thiepval Anglo-French Cemetery** (1931 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Waterton-Glacier International Peace Park** (1932 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Białowieża Forest** (1932 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **EDNI-165-P Movie theater building** (1932 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Thiepval Memorial** (1932 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Arras Memorial** (1932 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Arras Flying Services Memorial** (1932 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Iguazú National Park** (1934 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Great Smoky Mountains National Park** (1934 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Hospital Antonio Lorena** (1934 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Odzala National Park** (1935 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **'The Ghosts'** (1935 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Freedom Monument** (1935 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Rapa Nui National Park** (1935 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **EDNI-129-K Educational building** (1936 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **EDNI-125-K Commercial and residential building** (1936 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Beit She'arim National Park** (1936 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Los Glaciares National Park** (1937 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Los Alerces National Park** (1937 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Golden Gate Bridge** (1937 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Olympic National Park** (1938 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **EDNI-035-P Workers families residential building** (1938 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Garamba National Park** (1938 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Tigrovaya Balka Nature Reserve** (1938 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Villers–Bretonneux Australian National Memorial** (1938 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Monument to Jewish Fallen Soldiers** (1938 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Sculptural Ensemble of Constantin Brâncuși at Târgu Jiu** (1938 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Iguaçu National Park** (1939 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Auschwitz** (1940 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **EDNI-150 Singles residential building** (1940 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Mammoth Cave National Park** (1941 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Mount Rushmore** (1941 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Pampulha Modern Ensemble** (1943 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **The Beit HaHamera clandestine weapons cache in Kibbutz Na’an** (1943 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Mount Nimba Strict Nature Reserve** (1944 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Cristo Blanco** (1945 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **EDNI-152-K Family residential building** (1945 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **EDNI-042-P Residential building** (1945 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Everglades National Park** (1947 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Srebarna Nature Reserve** (1948 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Plitvice Lakes National Park** (1949 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Mount Kenya National Park** (1949 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **stadiums of the Ciudad Universitaria** (1950 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Chemin des Dames Memorial Chapel** (1950 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Lake District** (1951 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Durmitor National Park** (1952 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **National Archaeological Museum of Paestum** (1952 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Mount Everest (first summit)** (1953 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Secretariat Building** (1953 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Teide National Park** (1954 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Niokolo-Koba National Park** (1954 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Ciudad Universitaria** (1954 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Dinosaur Provincial Park** (1955 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Pampulha art museum** (1957 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Writing-on-Stone Provincial Park** (1957 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Uluṟu-Kata Tjuṯa National Park** (1958 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **EDNI-501-K Concrete residential building** (1958 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Sir Robert Ho Tung Library** (1958 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Ngorongoro Conservation Area** (1959 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Brasília** (1960 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Church of Cristo Obrero y Nuestra Señora de Lourdes** (1960 CE, imported event) → `no model` — _suppressed — a generic model would misrepresent it_
- **Plano Piloto** (1960 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Museu Historico de Sergipe** (1960 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Tijuca Forest** (1961 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Canaima National Park** (1962 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Pirin National Park** (1962 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Surtsey** (1963 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Kinabalu Park** (1964 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Kapova Cave** (1965 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Gobustan State Historical and Cultural Reserve** (1966 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Vallée de Mai** (1966 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Solovetsky state Museum-reserve** (1967 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Redwood National and State Parks** (1968 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Comoé National Park** (1968 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Museum of Sacred Art** (1969 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Simien Mountains National Park** (1969 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Doñana National Park** (1969 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Bale Mountains National Park** (1969 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Salonga National Park** (1970 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Kahuzi-Biéga National Park** (1970 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Kevladev National Park** (1971 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Djoudj National Bird Sanctuary** (1971 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Taï National Park** (1972 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Manu National Park** (1973 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Chitwan National Park** (1973 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Kilimanjaro National Park** (1973 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Römerkastell Halheim** (1973 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Hortobágy National Park** (1973 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Los Katíos National Park** (1974 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Gunung Mulu National Park** (1974 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Niah National Park** (1974 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Thungyai Naresuan Wildlife Sanctuary** (1974 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Huascarán National Park** (1975 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Morne Trois Pitons National Park** (1975 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Old Town of Lviv** (1975 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Nahanni National Park Reserve** (1976 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Sagarmatha National Park** (1976 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Banc d'Arguin National Park** (1976 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Khangchendzonga National Park** (1977 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Jiuzhaigou Valley** (1978 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Sinharaja Forest Reserve** (1978 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Serra da Capivara National Park** (1979 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Sangay National Park** (1979 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Noel Kempff Mercado National Park** (1979 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Kakadu National Park** (1979 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Manovo-Gounda St. Floris National Park** (1979 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Jaú National Park** (1980 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Darién National Park** (1980 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Komodo National Park** (1980 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Ujung Kulon National Park** (1980 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Lake Malawi National Park** (1980 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Ichkeul National Park** (1980 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Ancient City of Bosra** (1980 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Chiang Kai-shek Memorial Hall** (1980 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Lençóis Maranhenses National Park** (1981 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Great Barrier Reef** (1981 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Willandra Lakes Region** (1981 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Kakadu National Park** (1981 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Historic Sanctuary of Machu Picchu** (1981 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Palenque  National Park** (1981 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Garajonay National Park** (1981 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Río Plátano Biosphere Reserve** (1982 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Tasmanian Wilderness** (1982 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Nanda Devi National Park** (1982 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Río Abiseo National Park** (1983 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Canadian Rocky Mountain Parks World Heritage Site** (1984 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Sundarbans National Park** (1984 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Mistaken Point Ecological Reserve** (1984 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Great Himalayan National Park** (1984 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Desembarco del Granma National Park** (1985 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Miguasha National Park** (1985 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Cave of Altamira and Paleolithic Cave Art of Northern Spain** (1985 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Gondwana Rainforests of Australia** (1986 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Brimstone Hill Fortress National Park** (1987 CE, imported event) → `no model` — _suppressed — a generic model would misrepresent it_
- **Purnululu National Park** (1987 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Dja Faunal Reserve** (1987 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Etna Park** (1987 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **archaeological Site of Delphi** (1987 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Wet Tropics of Queensland** (1988 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Aïr and Ténéré National Nature Reserve** (1988 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Mount Athos** (1988 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Chiribiquete National Park** (1989 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Cavernas do Peruaçu Environmental Protection Area** (1989 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Manas National Park** (1990 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Sangha Trinational** (1990 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Danube Delta** (1991 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Shark Bay** (1991 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Tsingy de Bemaraha Strict Nature Reserve** (1991 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Bwindi Impenetrable National Park** (1991 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Rwenzori Mountains National Park** (1991 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Thungyai-Huai Kha Khaeng Wildlife Sanctuaries** (1991 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Coiba** (1992 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Okapi Wildlife Reserve** (1992 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **K'gari** (1992 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Pamir National Park** (1992 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Australian Fossil Mammal Sites (Riversleigh / Naracoorte)** (1994 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Arabian Oryx Sanctuary** (1994 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Sítio Roberto Burle Marx** (1995 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Virgin Komi Forests** (1995 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Malpelo Fauna and Flora Sanctuary** (1995 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Lena Pillars** (1995 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Cultural Landscape of Sintra** (1995 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Bijagos Archipelago Biosphere Reserve** (1996 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Lorentz National Park** (1997 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Luis Barragán House and Studio** (1998 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Tehuacán-Cuicatlán Biosphere Reserve** (1998 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Cavernas do Peruaçu National Park** (1999 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Kigali Genocide Memorial** (1999 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Puerto Princesa Subterranean River National Park** (1999 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Monarch Butterfly Biosphere Reserve** (2000 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Greater Blue Mountains Area** (2000 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **iSimangaliso Wetland Park** (2000 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Romanian Military Cemetery of Soultzmatt** (2000 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Alexander von Humboldt National Park** (2001 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Phong Nha–Ke Bang National Park** (2001 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Jungfrau-Aletsch protected area** (2001 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Ivindo National Park** (2002 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Ilulissat Icefjord** (2003 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Thingvellir National Park** (2004 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Nyungwe Forest** (2004 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Mount Hamiguitan Range Wildlife Sanctuary** (2004 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Gros Morne National Park** (2005 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Shiretoko** (2005 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **El Pinacate y Gran Desierto de Altar Biosphere Reserve** (2006 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Mount Sanqing** (2008 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Vatnajökull National Park** (2008 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Burj Khalifa** (2010 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Fromelles (Pheasant Wood) Military Cemetery** (2010 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Ningaloo Reef** (2011 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Gola National Park** (2011 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Limeskastell Pohl** (2011 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Decorated Farmhouses of Hälsingland** (2012 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Murujuga National Park** (2013 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Maloti-Drakensberg Park** (2013 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **ESMA Museum and Site of Memory – Former Clandestine Center of Detention, Torture and Extermination** (2015 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Yanbaru National Park** (2016 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Serengeti National Park** (2020 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Museum of the Bamoun Kings** (2020 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Maputo National Park** (2021 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Paseo del Prado and Buen Retiro, a landscape of Arts and Sciences** (2021 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **The Slate Landscape of Northwest Wales** (2021 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Evaporitic Karst and Caves of Northern Apennines** (2023 CE, imported event) → `no model` — _no keyword matched → no 3D button_
- **Jewish-Medieval Heritage of Erfurt** (2023 CE, imported event) → `no model` — _no keyword matched → no 3D button_

## How many monuments wear each archetype

A model carrying a big share of very different buildings is a template doing
too much work (this is why every castle looks the same).

| Model | Count |
|-------|------:|
| (none) | 580 |
| cathedral | 55 |
| castle | 25 |
| stepped-pyramid | 9 |
| lighthouse | 4 |
| sphinx | 3 |
| pyramid | 3 |
| greek-temple | 3 |
| amphitheatre | 3 |
| tpillars | 2 |
| settlement | 2 |
| circle | 2 |
| stonehenge | 2 |
| megalith | 2 |
| temple-tower | 2 |
| liberty | 2 |
| opera-house | 2 |
| giza | 1 |
| impact | 1 |
| rings | 1 |
| hanging-gardens | 1 |
| artemis-temple | 1 |
| zeus-statue | 1 |
| mausoleum | 1 |
| colossus | 1 |
| pharos | 1 |
| aqueduct | 1 |
| tower-of-london | 1 |
| leaning-tower | 1 |
| st-pauls | 1 |
| westminster | 1 |
| eiffel | 1 |

## Over-time pass (the "watch it get built / burnt / rebuilt" check)

Right now the timeline year does **not** change any monument's appearance.
Only **Stonehenge** offers phases, and only via a manual selector inside its
own 3D viewer — nothing rebuilds itself as you scrub time. So every monument
below renders one fixed archetype from the moment it appears to the present.

**10** monuments in the data are on the destroyed/rebuilt seed
watchlist — these are the first candidates for a phase-over-time treatment
(built → altered → destroyed → rebuilt), the same idea as Stonehenge's phases:

- **Parthenon** (438 BCE) → currently a static `greek-temple`
- **Lighthouse of Alexandria (Pharos)** (280 BCE) → currently a static `pharos`
- **Colosseum** (80 CE) → currently a static `amphitheatre`
- **Colosseum** (82 CE) → currently a static `amphitheatre`
- **Hagia Sophia** (537 CE) → currently a static `no model`
- **Nottingham Castle** (1068 CE) → currently a static `castle`
- **Notre-Dame de Chartres** (1145 CE) → currently a static `cathedral`
- **Notre-Dame d'Amiens** (1220 CE) → currently a static `cathedral`
- **Notre-Dame de Paris** (1345 CE) → currently a static `cathedral`
- **Ruins of St. Paul's** (1602 CE) → currently a static `st-pauls`

_The watchlist is a hand-seeded starting point, not exhaustive — extend it in
`scripts/monument-archetype.mjs`'s neighbour `scripts/audit.mjs`._

## Battles — choreography coverage

Of 92 named battles, **34** have real phase-by-phase
choreography; **58** named battles + **1135** imported battles use the
generic "two lines meet in the middle" template. These named battles are the
best candidates for hand-authored, historically accurate movement next:

- **Battle of Megiddo** (1457 BCE) — id `megiddo-1457bce`
- **Battle of the Hydaspes** (326 BCE) — id `hydaspes`
- **Battle of Carrhae** (53 BCE) — id `carrhae`
- **Battle of the Milvian Bridge** (312 CE) — id `milvian-bridge`
- **Battle of Adrianople** (378 CE) — id `adrianople-378`
- **Battle of the Catalaunian Plains** (451 CE) — id `chalons`
- **Battle of Stamford Bridge** (1066 CE) — id `stamford-bridge`
- **Battle of Manzikert** (1071 CE) — id `manzikert`
- **Battle of Yehuling (Badger Mouth)** (1211 CE) — id `badger-mouth`
- **Siege of Samarkand** (1220 CE) — id `samarkand-1220`
- **Battle of the Kalka River** (1223 CE) — id `kalka-river`
- **Battle of Legnica** (1241 CE) — id `legnica`
- **Battle of Ain Jalut** (1260 CE) — id `ain-jalut`
- **Battle of Yamen** (1279 CE) — id `yamen`
- **Battle of Bannockburn** (1314 CE) — id `bannockburn`
- **Battle of Grunwald (Tannenberg)** (1410 CE) — id `grunwald`
- **Fall of Constantinople** (1453 CE) — id `constantinople-1453`
- **Battle of Bosworth Field** (1485 CE) — id `bosworth`
- **La Noche Triste** (1520 CE) — id `noche-triste`
- **Fall of Tenochtitlan** (1521 CE) — id `tenochtitlan`
- **Battle of Mohács** (1526 CE) — id `mohacs`
- **First Battle of Panipat** (1526 CE) — id `panipat-1526`
- **Battle of Cajamarca** (1532 CE) — id `cajamarca`
- **Defeat of the Spanish Armada** (1588 CE) — id `spanish-armada`
- **Battle of Naseby** (1645 CE) — id `naseby`
- **Battle of Vienna** (1683 CE) — id `vienna-1683`
- **Battle of Blenheim** (1704 CE) — id `blenheim`
- **Battle of Poltava** (1709 CE) — id `poltava`
- **Battle of Culloden** (1746 CE) — id `culloden`
- **Battle of Plassey** (1757 CE) — id `plassey`
- **Battle of the Plains of Abraham** (1759 CE) — id `plains-of-abraham`
- **Battles of Saratoga** (1777 CE) — id `saratoga`
- **Siege of Yorktown** (1781 CE) — id `yorktown`
- **Battle of Valmy** (1792 CE) — id `valmy`
- **Battle of Jena–Auerstedt** (1806 CE) — id `jena-auerstedt`
- **Battle of the Alamo** (1836 CE) — id `alamo`
- **Battle of Balaclava** (1854 CE) — id `balaclava`
- **Battle of Antietam** (1862 CE) — id `antietam`
- **Battle of Königgrätz** (1866 CE) — id `koniggratz`
- **Battle of Sedan** (1870 CE) — id `sedan`
- **Battle of the Little Bighorn** (1876 CE) — id `little-bighorn`
- **Battle of Adwa** (1896 CE) — id `adwa`
- **Battle of Tsushima** (1905 CE) — id `tsushima`
- **First Battle of the Marne** (1914 CE) — id `marne-1914`
- **Gallipoli Campaign** (1915 CE) — id `gallipoli`
- **Battle of Verdun** (1916 CE) — id `verdun`
- **Battle of Jutland** (1916 CE) — id `jutland`
- **Battle of Britain** (1940 CE) — id `britain-1940`
- **Second Battle of El Alamein** (1942 CE) — id `el-alamein`
- **Battle of Leyte Gulf** (1944 CE) — id `leyte-gulf`
- **Battle of the Bulge** (1944 CE) — id `bulge`
- **Battle of Berlin** (1945 CE) — id `berlin-1945`
- **Battle of Inchon** (1950 CE) — id `inchon`
- **Battle of Dien Bien Phu** (1954 CE) — id `dien-bien-phu`
- **Battle of Kyiv** (2022 CE) — id `battle-of-kyiv-2022`
- **Siege of Mariupol** (2022 CE) — id `siege-of-mariupol`
- **Kherson counteroffensive** (2022 CE) — id `kherson-counteroffensive`
- **Battle of Bakhmut** (2023 CE) — id `battle-of-bakhmut`
