# Overnight 3D-correctness report — 2026-07-07

The cheap-AI (Haiku) verify pass reviewed **all 44 monuments that carry a 3D
model**, judging each against the policy *"prefer no 3D to a wrong one"*. Three
independent reviewers, then my consolidation. Analysis only — the sweeping,
risky work waits for your call. What I changed is tiny and fully reversible: a
few names moved to the suppression list, so they show the **real photo** instead
of a misleading model.

---

## ✅ Applied overnight (high-confidence WRONG-FAMILY — safe, reversible)

These aren't "a bit off" — the archetype is the wrong *kind* of building, so the
photo is plainly better. Suppressing only hides a 3D button; it can't break
anything (all 147 tests + build still green).

| Monument | Was rendered as | Why it's wrong |
|---|---|---|
| Aachen Cathedral | Gothic twin-tower cathedral | It's a Carolingian **octagon** (palatine chapel) |
| Speyer Cathedral | Gothic cathedral w/ spire | **Romanesque** — round arches, four towers, no spire |
| Cusco Cathedral | Gothic cathedral | Andean **Baroque colonial** on Inca stonework |
| Newstead Abbey | Gothic cathedral | A **ruined priory + country house**, not a cathedral |
| Castel del Monte | Square keep | A unique **octagonal** castle |
| Neuschwanstein Castle | Square keep | A **fairy-tale Revival** castle a plain keep can't convey |
| Cahokia | Stone stepped-pyramid | Great **earthen mounds**, not stone |
| Borobudur (×2 entries) | Mesoamerican stepped-pyramid | A **Buddhist stupa-mandala** |

→ 9 names added to `NO_3D_NAMES` in both mirrors (parity test passes).

---

## 🟡 Awaiting your greenlight (judgment calls — I did NOT change these)

The archetype *family* is arguably right; it just loses detail. Your call —
say "suppress <name>" and it's a one-liner.

| Monument | Model | Reviewer's note |
|---|---|---|
| Malbork Castle | castle | Right family, but a vast **red-brick** fortress; a small keep understates it |
| Tournai Cathedral | cathedral | Romanesque **five-tower** silhouette |
| Konark Sun Temple | temple-tower | Right family, but the **chariot** form is special |
| Southwell Minster | cathedral | Norman; has twin towers so it half-fits |
| Peveril Castle | castle | Right family, but **heavily ruined** — better as a ruin/phase than an intact keep |
| Pumapunku | megalith | Megalith fits; loses the precision-cut joints |
| Gunung Padang | megalith | Megalith fits; loses the terraced hillside |

**Better-as-phases (not suppress):** Peveril Castle could join Nottingham/Notre-
Dame with a ruined phase instead of being hidden.

---

## 🛡️ Deliberately KEPT despite a flag

- **Notre-Dame de Paris** — a reviewer noted the model misses the flying
  buttresses/rose window. True, but it *is* a Gothic cathedral, and it's the
  showcase **through-time** monument (the 2019 fire → 2024 restoration). Keeping
  its 3D. A better cathedral model is the fix here, not suppression.

---

## Everything else: KEEP (fair impressions)

Göbekli Tepe, Karahan Tepe, Çatalhöyük, Nabta Playa, Stonehenge, Giza, the
Sphinx, Great Pyramid, Acropolis, Parthenon, Monte Albán, Tikal, Teotihuacan,
Pont du Gard, Chichén Itzá, Prambanan, Preah Vihear, Chartres, Amiens, Burgos,
Cologne, León, Leaning Tower of Pisa, Arbor Low, the Lighthouse, Nottingham
Castle, Younger Dryas impact.

---

## Also queued for you (from your last note — NOT done, you said "another time")
- **Pisa alignment**: the tower now sits on the ground, but the tilt + its
  **shadow** need aligning to the real lean. Deferred as you asked.
- **A proper Colosseum** model (arched arcade + half-collapsed form).
- **Sea-level / Ice Age land bridges** feature (Doggerland, Beringia).
