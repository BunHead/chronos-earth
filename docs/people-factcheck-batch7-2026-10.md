# People fact-check, batch 7 (October 2026): 200 people from the middle of the list

Batch 6 (PR #85) checked the 500 most notable people and found 1.4% wrong. It suggested checking the middle of the list too. This batch does that.

**What was checked:** 200 people with notability 30 to 60, none checked before (#50, batches 2 to 6). They were picked evenly across regions (Europe, North America, Latin America, Africa, Middle East and Caucasus, South Asia, East Asia, South-East Asia, Oceania, Central Asia and Siberia) and eras (before 500, 500 to 1499, 1500 to 1799, 1800s, 1900s): up to 5 people from each region-and-era group. Each was compared with Wikidata (name, birth P569, death P570, birthplace P19 and its P625; the pin must be within 5 km of the birthplace), and every row was read by eye. Unclear cases were checked by web search (Wikipedia cannot be opened from the work container).

## Totals

- Checked: **200**
- Fixed: **13** (6.5%): 12 wrong pins, 1 wrong death year. All names were right.
- Still uncertain: **12** more. The birthplace or date is not known; the panel now says so. Nothing was guessed. (5 of the 13 fixes also carry a "sources differ" note.)
- Already right: **175**

**The error rate is higher here: 6.5%, against 1.4% for the most notable people.** Most mistakes are one kind: Wikidata gives only a region, province or country as the birthplace, so the pin sits in the middle of that region (8 of the 12 pins).

## Fixes

| Person | Old | New | Source |
|---|---|---|---|
| Colin MacLaurin | Melbourne, **Australia** (Wikidata's "The Manse" is a house there) | Kilmodan, Argyll, Scotland | [Q8755](https://www.wikidata.org/wiki/Q8755), [MacTutor](https://mathshistory.st-andrews.ac.uk/Biographies/Maclaurin/) |
| Paul Kruger | whole-degree "Cape Colony" spot on the west coast | Steynsburg (Bulhoek farm), 760 km. Birthplace disputed, panel says so | [Q244407](https://www.wikidata.org/wiki/Q244407), [SAHO](https://www.sahistory.org.za/people/stephanus-johannes-paulus-kruger) |
| Huascar | middle of Peru | Cusco (probably Huascarpata nearby), 630 km | [Q213749](https://www.wikidata.org/wiki/Q213749), [biografiasyvidas](https://www.biografiasyvidas.com/biografia/h/huascar.htm) |
| Nguyễn Du | middle of Hà Tĩnh province | Thăng Long (Hanoi), 300 km | [Q313322](https://www.wikidata.org/wiki/Q313322), [Wikipedia](https://en.wikipedia.org/wiki/Nguy%E1%BB%85n_Du) |
| José Antonio Páez | Caracas | Acarigua (born at Curpa nearby), 270 km | [Q304900](https://www.wikidata.org/wiki/Q304900), [Britannica](https://www.britannica.com/biography/Jose-Antonio-Paez) |
| Moshoeshoe I | middle of Lesotho | Menkhoaneng, Leribe, 74 km | [Q469775](https://www.wikidata.org/wiki/Q469775), [SAHO](https://www.sahistory.org.za/people/king-moshoeshoe-i) |
| Prithvi Narayan Shah | middle of Gorkha District | Gorkha Palace, 31 km | [Q574450](https://www.wikidata.org/wiki/Q574450), [Q66133854](https://www.wikidata.org/wiki/Q66133854) |
| Quang Trung | middle of Bình Định province | Tây Sơn, 30 km | [Q379775](https://www.wikidata.org/wiki/Q379775), [Wikipedia](https://en.wikipedia.org/wiki/Quang_Trung) |
| Lê Duẩn | middle of Quảng Trị province | Hậu Kiên, Triệu Phong, 22 km | [Q466001](https://www.wikidata.org/wiki/Q466001), [Tuổi Trẻ](https://tuoitre.vn/dang-hoa-dang-huong-tuong-niem-115-nam-ngay-sinh-tong-bi-thu-le-duan-20220407133825902.htm) |
| Patrick Henry | middle of Hanover County | Studley, 20 km | [Q311885](https://www.wikidata.org/wiki/Q311885) |
| William Clark | middle of Caroline County | Ladysmith, 14.5 km | [Q355348](https://www.wikidata.org/wiki/Q355348) |
| Richard Walther Darré | centre of Buenos Aires | Belgrano, Buenos Aires, 8 km | [Q60145](https://www.wikidata.org/wiki/Q60145) |
| Ibn Yunus | died **958** | died **1009** | [Q459921](https://www.wikidata.org/wiki/Q459921), [MacTutor](https://mathshistory.st-andrews.ac.uk/Biographies/Yunus/) |

The "Born" line was updated to match the new pin where it named the region.

## Uncertain (the panel now says so)

- **Birthplace not known** (pin is the middle of a region): Candrakīrti (South India), Tomoe Gozen (Japan), Emperor Zhang of Han (China), Poros (Punjab), Moses the Black (Africa), Qutb-ud-din Aibak (Central Asia), Phillis Wheatley (Senegambia), Kujula Kadphises (Bactria), King Wu of Zhou (Shaanxi), al-Khansāʼ (Najd)
- **Dates not known:** Hua Tuo (shown born 200, a placeholder; died 208), Artemidorus (born and died shown as 200), plus Candrakīrti, Tomoe Gozen, Poros, Kujula Kadphises, King Wu of Zhou
- **Sources differ** (fixed, with a note): Paul Kruger (three farms named), Nguyễn Du (1765 or 1766), Quang Trung (1752 or 1753), Huascar (1490 or 1491), Moshoeshoe I (1780 to 1794)

## Is another batch worthwhile?

Yes, but a targeted one rather than another random 200. Most mistakes here are people whose Wikidata birthplace is a region, province or country, and a script can find those: ask Wikidata which birthplaces are countries, provinces, states, counties or regions, and list those people. Then fix them by hand as here.
