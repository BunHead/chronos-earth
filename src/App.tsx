import { useEffect, useMemo, useRef, useState } from 'react';
import Globe, { type GlobeHandle } from './components/Globe';
import {
  cellKeysForRect,
  loadRegionChunk,
  loadRegionIndex,
  type RegionIndex,
} from './lib/regionChunks';
import Timeline from './components/Timeline';
import InfoPanel from './components/InfoPanel';
import LayersPanel from './components/LayersPanel';
import BattleHud from './components/BattleHud';
import SearchBox from './components/SearchBox';
import About from './components/About';
import Tours from './components/Tours';
import AppMenu from './components/AppMenu';
import CompareMode from './components/CompareMode';
import SkyDial from './components/SkyDial';
import CompassFrame from './components/CompassFrame';
import WeatherOverlay from './components/WeatherOverlay';
import SeaLevelFrame from './components/SeaLevelFrame';
import { ensurePlacement } from './lib/globeModels';
import { showBattleOnGlobe, setGlobeBattlePhase, endGlobeBattle } from './lib/globeBattles';
import { parseBattleDate, seasonalTemperature } from './lib/battleSky';
import { fitFor } from './lib/monumentFit';
import { OLDEST_BP, ZOOM_SPANS, posToYearsBP, yearsBPToPos, yearToYearsBP, type Era } from './lib/timeScale';
import { useThrottledValue } from './lib/useThrottledValue';
import { loadAncientSites, loadBattles, loadBattleViews, loadTours, loadEvents, loadFauna } from './lib/data';
import { fetchByName } from './lib/liveFetch';
import { loadLiveCache, addToLiveCache } from './lib/liveCache';
import { initPortraits } from './lib/portraits';
import { battleToPanel, siteToPanel, eventToPanel, faunaToPanel, BATTLE_FLY_ALTITUDE } from './lib/panel';
import { synthesizeBattleView } from './lib/synthBattle';
import { buildSceneUrl, readSceneState, type SceneLayerKey } from './lib/sceneState';
import type {
  AncientSite,
  Battle,
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

interface TimeRiftState {
  snapshot: string;
  leftYearsBP: number;
  split: number;
}

export default function App() {
  const initialScene = useRef(readSceneState(window.location.search)).current;
  const layerStartsOn = (key: SceneLayerKey) => initialScene.layers?.has(key) ?? true;
  const [yearsBP, setYearsBP] = useState<number>(initialScene.yearsBP);
  // The globe's heavy per-tick work (markers, borders, drift) follows a
  // throttled timeline value — ~10×/second instead of the play loop's 60 — so
  // playback stays smooth. The playhead + readout still use the raw `yearsBP`.
  const heavyYearsBP = useThrottledValue(yearsBP, 100);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  // Timeline zoom level (index into ZOOM_SPANS). Default = full range (classic
  // log overview, detail rail hidden). Lifted here so the play loop can pace.
  const [zoomIdx, setZoomIdx] = useState(initialScene.zoomIdx);

  // Content + layer state.
  const [sites, setSites] = useState<AncientSite[]>([]);
  const [battles, setBattles] = useState<Battle[]>([]);
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [fauna, setFauna] = useState<Fauna[]>([]);
  const [showSites, setShowSites] = useState(layerStartsOn('sites'));
  const [showBorders, setShowBorders] = useState(layerStartsOn('borders'));
  const [showFlags, setShowFlags] = useState(layerStartsOn('flags'));
  const [showBattles, setShowBattles] = useState(layerStartsOn('battles'));
  const [showCampaigns, setShowCampaigns] = useState(layerStartsOn('campaigns'));
  const [showFauna, setShowFauna] = useState(layerStartsOn('fauna'));
  const [showSeaLevel, setShowSeaLevel] = useState(layerStartsOn('seas'));
  const [showRivers, setShowRivers] = useState(layerStartsOn('rivers'));
  // Imported-event categories — each gets its own Layers switch. Battles fold
  // into "Wars & battles" (showBattles) and monuments into "Ancient sites"
  // (showSites); cities, disasters and science get their own toggles below.
  const [showCities, setShowCities] = useState(layerStartsOn('cities'));
  const [showDisasters, setShowDisasters] = useState(layerStartsOn('disasters'));
  const [showEvents, setShowEvents] = useState(layerStartsOn('events'));
  const [showScience, setShowScience] = useState(layerStartsOn('science'));
  const [showPeople, setShowPeople] = useState(layerStartsOn('people'));
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
    // Treaties, conferences, summits — the imported 'event' category (the
    // Captain caught these ignoring the panel: they had no toggle).
    if (showEvents) s.add('event');
    return s;
  }, [showBattles, showSites, showCities, showDisasters, showEvents, showScience, showPeople]);
  // Which events the zoomed-in mural is showing, so the globe shows the same set
  // (null = not zoomed → globe uses its own "current era" window).
  const [muralEventIds, setMuralEventIds] = useState<string[] | null>(null);
  // Harvested long-tail history streams in by 20° cell as the camera settles
  // over a region (see lib/regionChunks + scripts/harvest-world.mjs). The
  // index is fetched once; missing index = harvest not run yet = feature off.
  const regionIndexRef = useRef<RegionIndex | null | 'pending'>('pending');
  const loadedCellsRef = useRef(new Set<string>());
  // The patch of Earth the camera is looking at (null = orbit / whole globe);
  // when set, the timeline tells that region's own story.
  const [viewRegion, setViewRegion] = useState<{ w: number; s: number; e: number; n: number } | null>(null);
  useEffect(() => {
    if (!viewRegion) return;
    let live = true;
    void (async () => {
      if (regionIndexRef.current === 'pending') {
        regionIndexRef.current = await loadRegionIndex(import.meta.env.BASE_URL);
      }
      const idx = regionIndexRef.current;
      if (!idx) return;
      const keys = cellKeysForRect(viewRegion).filter(
        (k) => idx.cells[k] && !loadedCellsRef.current.has(k),
      );
      if (keys.length === 0) return;
      for (const k of keys) loadedCellsRef.current.add(k);
      const fresh = (
        await Promise.all(keys.map((k) => loadRegionChunk(import.meta.env.BASE_URL, k)))
      ).flat();
      if (!live || fresh.length === 0) return;
      setEvents((prev) => {
        const seenIds = new Set(prev.map((e) => e.id));
        const seenQids = new Set(prev.map((e) => e.wikidataId).filter(Boolean));
        const add = fresh.filter(
          (e) => !seenIds.has(e.id) && !(e.wikidataId && seenQids.has(e.wikidataId)),
        );
        return add.length ? [...prev, ...add] : prev;
      });
    })();
    return () => {
      live = false;
    };
  }, [viewRegion]);
  // The imported event you just picked (search/click) — its globe marker stays
  // visible even when the declutter caps would have hidden it.
  const [focusEventId, setFocusEventId] = useState<string | null>(null);
  const [campaignLabel, setCampaignLabel] = useState<string | null>(null);
  const [panel, setPanel] = useState<PanelContent | null>(null);
  const panelRef = useRef(panel);
  panelRef.current = panel;
  const [toast, setToast] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast((t) => (t === msg ? null : t)), 3600);
  };
  const [battleViews, setBattleViews] = useState<Record<string, BattleViewData>>({});
  // A battle currently staged ON the globe (armies standing at the real site).
  const [globeBattle, setGlobeBattle] = useState<{ id: string; view: BattleViewData; phase: number } | null>(null);
  const [showAbout, setShowAbout] = useState(false);
  // The floating frames over the globe (⋯ menu toggles): Weather & Sky for
  // everyone — it lights the REAL globe by the real sun — and the compass.
  const [skyOpen, setSkyOpen] = useState(false);
  const [compassOpen, setCompassOpen] = useState(false);
  const [seaOpen, setSeaOpen] = useState(false);
  const [sky, setSky] = useState({
    date: new Date(),
    solarHours: 12,
    auto: false,
    moonPhase: 0.5,
    temperature: 18,
    cloud: 0.15,
  });
  // "Reduce motion" (in the ⋮ menu) sets a root attribute; CSS then stills the
  // app's transitions and animations for anyone who finds movement distracting.
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    document.documentElement.toggleAttribute('data-reduce-motion', reduceMotion);
  }, [reduceMotion]);
  // A newer build has been deployed since this tab loaded — offer a refresh.
  const [newVersion, setNewVersion] = useState(false);

  useEffect(() => {
    // The build baked into THIS running code. If the server's version.json
    // reports a different build, the tab is stale — even if it loaded old
    // bytes to begin with (the case a "changed-while-open" check would miss).
    const running = typeof __BUILD_ID__ === 'number' ? __BUILD_ID__ : 0;
    const check = () =>
      fetch(`${import.meta.env.BASE_URL}version.json`, { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : null))
        .then((j: { build?: number } | null) => {
          if (!j?.build) return;
          if (running && j.build !== running) setNewVersion(true);
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
  const [timeRift, setTimeRift] = useState<TimeRiftState | null>(null);

  const captureRiftLeft = () => {
    const snapshot = globeRef.current?.captureFrame();
    if (!snapshot) {
      showToast('This map imagery cannot be captured here. Try the modern or Natural Earth view.');
      return;
    }
    setIsPlaying(false);
    setTimeRift((current) => ({
      snapshot,
      // The globe follows the throttled value, so label the frozen frame with
      // the exact moment that was actually rendered rather than a playhead
      // that may be a few milliseconds ahead during playback.
      leftYearsBP: heavyYearsBP,
      split: current?.split ?? 50,
    }));
  };

  const toggleTimeRift = () => {
    if (timeRift) setTimeRift(null);
    else captureRiftLeft();
  };

  const enabledLayerKeys = (): SceneLayerKey[] => {
    const keys: SceneLayerKey[] = [];
    if (showSites) keys.push('sites');
    if (showBorders) keys.push('borders');
    if (showFlags) keys.push('flags');
    if (showBattles) keys.push('battles');
    if (showCampaigns) keys.push('campaigns');
    if (showFauna) keys.push('fauna');
    if (showSeaLevel) keys.push('seas');
    if (showRivers) keys.push('rivers');
    if (showCities) keys.push('cities');
    if (showDisasters) keys.push('disasters');
    if (showEvents) keys.push('events');
    if (showScience) keys.push('science');
    if (showPeople) keys.push('people');
    return keys;
  };

  const shareScene = async () => {
    const url = buildSceneUrl(window.location.href, {
      yearsBP,
      zoomIdx,
      layers: enabledLayerKeys(),
    });
    try {
      await navigator.clipboard.writeText(url);
      showToast('Scene link copied — anyone opening it will land at this moment.');
    } catch {
      window.history.replaceState(null, '', url);
      showToast('Scene link is ready in the address bar.');
    }
  };

  const yearsBPRef = useRef(yearsBP);
  useEffect(() => {
    yearsBPRef.current = yearsBP;
  }, [yearsBP]);

  // Keep an open "on the map" dossier honest as the timeline moves: rebuild it
  // for the new year so the ruling polity and its flag follow history instead of
  // freezing at the year you clicked. Gated on the current panel (read via ref so
  // this fires only on year change, never in a setPanel loop); closing the panel
  // or opening another one naturally stops the updates. Throttled year keeps it
  // cheap during playback.
  useEffect(() => {
    const p = panelRef.current;
    if (!p || !p.fly || !p.kicker?.startsWith('On the map')) return;
    const { lat, lon } = p.fly;
    const apply = () => {
      const cur = panelRef.current;
      // Only if it's still the same open dossier (user hasn't closed/moved on).
      if (!cur || !cur.fly || !cur.kicker?.startsWith('On the map')) return null;
      if (cur.fly.lat !== lat || cur.fly.lon !== lon) return null;
      const next = globeRef.current?.rebuildDossier(lat, lon);
      if (next) setPanel(next);
      return next ?? null;
    };
    const next = apply();
    // Border frames for a freshly-scrubbed year load async — if the polity
    // wasn't cached yet the rebuild comes back flagless; try once more shortly so
    // the flag isn't left blank after the timeline settles. (Superseded by the
    // next scrub via the cleanup.)
    if (next && !next.flag) {
      const t = window.setTimeout(apply, 500);
      return () => window.clearTimeout(t);
    }
  }, [heavyYearsBP]);

  useEffect(() => {
    loadAncientSites()
      .then(setSites)
      .catch((err) => console.error('Could not load ancient sites:', err));
    loadBattles()
      .then(setBattles)
      .catch((err) => console.error('Could not load battles:', err));
    loadEvents()
      .then((evs) => {
        // Fold in any places you found live on earlier visits.
        const cached = loadLiveCache();
        if (!cached.length) return setEvents(evs);
        const ids = new Set(evs.map((e) => e.id));
        setEvents([...evs, ...cached.filter((e) => !ids.has(e.id))]);
      })
      .catch((err) => console.error('Could not load events:', err));
    loadFauna()
      .then(setFauna)
      .catch((err) => console.error('Could not load fauna:', err));
    loadBattleViews()
      .then(setBattleViews)
      .catch((err) => console.error('Could not load battle views:', err));
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

  // The dial drives the REAL sun: solar time at the current view's longitude
  // converts to UTC, and Cesium lights the day/night line accordingly.
  useEffect(() => {
    if (!skyOpen) {
      globeRef.current?.setSunLighting(false);
      return;
    }
    const lon = viewRegion ? (viewRegion.w + viewRegion.e) / 2 : 0;
    globeRef.current?.setSunTime(sky.date, sky.solarHours, lon);
  }, [skyOpen, sky.date, sky.solarHours, viewRegion]);

  // The dial's play button: the day rolls on while it's unpaused.
  useEffect(() => {
    if (!skyOpen || !sky.auto) return;
    const t = window.setInterval(
      () => setSky((s) => ({ ...s, solarHours: (s.solarHours + 0.12) % 24 })),
      250,
    );
    return () => window.clearInterval(t);
  }, [skyOpen, sky.auto]);

  // THE GLOBE IS THE VIEWER: no pop-up scene. Place the monument's model at
  // its real site, make sure the timeline sits in an era where it stands,
  // switch the Sites layer on, and dive the camera down to it.
  const visitMonument = (m: NonNullable<PanelContent['monument3d']>) => {
    setIsPlaying(false);
    // Nudge to the year the model is ACTUALLY born on the globe (a curated
    // placement's build year, not the event's looser date) so it stands the
    // instant you arrive — the Eye no longer waits a year to appear.
    const placedYear = ensurePlacement(m) ?? m.builtYear;
    setShowSites(true);
    if (placedYear != null && yearsBP > yearToYearsBP(placedYear)) {
      setYearsBP(yearToYearsBP(placedYear));
    }
    globeRef.current?.flyToMonument(m.lon, m.lat, fitFor(m.title, m.model).widthM);
  };

  // THE GLOBE IS THE BATTLEFIELD: nudge the timeline to the day, dive to
  // the real ground, and raise the armies where they actually fought.
  const visitBattle = (id: string, fly = true) => {
    const battle = battles.find((b) => b.id === id);
    if (!battle) return;
    const view = battleViews[id] ?? synthesizeBattleView(battle);
    setIsPlaying(false);
    setYearsBP(yearToYearsBP(battle.year));
    if (fly) globeRef.current?.flyToMonument(battle.lon, battle.lat, 900);
    showBattleOnGlobe(battle.lat, battle.lon, view);
    setGlobeBattle({ id, view, phase: 0 });
    // The sky over the field is the sky of the day: the dial opens set to
    // the battle's real season, a morning sun, and a temperature that fits
    // the latitude and month. Each phase then wears the day on.
    const date = parseBattleDate(battle.dateLabel) ?? new Date(Date.UTC(2026, 6, 15));
    setSky((s) => ({
      ...s,
      date,
      solarHours: 9.5,
      auto: false,
      temperature: seasonalTemperature(battle.lat, date),
    }));
    setSkyOpen(true);
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

  // Type a date/year in the search box and land on it. For historical years we
  // also drop into a tighter linear window so the year is legible, not lost in
  // the deep-time overview.
  const handlePickYear = (year: number) => {
    setIsPlaying(false);
    setPanel(null);
    setYearsBP(yearToYearsBP(year));
    if (year > -12000) setZoomIdx(1); // ~1,000-year window
  };

  // Search picks from the imported world: jump the timeline, fly there, open the panel.
  const handlePickEvent = (e: TimelineEvent) => {
    setIsPlaying(false);
    setYearsBP(yearToYearsBP(e.startYear));
    setPanel(eventToPanel(e));
    setFocusEventId(e.id);
    globeRef.current?.flyTo(e.lon, e.lat, 600_000);
  };

  // "Look it up online": fetch a place we don't have from Wikidata, add it as a
  // live event (marker + panel), and remember it for next time.
  const handleWebSearch = async (query: string) => {
    showToast(`Searching the web for “${query}”…`);
    const found = await fetchByName(query);
    if (!found.length) {
      showToast(`Couldn't find “${query}” online.`);
      return;
    }
    const ev = found[0];
    setEvents((prev) =>
      prev.some((e) => e.id === ev.id || (ev.wikidataId && e.wikidataId === ev.wikidataId))
        ? prev
        : [...prev, ev],
    );
    addToLiveCache(ev);
    handlePickEvent(ev);
    showToast(`Added ${ev.name} · ${ev.startYear < 0 ? `${-ev.startYear} BCE` : `${ev.startYear} CE`}`);
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
    <div className={`app${timeRift ? ' compare-active' : ''}`}>
      <a className="skip-link" href="#chronos-search">Skip to search</a>
      <Globe
        ref={globeRef}
        currentYearsBP={heavyYearsBP}
        cameraLocked={Boolean(timeRift)}
        sites={sites}
        battles={battles}
        showSites={showSites}
        showBorders={showBorders}
        showFlags={showFlags}
        showBattles={showBattles}
        showCampaigns={showCampaigns}
        showFauna={showFauna}
        showSeaLevel={showSeaLevel}
        showRivers={showRivers}
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
          // The dive: zooming right down onto a marker — make sure the
          // monument is standing there on the globe when you arrive.
          if (t.kind === 'battle') {
            // Already diving by hand — raise the armies without a camera fight.
            if (globeBattle?.id !== t.id) visitBattle(t.id, false);
            return;
          }
          if (t.kind === 'event') {
            const ev = events.find((e) => e.id === t.id);
            const m = ev && eventToPanel(ev).monument3d;
            if (m) ensurePlacement(m);
            return;
          }
          const site = sites.find((s) => s.id === t.id);
          const m = site && siteToPanel(site).monument3d;
          if (m) ensurePlacement(m);
        }}
      />

      {timeRift && (
        <CompareMode
          snapshot={timeRift.snapshot}
          leftYearsBP={timeRift.leftYearsBP}
          rightYearsBP={yearsBP}
          split={timeRift.split}
          onSplitChange={(split) => setTimeRift((current) => current && { ...current, split })}
          onCaptureLeft={captureRiftLeft}
          onClose={() => setTimeRift(null)}
        />
      )}

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

      <div className="brand" role="banner">
        <div className="brand-text">
          <h1>Chronos Earth</h1>
          <p>250 million years of history · drag the timeline to travel</p>
        </div>
        <AppMenu
          tours={tours}
          onStartTour={(tour) => { setActiveTour(tour); setTourStep(0); }}
          onShare={() => void shareScene()}
          onAbout={() => setShowAbout(true)}
          skyOpen={skyOpen}
          onToggleSky={() => setSkyOpen((v) => !v)}
          compassOpen={compassOpen}
          onToggleCompass={() => setCompassOpen((v) => !v)}
          seaOpen={seaOpen}
          onToggleSea={() => {
            setSeaOpen((v) => {
              if (v) globeRef.current?.setManualSea(null); // closing hands the water back
              return !v;
            });
          }}
          reduceMotion={reduceMotion}
          onReduceMotion={setReduceMotion}
        />
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
        onPickYear={handlePickYear}
        onPickFauna={handlePickFauna}
        onWebSearch={handleWebSearch}
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
        showSeaLevel={showSeaLevel}
        onToggleSeaLevel={setShowSeaLevel}
        showRivers={showRivers}
        onToggleRivers={setShowRivers}
        showCities={showCities}
        onToggleCities={setShowCities}
        showDisasters={showDisasters}
        showEvents={showEvents}
        onToggleEvents={setShowEvents}
        onToggleDisasters={setShowDisasters}
        showScience={showScience}
        onToggleScience={setShowScience}
        showPeople={showPeople}
        onTogglePeople={setShowPeople}
      />

      {showAbout && <About onClose={() => setShowAbout(false)} />}

      {skyOpen && (
        <div className="app-sky">
        <SkyDial
          date={sky.date}
          solarHours={sky.solarHours}
          auto={sky.auto}
          moonPhase={sky.moonPhase}
          temperature={sky.temperature}
          cloud={sky.cloud}
          latitude={viewRegion ? (viewRegion.s + viewRegion.n) / 2 : 51.5}
          title="the globe"
          onChange={(next) => {
            setSky((s) => ({ ...s, ...next }));
            // The sun commands the field: dragging time forward or back
            // marches the battle to the phase that hour belongs to.
            if (globeBattle && next.solarHours != null) {
              const idx = Math.max(
                0,
                Math.min(
                  globeBattle.view.phases.length - 1,
                  Math.round((next.solarHours - 9.5) / 1.5),
                ),
              );
              if (idx !== globeBattle.phase) {
                setGlobeBattlePhase(globeBattle.view, idx);
                setGlobeBattle({ ...globeBattle, phase: idx });
              }
            }
          }}
        />
        </div>
      )}

      {/* The dial's weather, painted over the air when you're down low. */}
      <WeatherOverlay
        temperature={sky.temperature}
        cloud={sky.cloud}
        active={skyOpen && !!viewRegion && viewRegion.n - viewRegion.s < 4}
        reduceMotion={reduceMotion}
      />

      {seaOpen && (
        <SeaLevelFrame
          onSea={(m) => globeRef.current?.setManualSea(m)}
          onClose={() => setSeaOpen(false)}
        />
      )}

      {compassOpen && (
        <CompassFrame
          getHeading={() => globeRef.current?.getHeading() ?? 0}
          onResetNorth={() => globeRef.current?.resetNorth()}
          onClose={() => setCompassOpen(false)}
        />
      )}

      {toast && <div className="app-toast">{toast}</div>}

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
        onZoomToBattle={visitBattle}
        onViewMonument={visitMonument}
      />

      {globeBattle && (
        <BattleHud
          view={globeBattle.view}
          phase={globeBattle.phase}
          onPhase={(i) => {
            setGlobeBattlePhase(globeBattle.view, i);
            // The day wears on with the fighting — stepping forward moves
            // the sun; the dial (and the real day/night line) follow.
            if (i > globeBattle.phase) {
              setSky((s) => ({ ...s, solarHours: (s.solarHours + 1.5) % 24 }));
            }
            setGlobeBattle({ ...globeBattle, phase: i });
          }}
          onClose={() => {
            endGlobeBattle();
            setGlobeBattle(null);
          }}
        />
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
        onFlyTo={(lon, lat) => globeRef.current?.flyTo(lon, lat, 400_000)}
        events={events}
        fauna={fauna}
        enabledEventCats={enabledEventCats}
        showFauna={showFauna}
        region={viewRegion}
        onSelect={setPanel}
        zoomIdx={zoomIdx}
        onZoomChange={setZoomIdx}
        onVisibleEvents={setMuralEventIds}
        compareLeftBP={timeRift?.leftYearsBP}
        onToggleCompare={toggleTimeRift}
      />
    </div>
  );
}
