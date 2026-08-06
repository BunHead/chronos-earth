import { useEffect, useRef, useState } from 'react';
import { startDrag } from '../lib/windowDrag';
import { SUB_LAYERS } from '../lib/subLayers';
import Glyph from './Glyph';

interface LayersPanelProps {
  showSites: boolean;
  onToggleSites: (value: boolean) => void;
  showBorders: boolean;
  onToggleBorders: (value: boolean) => void;
  showFlags: boolean;
  onToggleFlags: (value: boolean) => void;
  showBattles: boolean;
  onToggleBattles: (value: boolean) => void;
  showCampaigns: boolean;
  onToggleCampaigns: (value: boolean) => void;
  showCities: boolean;
  onToggleCities: (value: boolean) => void;
  showDisasters: boolean;
  onToggleDisasters: (value: boolean) => void;
  showEvents: boolean;
  onToggleEvents: (value: boolean) => void;
  showScience: boolean;
  onToggleScience: (value: boolean) => void;
  showPeople: boolean;
  onTogglePeople: (value: boolean) => void;
  showFauna: boolean;
  onToggleFauna: (value: boolean) => void;
  showSeaLevel: boolean;
  onToggleSeaLevel: (value: boolean) => void;
  showRivers: boolean;
  onToggleRivers: (value: boolean) => void;
  /** Sub-kinds switched OFF (see lib/subLayers — opt-out, so anything the
   * classifier doesn't recognise stays visible). */
  offSubs: ReadonlySet<string>;
  onToggleSub: (kind: string, on: boolean) => void;
  /** How many loaded events fall into each sub-kind, shown beside its row. */
  subCounts: Record<string, number>;
}

/** One switchable layer. `sub` is a dependent child row (flags live inside
 * borders), which stays pinned to its parent rather than being sorted away
 * from it — nesting beats alphabetising. */
interface LayerRow {
  /** Sort key and visible text, WITHOUT the emoji — sorting on the emoji would
   * order the list by an invisible character nobody can see. */
  label: string;
  /** Key into lib/glyphs — the drawn mark for this layer. */
  glyph?: string;
  on: boolean;
  set: (v: boolean) => void;
  sub?: { label: string; on: boolean; set: (v: boolean) => void };
}

/**
 * LayersPanel
 * -----------
 * A small control in the top-right for toggling map layers on and off. The
 * emoji on each row matches the marker that layer draws on the globe and the
 * timeline, so the panel doubles as a legend.
 *
 * The rows are declared as DATA and sorted by name at render, so the list is
 * alphabetical and stays that way: a new layer can be appended anywhere in the
 * array below and still lands in its right place. Hand-ordered JSX drifts the
 * moment somebody is in a hurry.
 *
 * Note: continental drift is deliberately NOT a toggle — when you scrub into
 * deep time the continents simply move, which is self-evident on the globe.
 */
