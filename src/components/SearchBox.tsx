import { useEffect, useMemo, useRef, useState } from 'react';
import type { AncientSite, Battle, Fauna, TimelineEvent } from '../lib/types';
import { ERAS, parseYear, type Era } from '../lib/timeScale';
import { loadSearchIndex, rowToEvent, type SearchRow } from '../lib/searchIndex';
import type { VideoPin } from '../lib/videos';
import { loadCountryIndex, relatedNames, spanLabel, type CountryIndex, type CountryRow } from '../lib/countryIndex';
import { matchTier } from '../lib/searchRank';
import { yearLabel } from '../lib/panel';

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
  /** The curated video layer — searchable by title and by channel. */
  videos?: VideoPin[];
  onPickVideo?: (video: VideoPin) => void;
  /** Countries from the border snapshots — "Barbados" used to find nothing. */
  onPickCountry?: (country: CountryRow, frames: number[]) => void;
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
  /** Where it is, shown only to tell apart two rows that would read the same. */
  at?: { lat: number; lon: number };
}

const coord = ({ lat, lon }: { lat: number; lon: number }) =>
  `${Math.abs(lat).toFixed(1)}°${lat >= 0 ? 'N' : 'S'} ${Math.abs(lon).toFixed(1)}°${lon >= 0 ? 'E' : 'W'}`;

/**
 * SearchBox
 * ---------
 * A single search field that finds battles, ancient sites and eras by name and
 * jumps the app to them.
 */
