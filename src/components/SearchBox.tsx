import { useMemo, useState } from 'react';
import type { AncientSite, Battle, Fauna, TimelineEvent } from '../lib/types';
import { ERAS, type Era } from '../lib/timeScale';

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
  /** Fetch a place we don't have from the web (Wikidata) and add it live. */
  onWebSearch: (query: string) => void;
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
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '');

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
export default function SearchBox({ sites, battles, events, fauna, onPickBattle, onPickSite, onPickEra, onPickEvent, onPickFauna, onWebSearch }: SearchBoxProps) {
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);

  const results = useMemo<Result[]>(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    const out: Result[] = [];
    const taken = new Set<string>(); // normalised names already listed (dedup curated vs imported)

    for (const b of battles) {
      if (b.name.toLowerCase().includes(q)) {
        taken.add(norm(b.name));
        out.push({ key: `b-${b.id}`, label: b.name, sub: b.dateLabel, badge: '⚔️ Battle', run: () => onPickBattle(b) });
      }
    }
    for (const s of sites) {
      if (s.name.toLowerCase().includes(q)) {
        taken.add(norm(s.name));
        out.push({ key: `s-${s.id}`, label: s.name, sub: s.builtYearLabel, badge: '🏛️ Site', run: () => onPickSite(s) });
      }
    }
    for (const e of ERAS) {
      if (e.name.toLowerCase().includes(q)) {
        out.push({ key: `e-${e.name}`, label: e.name, sub: e.kind === 'geological' ? 'Geological era' : 'Historical era', badge: 'Era', run: () => onPickEra(e) });
      }
    }

    // The whole imported world: people, monuments, cities, science, disasters.
    // Prefix matches first, then the most notable.
    const matched = events
      .filter((e) => e.name.toLowerCase().includes(q) && !taken.has(norm(e.name)))
      .sort((a, b) => {
        const ap = a.name.toLowerCase().startsWith(q) ? 0 : 1;
        const bp = b.name.toLowerCase().startsWith(q) ? 0 : 1;
        return ap !== bp ? ap - bp : (b.notability ?? 0) - (a.notability ?? 0);
      })
      .slice(0, 8);
    for (const e of matched) {
      out.push({
        key: `ev-${e.id}`,
        label: e.name,
        sub: yearLabel(e.startYear),
        badge: EVENT_BADGE[e.category] ?? 'Event',
        run: () => onPickEvent(e),
      });
    }

    for (const f of fauna) {
      if (f.name.toLowerCase().includes(q)) {
        out.push({ key: `f-${f.id}`, label: f.name, sub: `${f.fromMa}–${f.toMa} Mya`, badge: '🦕 Creature', run: () => onPickFauna(f) });
      }
    }
    return out.slice(0, 9);
  }, [query, battles, sites, events, fauna, onPickBattle, onPickSite, onPickEra, onPickEvent, onPickFauna]);

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
    <div className="search-box">
      <input
        type="search"
        placeholder="🔍 Search people, places, battles, eras…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setFocused(true)}
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
