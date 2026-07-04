import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import Globe, { type GlobeHandle } from './components/Globe';
import Timeline from './components/Timeline';
import InfoPanel from './components/InfoPanel';
import LayersPanel from './components/LayersPanel';
import BattleView from './components/BattleView';
import SearchBox from './components/SearchBox';
import About from './components/About';
import Tours from './components/Tours';

// Three.js-based; loaded on demand to keep the initial bundle small.
const Monument3D = lazy(() => import('./components/Monument3D'));
import { OLDEST_BP, ZOOM_SPANS, posToYearsBP, yearsBPToPos, yearToYearsBP, type Era } from './lib/timeScale';
import { loadAncientSites, loadBattles, loadBattleViews, loadBattleMaps, loadTours, loadEvents, loadFauna } from './lib/data';
import { initPortraits } from './lib/portraits';
import { battleToPanel, siteToPanel, eventToPanel, faunaToPanel, BATTLE_FLY_ALTITUDE } from './lib/panel';
import { synthesizeBattleView } from './lib/synthBattle';
import type {
  AncientSite,
  Battle,
  BattleMapInfo,
  BattleView as BattleViewData,
  Fauna,
  PanelContent,
  TimelineEvent,
  Tour,
} from './lib/types';

/**
 * At speed 1×, the playhead takes this many seconds to travel the entire bar
 * (250 Mya → present). Because the scale is logarithmic, deep time whizzes by
 * and recent history unfolds slowly.
 */
const FULL_TRAVERSAL_SECONDS = 60;

/**
 * When zoomed in, the playhead advances linearly at this fraction of the
 * visible window per second (at 1× speed) — so a window of any size takes a
 * steady ~12 seconds to cross before it pages onward.
 */
const ZOOMED_FRACTION_PER_SEC = 0.08;

/** Used only if a tour step somehow has neither `year` nor `ma`. */
const PRESENT_FALLBACK_YEAR = 2026;

