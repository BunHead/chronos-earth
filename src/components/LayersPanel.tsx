import { useEffect, useRef, useState } from 'react';
import { startDrag } from '../lib/windowDrag';

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
}

/** One switchable layer. `sub` is a dependent child row (flags live inside
 * borders), which stays pinned to its parent rather than being sorted away
 * from it — nesting beats alphabetising. */
interface LayerRow {
  /** Sort key and visible text, WITHOUT the emoji — sorting on the emoji would
   * order the list by an invisible character nobody can see. */
  label: string;
  emoji?: string;
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
}: LayersPanelProps) {
  // Collapsible, and folded by default for a clean view of the planet.
  const [open, setOpen] = useState(false);
  // Draggable by its title bar — a real drag swallows the collapse-click.
  const draggedRef = useRef<(() => boolean) | undefined>(undefined);

  // Declared in any order — sorted by label just below.
  const rows: LayerRow[] = [
    { label: 'Cities & places', emoji: '🏙️', on: showCities, set: onToggleCities },
    { label: 'Ice Ages (seas & ice)', emoji: '🧊', on: showSeaLevel, set: onToggleSeaLevel },
    { label: 'Natural disasters', emoji: '🌋', on: showDisasters, set: onToggleDisasters },
    { label: 'Notable people', emoji: '👤', on: showPeople, set: onTogglePeople },
    {
      label: 'Political borders',
      on: showBorders,
      set: onToggleBorders,
      sub: { label: '⚑ flags inside borders', on: showFlags, set: onToggleFlags },
    },
    { label: 'Prehistoric life', emoji: '🦕', on: showFauna, set: onToggleFauna },
    { label: 'Science & discoveries', emoji: '🔬', on: showScience, set: onToggleScience },
    { label: 'Shifting rivers', emoji: '🏞️', on: showRivers, set: onToggleRivers },
    { label: 'Sites & monuments', emoji: '🏛️', on: showSites, set: onToggleSites },
    { label: 'Treaties & events', emoji: '📜', on: showEvents, set: onToggleEvents },
    { label: 'War front lines', emoji: '🚩', on: showCampaigns, set: onToggleCampaigns },
    { label: 'Wars & battles', emoji: '⚔️', on: showBattles, set: onToggleBattles },
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
        <span>All layers</span>
      </label>
      {rows.map((r) => (
        <div key={r.label}>
          <label className="layer-row">
            <input type="checkbox" checked={r.on} onChange={(e) => r.set(e.target.checked)} />
            <span>{r.emoji ? `${r.emoji} ${r.label}` : r.label}</span>
          </label>
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
        </div>
      ))}
        </>
      )}
    </div>
    </div>
  );
}
