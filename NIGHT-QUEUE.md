# Night Queue — orders for the overnight session

The nightly scheduled task reads this file and works TOP TO BOTTOM. Anyone
(including the Captain — just type plain English) can add, reorder, or strike
items. The night session marks progress here and never deletes your words.

## How the night session must behave
- Mark an item `[DONE <date> <commit>]` when finished, `[SKIPPED: reason]` if blocked.
- After each finished item: npm test + npm run build must pass, then commit & push (auto-deploys).
- Check `git log --oneline -15` first — never redo work.
- Append a session note to C:\Users\spenc\Documents\Claude-WorkLog\<today>.md.
- Stop cleanly at ~80% of the session budget.

## Queue
1. Orange "about to move" timing: glow should strengthen only in the final
   decades before a border changes, not from the moment a snapshot starts.
   [DONE 2026-07-03 1eca41d]
2. Country name labels on the border map (visible when zoomed to a region,
   subtle, over the flag tints). [DONE 2026-07-03 136ada1]
3. Region-scoped POI polish: when live-fetch markers exist, clear them once
   the camera leaves that region (they currently persist until the next ask).
4. More curated battle views: pick 2 famous battles that lack a phased 2D
   view (e.g. Agincourt, Thermopylae) and build battle-views.json entries
   following the existing schema.
5. Timeline span ribbons: decorate long spans (empires, construction periods)
   with a subtle gradient and their little category icon.
