import { useEffect, useMemo, useRef, useState } from 'react';
import type { AncientSite, Battle, Fauna, TimelineEvent } from '../lib/types';
import { ERAS, parseYear, type Era } from '../lib/timeScale';
import { loadSearchIndex, rowToEvent, type SearchRow } from '../lib/searchIndex';

interface SearchBoxProps {
  sites: AncientSite[];
  battles: Battle[];
  /** The full imported world — people, monuments, cities, science, disasters. */
  events: TimelineEvent[];
  fauna: Fauna[];
  onPickBattle: (battle: Battle) => void;
  onPickSite: (site: AncientSite) => void;
  onPickEra: (era: Era) => void;
  onPickEvent: (event: TimelineEvent) => void;
  onPickFauna: (fauna: Fauna) => void;
  /** Jump the timeline to a typed year/date (e.g. "1969", "44 BCE", "14 July 1789"). */
  onPickYear: (year: number) => void;
  /** Fetch a place we don't have from the web (Wikidata) and add it live. */
  onWebSearch: (query: string) => void;
  /** Where the data lives — `import.meta.env.BASE_URL`. The search index is
   * fetched from here on first focus. */
  baseUrl?: string;
}

const EVENT_BADGE: Record<string, string> = {
  battle: '⚔️ Battle',
  monument: '🏛️ Monument',
  city: '🏙️ City',
  disaster: '🌋 Disaster',
  invention: '💡 Invention',
  discovery: '🔬 Discovery',
  person: '👤 Person',
  event: '📜 Event',
};

const yearLabel = (y: number) => (y < 0 ? `${-y} BCE` : `${y} CE`);

/**
 * Fold a name to plain ASCII letters so an English keyboard can reach it.
 *
 * Without this, a visitor who types "Orakau" gets offered a web lookup while
 * the Battle of Ōrākau sits in the dataset unreachable — and the same for Gate
 * Pā, Alcácer Quibir, Königgrätz and Điện Biên Phủ. Measured, not guessed:
 * every one of those failed a plain-ASCII search before this existed.
 *
 * NFD splits an accented letter into base + combining mark, which the range
 * below deletes. A handful of letters are NOT accents but distinct characters
 * and so survive decomposition untouched — those need naming outright.
 */
const STANDALONE: Record<string, string> = {
  đ: 'd', ð: 'd', ø: 'o', ł: 'l', æ: 'ae', œ: 'oe', ß: 'ss', þ: 'th',
};
export const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[đðøłæœßþ]/g, (c) => STANDALONE[c] ?? c);

/** Fold, then strip everything but letters and digits — used to dedup names. */
const norm = (s: string) => fold(s).replace(/[^a-z0-9]+/g, '');

interface Result {
  key: string;
  label: string;
  sub: string;
  badge: string;
  run: () => void;
}

/**
 * SearchBox
 * ---------
 * A single search field that finds battles, ancient sites and eras by name and
 * jumps the app to them.
 */
