# People fact-check, batch 6 (October 2026): spot-check of people NOT in the doubtful list

Batches 1 to 5 (PRs #50, #55/#67, #60, #65, #68, #70) checked all 705 "doubtful" people. This batch spot-checks the people the script did **not** flag, to see if the same mistakes are hiding there.

**What was checked:** the 500 most notable people (by notability) who were not in the doubtful list and had no earlier fix. The first 200 were the ask; the next 300 were added because the error rate was low and the check was cheap. Each was compared with Wikidata (birth P569, death P570, birthplace P19 and its P625, name), with a tighter 5 km test (the first script used 50 km). Every person was also read by eye, because two of the mistakes (Jane Austen, Tacitus) agreed with one Wikidata value and could not be caught by a script. Wikipedia could not be opened from the work container, so the less clear cases were confirmed by web search.

## Totals

- Checked: **500** (200 asked for + 300 more)
- Fixed: **7** (1.4%), all wrong pins. No wrong years or names were found.
- Still uncertain: **15**. Good sources disagree, or the date or place is not known. The panel now says so. Nothing was guessed.
- Already right: **478**

**The error rate is low: 7 of 500 (1.4%).** Batches 2 to 5 of the doubtful list were 21 to 38% wrong. The people the script did not flag are mostly fine. The few mistakes are the same kind as before (a region-centre pin, a town with the same name, a pin on the nearest city instead of the village).

## Fixes

| Person | Old pin | New pin | Source |
|---|---|---|---|
| Jane Austen | Steventon, **Oxfordshire** | Steventon, Hampshire (44 km) | [Q36322](https://www.wikidata.org/wiki/Q36322) |
| Günter Grass | middle of the Free City of Danzig, at the sea edge | Langfuhr (Wrzeszcz), Gdańsk | [Q6538](https://www.wikidata.org/wiki/Q6538), [Nobel](https://www.nobelprize.org/prizes/literature/1999/grass/biographical/) |
| Deng Xiaoping | Guang'an city | Xiexing (8 km) | [Q16977](https://www.wikidata.org/wiki/Q16977) |
| David (traditional figure) | Jerusalem | Bethlehem (8.5 km) | [Q41370](https://www.wikidata.org/wiki/Q41370) |
| William Henry Harrison | middle of Charles City County | Berkeley Plantation (11 km) | [Q11869](https://www.wikidata.org/wiki/Q11869) |
| Stanley Kubrick | the Bronx | Lying-In Hospital, Manhattan (13 km) | [Q2001](https://www.wikidata.org/wiki/Q2001), [Wikipedia](https://en.wikipedia.org/wiki/Stanley_Kubrick) |
| Saddam Hussein | Tikrit | al-Awja (13 km) | [Q1316](https://www.wikidata.org/wiki/Q1316), [Britannica](https://www.britannica.com/biography/Saddam-Hussein) |

Kubrick and Saddam: Wikidata gives the Bronx and Tikrit, but Wikipedia and other sources agree on Manhattan and al-Awja. The panel says why.

## Uncertain (panel now says so)

The Buddha (born and died "500 BC": a placeholder), Pythagoras, Paul the Apostle, Hesiod, Tacitus, Ptolemy, Hammurabi, Lucretius (dates not known); Ferdinand Magellan, Giovanni Boccaccio, Sappho (pin on the middle of Lesbos), Kim Jong-il, Antoni Gaudí, Rumi, Yasser Arafat, Tacitus (whole-degree pin on the middle of Gallia Narbonensis), Hammurabi (pin on the "Old Babylonian Empire") (birthplace disputed or unknown).

## Not real or not a person

None. David and Solomon are traditional figures and already carry a "traditional" note.