export default function App() {
  const [yearsBP, setYearsBP] = useState<number>(OLDEST_BP);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  // Timeline zoom level (index into ZOOM_SPANS). Default = full range (classic
  // log overview, detail rail hidden). Lifted here so the play loop can pace.
  const [zoomIdx, setZoomIdx] = useState(ZOOM_SPANS.length - 1);

  // Content + layer state.
  const [sites, setSites] = useState<AncientSite[]>([]);
  const [battles, setBattles] = useState<Battle[]>([]);
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [fauna, setFauna] = useState<Fauna[]>([]);
  const [showSites, setShowSites] = useState(true);
  const [showBorders, setShowBorders] = useState(true);
  const [showFlags, setShowFlags] = useState(true);
  const [showBattles, setShowBattles] = useState(true);
  const [showCampaigns, setShowCampaigns] = useState(true);
  const [showFauna, setShowFauna] = useState(true);
  // Imported-event categories — each gets its own Layers switch. Battles fold
  // into "Wars & battles" (showBattles) and monuments into "Ancient sites"
  // (showSites); cities, disasters and science get their own toggles below.
  const [showCities, setShowCities] = useState(true);
  const [showDisasters, setShowDisasters] = useState(true);
  const [showScience, setShowScience] = useState(true);
  const [showPeople, setShowPeople] = useState(true);
  const enabledEventCats = useMemo(() => {
    const s = new Set<string>();
    if (showBattles) s.add('battle');
    if (showSites) s.add('monument');
    if (showCities) s.add('city');
    if (showDisasters) s.add('disaster');
    if (showScience) {
      s.add('invention');
      s.add('discovery');
    }
    if (showPeople) s.add('person');
    s.add('event'); // no toggle yet — no dedicated 'event' data imported
    return s;
  }, [showBattles, showSites, showCities, showDisasters, showScience, showPeople]);
  // Which events the zoomed-in mural is showing, so the globe shows the same set
  // (null = not zoomed → globe uses its own "current era" window).
  const [muralEventIds, setMuralEventIds] = useState<string[] | null>(null);
  // The patch of Earth the camera is looking at (null = orbit / whole globe);
  // when set, the timeline tells that region's own story.
  const [viewRegion, setViewRegion] = useState<{ w: number; s: number; e: number; n: number } | null>(null);
  // The imported event you just picked (search/click) — its globe marker stays
  // visible even when the declutter caps would have hidden it.
  const [focusEventId, setFocusEventId] = useState<string | null>(null);
  const [campaignLabel, setCampaignLabel] = useState<string | null>(null);
  const [panel, setPanel] = useState<PanelContent | null>(null);
  const [battleViews, setBattleViews] = useState<Record<string, BattleViewData>>({});
  const [battleMaps, setBattleMaps] = useState<Record<string, BattleMapInfo>>({});
  const [activeBattleView, setActiveBattleView] = useState<string | null>(null);
  const [activeMonument, setActiveMonument] = useState<{
    model: string;
    title: string;
    lat: number;
    lon: number;
  } | null>(null);
  const [showAbout, setShowAbout] = useState(false);
  // A newer build has been deployed since this tab loaded — offer a refresh.
  const [newVersion, setNewVersion] = useState(false);

  useEffect(() => {
    let baseline: number | null = null;
    const check = () =>
      fetch(`${import.meta.env.BASE_URL}version.json`, { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : null))
        .then((j: { build?: number } | null) => {
          if (!j?.build) return;
          if (baseline === null) baseline = j.build;
          else if (j.build !== baseline) setNewVersion(true);
        })
        .catch(() => {
          /* offline or dev — no toast */
        });
    void check();
    const timer = window.setInterval(check, 10 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, []);
  const [, setPortraitsReady] = useState(false);
  const [tours, setTours] = useState<Tour[]>([]);
  const [activeTour, setActiveTour] = useState<Tour | null>(null);
  const [tourStep, setTourStep] = useState(0);

  const globeRef = useRef<GlobeHandle | null>(null);

  const yearsBPRef = useRef(yearsBP);
  useEffect(() => {
    yearsBPRef.current = yearsBP;
  }, [yearsBP]);

  useEffect(() => {
    loadAncientSites()
      .then(setSites)
      .catch((err) => console.error('Could not load ancient sites:', err));
    loadBattles()
      .then(setBattles)
      .catch((err) => console.error('Could not load battles:', err));
    loadEvents()
      .then(setEvents)
      .catch((err) => console.error('Could not load events:', err));
    loadFauna()
      .then(setFauna)
      .catch((err) => console.error('Could not load fauna:', err));
    loadBattleViews()
      .then(setBattleViews)
      .catch((err) => console.error('Could not load battle views:', err));
    loadBattleMaps()
      .then(setBattleMaps)
      .catch((err) => console.error('Could not load battle maps:', err));
    loadTours()
      .then(setTours)
      .catch((err) => console.error('Could not load tours:', err));
    // Portrait manifest; the state bump re-renders any open panel with images.
    initPortraits().then(() => setPortraitsReady(true));
  }, []);

  // Jump the timeline to a battle, fly the camera there, and open its panel.
  const handleJumpToBattle = (battle: Battle) => {
    setIsPlaying(false);
    setYearsBP(yearToYearsBP(battle.year));
    setPanel(battleToPanel(battle));
    globeRef.current?.flyTo(battle.lon, battle.lat, BATTLE_FLY_ALTITUDE);
  };

  // Search picks: jump to a site or an era.
  const handlePickSite = (site: AncientSite) => {
    setIsPlaying(false);
    setYearsBP(yearToYearsBP(site.builtYear));
    const content = siteToPanel(site);
    setPanel(content);
    if (content.fly) globeRef.current?.flyTo(content.fly.lon, content.fly.lat, content.fly.altitude);
  };

  const handlePickEra = (era: Era) => {
    setIsPlaying(false);
    setPanel(null);
    setYearsBP((era.startBP + era.endBP) / 2);
  };

  // Search picks from the imported world: jump the timeline, fly there, open the panel.
  const handlePickEvent = (e: TimelineEvent) => {
    setIsPlaying(false);
    setYearsBP(yearToYearsBP(e.startYear));
    setPanel(eventToPanel(e));
    setFocusEventId(e.id);
    globeRef.current?.flyTo(e.lon, e.lat, 600_000);
  };

  const handlePickFauna = (f: Fauna) => {
    setIsPlaying(false);
    setYearsBP(((f.fromMa + f.toMa) / 2) * 1_000_000);
    setPanel(faunaToPanel(f));
    globeRef.current?.flyTo(f.lon, f.lat, 6_000_000);
  };

  // Apply the current tour stop: move the timeline, fly the camera, open panels.
  useEffect(() => {
    if (!activeTour) return;
    const s = activeTour.steps[tourStep];
    if (!s) return;
    setIsPlaying(false);
    setYearsBP(s.ma !== undefined ? s.ma * 1_000_000 : yearToYearsBP(s.year ?? PRESENT_FALLBACK_YEAR));
    globeRef.current?.flyTo(s.lon, s.lat, s.altitude ?? 2_000_000);
    if (s.battleId) {
      const battle = battles.find((b) => b.id === s.battleId);
      setPanel(battle ? battleToPanel(battle) : null);
    } else {
      setPanel(null);
    }
  }, [activeTour, tourStep, battles]);

  // The play loop. At full zoom it advances logarithmically (deep time whizzes
  // by, recent history unfolds slowly). When zoomed in it advances linearly, so
  // the playhead crosses the visible window at an even, readable pace.
  useEffect(() => {
    if (!isPlaying) return;

    let raf = 0;
    let last = performance.now();
    const zoomedIn = zoomIdx < ZOOM_SPANS.length - 1;

    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;

      if (zoomedIn) {
        const next = yearsBPRef.current - ZOOM_SPANS[zoomIdx] * ZOOMED_FRACTION_PER_SEC * dt * speed;
        if (next <= 0) {
          setYearsBP(0);
          setIsPlaying(false);
          return;
        }
        setYearsBP(next);
      } else {
        // Gentle brake near the present: the log scale would otherwise sprint
        // through the last decades in a blink.
        const pos = yearsBPToPos(yearsBPRef.current);
        const brake = 1 - 0.78 * Math.min(1, Math.max(0, (pos - 0.88) / 0.12));
        const nextPos = pos + (dt / FULL_TRAVERSAL_SECONDS) * speed * brake;
        if (nextPos >= 1) {
          setYearsBP(posToYearsBP(1));
          setIsPlaying(false);
          return;
        }
        setYearsBP(posToYearsBP(nextPos));
      }
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isPlaying, speed, zoomIdx]);

  const handleTogglePlay = () => {
    // At full zoom, restarting from the present jumps back to the start.
    if (!isPlaying && zoomIdx === ZOOM_SPANS.length - 1 && yearsBPToPos(yearsBPRef.current) >= 0.999) {
      setYearsBP(OLDEST_BP);
    }
    setIsPlaying((p) => !p);
  };

  return (
    <div className="app">
      <Globe
        ref={globeRef}
        currentYearsBP={yearsBP}
        sites={sites}
        battles={battles}
        showSites={showSites}
        showBorders={showBorders}
        showFlags={showFlags}
        showBattles={showBattles}
        showCampaigns={showCampaigns}
        showFauna={showFauna}
        events={events}
        enabledEventCats={enabledEventCats}
        muralEventIds={muralEventIds}
        focusEventId={focusEventId}
        onSelect={setPanel}
        onCampaignLabel={setCampaignLabel}
        onSeek={(bp) => {
          setIsPlaying(false);
          setYearsBP(bp);
        }}
        onViewRegion={setViewRegion}
        onDive={(t) => {
          // The dive: zooming right down onto a marker opens its 3D scene.
          if (t.kind === 'battle') {
            if (battleViews[t.id]) setActiveBattleView(t.id);
            return;
          }
          if (t.kind === 'event') {
            const ev = events.find((e) => e.id === t.id);
            const m = ev && eventToPanel(ev).monument3d;
            if (m) setActiveMonument(m);
            return;
          }
          const site = sites.find((s) => s.id === t.id);
          const m = site && siteToPanel(site).monument3d;
          if (m) setActiveMonument(m);
        }}
      />

      {campaignLabel && <div className="campaign-banner">⚑ {campaignLabel}</div>}

      {newVersion && (
        <button className="version-toast" onClick={() => window.location.reload()}>
          ✨ A new version has landed — tap to refresh
        </button>
      )}

      {showBorders && (
        <div className="border-legend">
          <span>
            <i className="bl-swatch bl-peace" /> Peace
          </span>
          <span>
            <i className="bl-swatch bl-soon" /> Changing soon
          </span>
          <span>
            <i className="bl-swatch bl-war" /> War
          </span>
        </div>
      )}

      <div className="brand">
        <h1>Chronos Earth</h1>
        <p>250 million years of history · drag the timeline to travel</p>
      </div>

      <SearchBox
        sites={sites}
        battles={battles}
        events={events}
        fauna={fauna}
        onPickBattle={handleJumpToBattle}
        onPickSite={handlePickSite}
        onPickEra={handlePickEra}
        onPickEvent={handlePickEvent}
        onPickFauna={handlePickFauna}
      />

      <LayersPanel
        showSites={showSites}
        onToggleSites={setShowSites}
        showBorders={showBorders}
        onToggleBorders={setShowBorders}
        showFlags={showFlags}
        onToggleFlags={setShowFlags}
        showBattles={showBattles}
        onToggleBattles={setShowBattles}
        showCampaigns={showCampaigns}
        onToggleCampaigns={setShowCampaigns}
        showFauna={showFauna}
        onToggleFauna={setShowFauna}
        showCities={showCities}
        onToggleCities={setShowCities}
        showDisasters={showDisasters}
        onToggleDisasters={setShowDisasters}
        showScience={showScience}
        onToggleScience={setShowScience}
        showPeople={showPeople}
        onTogglePeople={setShowPeople}
        onAbout={() => setShowAbout(true)}
      />

      {showAbout && <About onClose={() => setShowAbout(false)} />}

      <Tours
        tours={tours}
        active={activeTour}
        step={tourStep}
        onStart={(tour) => {
          setActiveTour(tour);
          setTourStep(0);
        }}
        onStep={setTourStep}
        onExit={() => setActiveTour(null)}
      />

      <InfoPanel
        content={panel}
        onClose={() => {
          setPanel(null);
          setFocusEventId(null);
        }}
        onFly={(c) => c.fly && globeRef.current?.flyTo(c.fly.lon, c.fly.lat, c.fly.altitude)}
        onZoomToBattle={(id) => setActiveBattleView(id)}
        onViewMonument={setActiveMonument}
      />

      {activeBattleView &&
        (() => {
          const battle = battles.find((b) => b.id === activeBattleView);
          // Hand-crafted views win; every other battle gets a synthesised one.
          const view =
            battleViews[activeBattleView] ?? (battle ? synthesizeBattleView(battle) : undefined);
          if (!view) return null;
          return (
            <BattleView
              view={view}
              battle={battle}
              mapInfo={battleMaps[activeBattleView]}
              onClose={() => setActiveBattleView(null)}
            />
          );
        })()}

      {activeMonument && (
        <Suspense fallback={null}>
          <Monument3D
            model={activeMonument.model}
            title={activeMonument.title}
            lat={activeMonument.lat}
            lon={activeMonument.lon}
            onClose={() => setActiveMonument(null)}
          />
        </Suspense>
      )}

      <Timeline
        yearsBP={yearsBP}
        onChange={(v) => {
          setIsPlaying(false);
          setYearsBP(v);
        }}
        isPlaying={isPlaying}
        onTogglePlay={handleTogglePlay}
        speed={speed}
        onSpeedChange={setSpeed}
        battles={battles}
        onJumpToBattle={handleJumpToBattle}
        events={events}
        fauna={fauna}
        enabledEventCats={enabledEventCats}
        showFauna={showFauna}
        region={viewRegion}
        onSelect={setPanel}
        zoomIdx={zoomIdx}
        onZoomChange={setZoomIdx}
        onVisibleEvents={setMuralEventIds}
      />
    </div>
  );
}
