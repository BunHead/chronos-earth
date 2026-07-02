interface LayersPanelProps {
  showSites: boolean;
  onToggleSites: (value: boolean) => void;
  showBorders: boolean;
  onToggleBorders: (value: boolean) => void;
  showBattles: boolean;
  onToggleBattles: (value: boolean) => void;
  showCampaigns: boolean;
  onToggleCampaigns: (value: boolean) => void;
  showCities: boolean;
  onToggleCities: (value: boolean) => void;
  showDisasters: boolean;
  onToggleDisasters: (value: boolean) => void;
  showScience: boolean;
  onToggleScience: (value: boolean) => void;
  showPeople: boolean;
  onTogglePeople: (value: boolean) => void;
  showFauna: boolean;
  onToggleFauna: (value: boolean) => void;
  onAbout: () => void;
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
  showBattles,
  onToggleBattles,
  showCampaigns,
  onToggleCampaigns,
  showCities,
  onToggleCities,
  showDisasters,
  onToggleDisasters,
  showScience,
  onToggleScience,
  showPeople,
  onTogglePeople,
  showFauna,
  onToggleFauna,
  onAbout,
}: LayersPanelProps) {
  return (
    <div className="layers-panel">
      <div className="layers-title">Layers</div>
      <label className="layer-row">
        <input type="checkbox" checked={showBorders} onChange={(e) => onToggleBorders(e.target.checked)} />
        <span>Political borders</span>
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
      <label className="layer-row disabled" title="Coming in a future update">
        <input type="checkbox" disabled />
        <span>🐫 Trade routes</span>
      </label>
      <button className="layers-about" onClick={onAbout}>
        ℹ About &amp; sources
      </button>
    </div>
  );
}