export default function SearchBox({ sites, battles, events, fauna, onPickBattle, onPickSite, onPickEra, onPickEvent, onPickFauna, onPickYear, onWebSearch, baseUrl = '/' }: SearchBoxProps) {
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);

  // THE FIND-ANYTHING INDEX, fetched the first time the box is focused.
  //
  // Not at load: 367 KB that a visitor who never searches should never pay
  // for. Not on every keystroke either — one shared promise, so focusing,
  // clicking away and focusing again fetches once. Results from what is
  // already in memory appear instantly; these widen them a moment later,
  // which is why this is a separate list rather than something to await.
  const [indexRows, setIndexRows] = useState<SearchRow[]>([]);
  const asked = useRef(false);
  const wantIndex = () => {
    if (asked.current) return;
    asked.current = true;
    void loadSearchIndex(baseUrl).then(setIndexRows);
  };
  // Someone who arrives by keyboard (tab into the box, or the / shortcut) and
  // types immediately would otherwise race the fetch; asking again on the
  // first real query costs nothing because the promise is shared.
  useEffect(() => {
    if (query.trim().length >= 2) wantIndex();
  }, [query]);

  const results = useMemo<Result[]>(() => {
    const q = fold(query.trim());
    if (q.length < 2) return [];
    const out: Result[] = [];
    const taken = new Set<string>(); // normalised names already listed (dedup curated vs imported)

    // A typed date/year jumps the timeline — and surfaces what happened that year.
    const year = parseYear(query);
    if (year !== null) {
      out.push({
        key: 'year-jump',
        label: `Go to ${yearLabel(year)}`,
        sub: 'Jump the timeline to this year',
        badge: '🗓️ Date',
        run: () => onPickYear(year),
      });
      for (const b of battles) {
        if (b.year === year) {
          taken.add(norm(b.name));
          out.push({ key: `by-${b.id}`, label: b.name, sub: b.dateLabel, badge: '⚔️ Battle', run: () => onPickBattle(b) });
        }
      }
      for (const e of events.filter((ev) => ev.startYear === year && !taken.has(norm(ev.name))).slice(0, 6)) {
        out.push({ key: `evy-${e.id}`, label: e.name, sub: yearLabel(e.startYear), badge: EVENT_BADGE[e.category] ?? 'Event', run: () => onPickEvent(e) });
      }
      return out.slice(0, 9);
    }

    for (const b of battles) {
      if (fold(b.name).includes(q)) {
        taken.add(norm(b.name));
        out.push({ key: `b-${b.id}`, label: b.name, sub: b.dateLabel, badge: '⚔️ Battle', run: () => onPickBattle(b) });
      }
    }
    for (const s of sites) {
      if (fold(s.name).includes(q)) {
        taken.add(norm(s.name));
        out.push({ key: `s-${s.id}`, label: s.name, sub: s.builtYearLabel, badge: '🏛️ Site', run: () => onPickSite(s) });
      }
    }
    for (const e of ERAS) {
      if (fold(e.name).includes(q)) {
        out.push({ key: `e-${e.name}`, label: e.name, sub: e.kind === 'geological' ? 'Geological era' : 'Historical era', badge: 'Era', run: () => onPickEra(e) });
      }
    }

    // The whole imported world: people, monuments, cities, science, disasters.
    // Prefix matches first, then the most notable.
    const matched = events
      .filter((e) => fold(e.name).includes(q) && !taken.has(norm(e.name)))
      .sort((a, b) => {
        const ap = fold(a.name).startsWith(q) ? 0 : 1;
        const bp = fold(b.name).startsWith(q) ? 0 : 1;
        return ap !== bp ? ap - bp : (b.notability ?? 0) - (a.notability ?? 0);
      })
      .slice(0, 8);
    for (const e of matched) {
      taken.add(norm(e.name));
      out.push({
        key: `ev-${e.id}`,
        label: e.name,
        sub: yearLabel(e.startYear),
        badge: EVENT_BADGE[e.category] ?? 'Event',
        run: () => onPickEvent(e),
      });
    }

    // Everything else on the globe. These rows are NOT in memory — they are the
    // 18,000-odd the headline tier has no room for — so they carry only enough
    // to be listed and flown to. The full row arrives with its map cell once
    // the camera gets there.
    if (out.length < 9) {
      const seenIds = new Set(matched.map((e) => e.id));
      const extra = indexRows
        .filter((r) => !seenIds.has(r.id) && !taken.has(norm(r.name)) && fold(r.name).includes(q))
        .sort((a, b) => {
          const ap = fold(a.name).startsWith(q) ? 0 : 1;
          const bp = fold(b.name).startsWith(q) ? 0 : 1;
          return ap !== bp ? ap - bp : a.name.length - b.name.length;
        })
        .slice(0, 9 - out.length);
      for (const r of extra) {
        taken.add(norm(r.name));
        out.push({
          key: `ix-${r.id}`,
          label: r.name,
          sub: yearLabel(r.startYear),
          badge: EVENT_BADGE[r.category] ?? 'Event',
          run: () => onPickEvent(rowToEvent(r)),
        });
      }
    }

    for (const f of fauna) {
      if (fold(f.name).includes(q)) {
        out.push({ key: `f-${f.id}`, label: f.name, sub: `${f.fromMa}–${f.toMa} Mya`, badge: '🦕 Creature', run: () => onPickFauna(f) });
      }
    }
    return out.slice(0, 9);
  }, [query, battles, sites, events, fauna, indexRows, onPickBattle, onPickSite, onPickEra, onPickEvent, onPickFauna, onPickYear]);

  const pick = (r: Result) => {
    r.run();
    setQuery('');
    setFocused(false);
  };

  const q2 = query.trim();
  const doWeb = () => {
    onWebSearch(q2);
    setQuery('');
    setFocused(false);
  };

  return (
    <div className="search-box" role="search">
      <input
        id="chronos-search"
        type="search"
        aria-label="Search people, places, battles and eras"
        placeholder="🔍 Search people, places, battles, eras…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => { setFocused(true); wantIndex(); }}
        onBlur={() => setTimeout(() => setFocused(false), 150)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { if (results[0]) pick(results[0]); else if (q2.length >= 2) doWeb(); }
          if (e.key === 'Escape') setQuery('');
        }}
      />
      {focused && q2.length >= 2 && (
        <ul className="search-results">
          {results.map((r) => (
            <li key={r.key}>
              <button onMouseDown={() => pick(r)}>
                <span className="search-badge">{r.badge}</span>
                <span className="search-label">{r.label}</span>
                <span className="search-sub">{r.sub}</span>
              </button>
            </li>
          ))}
          <li className="search-web">
            <button onMouseDown={doWeb}>
              <span className="search-badge">🌐 Web</span>
              <span className="search-label">Look up “{q2}” online</span>
              <span className="search-sub">Wikidata · added live</span>
            </button>
          </li>
        </ul>
      )}
    </div>
  );
}
