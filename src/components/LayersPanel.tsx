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

/**
 * LayersPanel
 * -----------
 * A small control in the top-right for toggling map layers on and off. The
 * emoji on each row matches the marker that layer draws on the globe and the
 * timeline, so the panel doubles as a legend.
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

  // The master "All layers" switch — turns every layer on or off at once.
  const allToggles: Array<[boolean, (v: boolean) => void]> = [
    [showBorders, onToggleBorders],
    [showFlags, onToggleFlags],
    [showBattles, onToggleBattles],
    [showCampaigns, onToggleCampaigns],
    [showSites, onToggleSites],
    [showCities, onToggleCities],
    [showDisasters, onToggleDisasters],
    [showEvents, onToggleEvents],
    [showScience, onToggleScience],
    [showPeople, onTogglePeople],
    [showFauna, onToggleFauna],
    [showSeaLevel, onToggleSeaLevel],
    [showRivers, onToggleRivers],
  ];
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
      <label className="layer-row">
        <input type="checkbox" checked={showBorders} onChange={(e) => onToggleBorders(e.target.checked)} />
        <span>Political borders</span>
      </label>
      <label className="layer-row sub">
        <input
          type="checkbox"
          checked={showFlags}
          disabled={!showBorders}
          onChange={(e) => onToggleFlags(e.target.checked)}
        />
        <span>↳ ⚑ flags inside borders</span>
      </label>
      <label className="layer-row">
        <input type="checkbox" checked={showBattles} onChange={(e) => onToggleBattles(e.target.checked)} />
        <span>⚔️ Wars &amp; battles</span>
      </label>
      <label className="layer-row">
        <input type="checkbox" checked={showCampaigns} onChange={(e) => onToggleCampaigns(e.target.checked)} />
        <span>🚩 War front lines</span>
      </label>
      <label className="layer-row">
        <input type="checkbox" checked={showSites} onChange={(e) => onToggleSites(e.target.checked)} />
        <span>🏛️ Sites &amp; monuments</span>
      </label>
      <label className="layer-row">
        <input type="checkbox" checked={showCities} onChange={(e) => onToggleCities(e.target.checked)} />
        <span>🏙️ Cities &amp; places</span>
      </label>
      <label className="layer-row">
        <input type="checkbox" checked={showDisasters} onChange={(e) => onToggleDisasters(e.target.checked)} />
        <span>🌋 Natural disasters</span>
      </label>
      <label className="layer-row">
        <input type="checkbox" checked={showEvents} onChange={(e) => onToggleEvents(e.target.checked)} />
        <span>📜 Treaties &amp; events</span>
      </label>
      <label className="layer-row">
        <input type="checkbox" checked={showScience} onChange={(e) => onToggleScience(e.target.checked)} />
        <span>🔬 Science &amp; discoveries</span>
      </label>
      <label className="layer-row">
        <input type="checkbox" checked={showPeople} onChange={(e) => onTogglePeople(e.target.checked)} />
        <span>👤 Notable people</span>
      </label>
      <label className="layer-row">
        <input type="checkbox" checked={showFauna} onChange={(e) => onToggleFauna(e.target.checked)} />
        <span>🦕 Prehistoric life</span>
      </label>
      <label className="layer-row">
        <input type="checkbox" checked={showSeaLevel} onChange={(e) => onToggleSeaLevel(e.target.checked)} />
        <span>🧊 Ice Ages (seas &amp; ice)</span>
      </label>
      <label className="layer-row">
        <input type="checkbox" checked={showRivers} onChange={(e) => onToggleRivers(e.target.checked)} />
        <span>🏞️ Shifting rivers</span>
      </label>
        </>
      )}
    </div>
    </div>
  );
}