export default function LayersPanel({
  showSites,
  onToggleSites,
  showBorders,
  onToggleBorders,
  showFlags,
  onToggleFlags,
  showBattles,
  onToggleBattles,
  showCampaigns,
  onToggleCampaigns,
  showCities,
  onToggleCities,
  showDisasters,
  onToggleDisasters,
  showEvents,
  onToggleEvents,
  showScience,
  onToggleScience,
  showPeople,
  onTogglePeople,
  showFauna,
  onToggleFauna,
  showSeaLevel,
  onToggleSeaLevel,
  showRivers,
  onToggleRivers,
  offSubs,
  onToggleSub,
  subCounts,
}: LayersPanelProps) {
  // Which layers have their sub-list unfolded. Folded by default: the panel
  // must stay a glance, not a wall of forty checkboxes.
  const [openSubs, setOpenSubs] = useState<Record<string, boolean>>({});
  // Collapsible, and folded by default for a clean view of the planet.
  const [open, setOpen] = useState(false);
  // Draggable by its title bar — a real drag swallows the collapse-click.
  const draggedRef = useRef<(() => boolean) | undefined>(undefined);

  // Declared in any order — sorted by label just below.
  const rows: LayerRow[] = [
    { label: 'Cities & Places', glyph: 'city', on: showCities, set: onToggleCities },
    { label: 'Ice Ages (Seas & Ice)', glyph: 'seas', on: showSeaLevel, set: onToggleSeaLevel },
    { label: 'Natural Disasters', glyph: 'disaster', on: showDisasters, set: onToggleDisasters },
    { label: 'Notable People', glyph: 'person', on: showPeople, set: onTogglePeople },
    {
      label: 'Political Borders',
      on: showBorders,
      set: onToggleBorders,
      sub: { label: '⚑ Flags Inside Borders', on: showFlags, set: onToggleFlags },
    },
    { label: 'Prehistoric Life', glyph: 'fauna', on: showFauna, set: onToggleFauna },
    { label: 'Science & Discoveries', glyph: 'discovery', on: showScience, set: onToggleScience },
    { label: 'Shifting Rivers', glyph: 'rivers', on: showRivers, set: onToggleRivers },
    { label: 'Sites & Monuments', glyph: 'monument', on: showSites, set: onToggleSites },
    { label: 'Treaties & Events', glyph: 'event', on: showEvents, set: onToggleEvents },
    { label: 'War Front Lines', glyph: 'campaign', on: showCampaigns, set: onToggleCampaigns },
    { label: 'Wars & Battles', glyph: 'battle', on: showBattles, set: onToggleBattles },
  ].sort((a, b) => a.label.localeCompare(b.label, 'en'));

  // The master "All layers" switch — turns every layer on or off at once.
  // Built from the same list, so a new layer joins it automatically instead of
  // being quietly left out of "All".
  const allToggles: Array<[boolean, (v: boolean) => void]> = rows.flatMap((r) =>
    r.sub ? [[r.on, r.set], [r.sub.on, r.sub.set]] : [[r.on, r.set]],
  );
  const allOn = allToggles.every(([v]) => v);
  const anyOn = allToggles.some(([v]) => v);
  const setAll = (value: boolean) => allToggles.forEach(([, fn]) => fn(value));
  const allRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    // Show a dash (indeterminate) when only some layers are on.
    if (allRef.current) allRef.current.indeterminate = anyOn && !allOn;
  }, [anyOn, allOn]);
  return (
    <div className="layers-panel-wrap">
    <div className={open ? 'layers-panel' : 'layers-panel collapsed'}>
      <button
        className="layers-title"
        title="Click to fold · drag to move"
        onPointerDown={(e) => {
          draggedRef.current = startDrag(e, '.layers-panel-wrap');
        }}
        onClick={() => {
          const wasDrag = draggedRef.current?.();
          draggedRef.current = undefined;
          if (wasDrag) return; // it was a drag, not a click
          setOpen((o) => !o);
        }}
        aria-expanded={open}
      >
        Layers <span className="layers-chevron">{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <>
      <label className="layer-row layer-all">
        <input ref={allRef} type="checkbox" checked={allOn} onChange={(e) => setAll(e.target.checked)} />
        <span>All Layers</span>
      </label>
      {rows.map((r) => {
        const kinds = SUB_LAYERS[r.label] ?? [];
        const hasSubs = kinds.length > 0 || !!r.sub;
        const unfolded = !!openSubs[r.label];
        return (
        <div key={r.label}>
          <div className="layer-row-line">
            <label className="layer-row">
              <input type="checkbox" checked={r.on} onChange={(e) => r.set(e.target.checked)} />
              <span>{r.glyph && <Glyph name={r.glyph} />} {r.label}</span>
            </label>
            {hasSubs && (
              <button
                className="layer-fold"
                aria-expanded={unfolded}
                aria-label={`${unfolded ? 'Hide' : 'Show'} the kinds inside ${r.label}`}
                title={unfolded ? 'Hide the kinds inside' : 'Show the kinds inside'}
                onClick={() => setOpenSubs((o) => ({ ...o, [r.label]: !o[r.label] }))}
              >
                {unfolded ? '▾' : '▸'}
              </button>
            )}
          </div>
          {hasSubs && unfolded && (
            <>
              {/* The hand-built dependent child (flags inside borders). */}
              {r.sub && (
                <label className="layer-row sub">
                  <input
                    type="checkbox"
                    checked={r.sub.on}
                    disabled={!r.on}
                    onChange={(e) => r.sub!.set(e.target.checked)}
                  />
                  <span>↳ {r.sub.label}</span>
                </label>
              )}
              {/* Data-derived kinds. A count of 0 is left showing rather than
                  hidden: "Plagues 0" tells the visitor the app looked and found
                  none, where a missing row would suggest it never looks. */}
              {kinds.map((k) => (
                <label className="layer-row sub" key={k.kind}>
                  <input
                    type="checkbox"
                    checked={!offSubs.has(k.kind)}
                    disabled={!r.on}
                    onChange={(e) => onToggleSub(k.kind, e.target.checked)}
                  />
                  <span>
                    ↳ <Glyph name={k.glyph} /> {k.label}
                    <span className="layer-count">{subCounts[k.kind] ?? 0}</span>
                  </span>
                </label>
              ))}
            </>
          )}
        </div>
        );
      })}
        </>
      )}
    </div>
    </div>
  );
}