export default function SearchBox({ sites, battles, events, fauna, onPickBattle, onPickSite, onPickEra, onPickEvent, onPickFauna, onPickYear, onWebSearch, videos = [], onPickVideo, onPickCountry, baseUrl = '/' }: SearchBoxProps) {
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  // The row picked with the arrow keys (-1 = none; Enter then takes the first).
  const [active, setActive] = useState(-1);
  useEffect(() => setActive(-1), [query]);

  // THE FIND-ANYTHING INDEX, fetched the first time the box is focused.
  //
  // Not at load: 367 KB that a visitor who never searches should never pay
  // for. Not on every keystroke either — one shared promise, so focusing,
  // clicking away and focusing again fetches once. Results from what is
  // already in memory appear instantly; these widen them a moment later,
  // which is why this is a separate list rather than something to await.
  const [indexRows, setIndexRows] = useState<SearchRow[]>([]);
  // False until the full index has arrived. On a first visit it is 2.7 MB
  // fetched alongside everything the site caches for offline use, and took
  // more than ten seconds in a test from the live site (26 Sept 2026) — long
  // enough that "Holland" found only two counts of Holland and no country.
  const [indexReady, setIndexReady] = useState(false);
  const [countries, setCountries] = useState<CountryIndex | null>(null);
  // Folded once when the index arrives, not ~50,000 times per keystroke.
  const foldedIndex = useMemo(() => indexRows.map((r) => fold(r.name)), [indexRows]);
  const asked = useRef(false);
  const wantIndex = () => {
    if (asked.current) return;
    asked.current = true;
    void loadSearchIndex(baseUrl).then((rows) => { setIndexRows(rows); setIndexReady(true); });
    void loadCountryIndex(baseUrl).then(setCountries);
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

    // COUNTRIES FIRST, when the name is what was typed. "Barbados" found
    // nothing until these were added; someone typing a country's name almost
    // always means the country. Exact and prefix matches only, and at most
    // three, so "rom" does not bury every Roman event under Romania.
    if (countries && onPickCountry) {
      const hits = countries.rows
        .filter((c) => fold(c.name).startsWith(q))
        .sort((a, b) => {
          const ae = fold(a.name) === q ? 0 : 1;
          const be = fold(b.name) === q ? 0 : 1;
          if (ae !== be) return ae - be;
          // The one on the map most recently is the likelier meaning.
          return b.years[b.years.length - 1] - a.years[a.years.length - 1];
        })
        .slice(0, 3);
      // Other names for the same country: "Holland" -> Netherlands, "Persia"
      // -> Iran as well as Persia, "UK" -> United Kingdom. See RELATED_NAMES.
      const byName = new Map(countries.rows.map((c) => [c.name, c]));
      const related = relatedNames(query.trim(), new Set(byName.keys()))
        .map((n) => byName.get(n)!)
        .filter((c) => !hits.includes(c))
        .sort((a, b) => b.years[b.years.length - 1] - a.years[a.years.length - 1]);
      for (const c of [...hits, ...related].slice(0, 4)) {
        const alias = !hits.includes(c);
        out.push({
          key: `c-${c.name}`,
          label: c.name,
          sub: (alias ? `also known as "${query.trim()}" · ` : '') + spanLabel(c, countries.latestFrame),
          badge: '🗺️ Country',
          run: () => onPickCountry(c, countries.frames),
        });
      }
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

    // The whole imported world: people, monuments, cities, science, disasters —
    // the famous rows in memory AND the wider index, ranked TOGETHER by how
    // well the name matches (see matchTier): "Delphi" lists Delphi before
    // Philadelphia. Within a tier, the in-memory rows (the most notable) come
    // first, then the more notable, then the shorter name.
    const inMemory = new Set(events.map((e) => e.id));
    const ranked: { tier: number; mem: number; notability: number; len: number; name: string; ev?: TimelineEvent; row?: SearchRow }[] = [];
    for (const e of events) {
      if (taken.has(norm(e.name))) continue;
      const tier = matchTier(fold(e.name), q);
      if (tier >= 0) ranked.push({ tier, mem: 0, notability: e.notability ?? 0, len: e.name.length, name: e.name, ev: e });
    }
    for (let i = 0; i < indexRows.length; i++) {
      const r = indexRows[i];
      if (inMemory.has(r.id)) continue;
      const tier = matchTier(foldedIndex[i], q);
      if (tier < 0 || taken.has(norm(r.name))) continue;
      ranked.push({ tier, mem: 1, notability: 0, len: r.name.length, name: r.name, row: r });
    }
    ranked.sort((a, b) => a.tier - b.tier || a.mem - b.mem || b.notability - a.notability || a.len - b.len);
    for (const m of ranked.slice(0, Math.max(3, 9 - out.length))) {
      taken.add(norm(m.name));
      const startYear = m.ev ? m.ev.startYear : m.row!.startYear;
      const src = m.ev ?? m.row!;
      const category = m.ev ? m.ev.category : m.row!.category;
      out.push({
        key: m.ev ? `ev-${m.ev.id}` : `ix-${m.row!.id}`,
        label: m.name,
        sub: yearLabel(startYear),
        badge: EVENT_BADGE[category] ?? 'Event',
        run: m.ev ? () => onPickEvent(m.ev!) : () => onPickEvent(rowToEvent(m.row!)),
        at: { lat: src.lat, lon: src.lon },
      });
    }

    // The curated video layer. Matched on title AND channel, so "a history of
    // peoples" finds everything from that channel, not just one film.
    if (onPickVideo) {
      for (const v of videos) {
        if (!fold(v.title).includes(q) && !fold(v.author).includes(q)) continue;
        if (taken.has(norm(v.title))) continue;
        taken.add(norm(v.title));
        out.push({
          key: `vid-${v.id}`,
          label: v.title,
          sub: `${v.author} · ${v.year < 0 ? `${-v.year} BCE` : `${v.year} CE`}`,
          badge: '📺 Video',
          run: () => onPickVideo(v),
        });
      }
    }

    for (const f of fauna) {
      if (fold(f.name).includes(q)) {
        out.push({ key: `f-${f.id}`, label: f.name, sub: `${f.fromMa}–${f.toMa} Mya`, badge: '🦕 Creature', run: () => onPickFauna(f) });
      }
    }
    // Two different places can share a name and a year — Pleiades has two
    // Delphinions of 550 BCE. Rows that would read identically say where.
    const shown = out.slice(0, 9);
    const seen = new Map<string, number>();
    for (const r of shown) seen.set(r.label + '|' + r.sub, (seen.get(r.label + '|' + r.sub) ?? 0) + 1);
    return shown.map((r) => (r.at && (seen.get(r.label + '|' + r.sub) ?? 0) > 1 ? { ...r, sub: `${r.sub} · ${coord(r.at)}` } : r));
  }, [query, battles, sites, events, fauna, indexRows, foldedIndex, countries, videos, onPickBattle, onPickSite, onPickEra, onPickEvent, onPickFauna, onPickYear, onPickVideo, onPickCountry]);

  const pick = (r: Result) => {
    r.run();
    setQuery('');
    setFocused(false);
  };

  const q2 = query.trim();
  const open = focused && q2.length >= 2;
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
        role="combobox"
        aria-expanded={open}
        aria-controls="chronos-search-results"
        aria-activedescendant={open && active >= 0 ? `search-row-${active}` : undefined}
        onKeyDown={(e) => {
          // Up/down walk the list, the web row included; Enter takes the
          // highlighted row, or the first if none is.
          const rows = results.length + 1;
          if (open && e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => (a + 1) % rows); }
          if (open && e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => (a <= 0 ? rows - 1 : a - 1)); }
          if (e.key === 'Enter') {
            if (active >= 0 && active < results.length) pick(results[active]);
            else if (active === results.length) doWeb();
            else if (results[0]) pick(results[0]);
            else if (q2.length >= 2) doWeb();
          }
          if (e.key === 'Escape') setQuery('');
        }}
      />
      {open && (
        <ul className="search-results" id="chronos-search-results" role="listbox">
          {results.map((r, i) => (
            <li key={r.key} role="option" id={`search-row-${i}`} aria-selected={i === active}>
              <button tabIndex={-1} className={i === active ? 'active' : undefined} onMouseDown={() => pick(r)}>
                <span className="search-badge">{r.badge}</span>
                <span className="search-label">{r.label}</span>
                <span className="search-sub">{r.sub}</span>
              </button>
            </li>
          ))}
          {!indexReady && (
            <li className="search-pending" aria-live="polite">Still fetching the whole globe’s index — more results in a moment…</li>
          )}
          <li className="search-web" role="option" id={`search-row-${results.length}`} aria-selected={active === results.length}>
            <button tabIndex={-1} className={active === results.length ? 'active' : undefined} onMouseDown={doWeb}>
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
