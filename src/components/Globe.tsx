import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import * as Cesium from 'cesium';
// NOTE: Cesium's widget CSS is NOT imported here. vite-plugin-cesium already
// injects `<link href="cesium/Widgets/widgets.css">` into index.html, so
// importing it again would bundle a second ~30 KB copy into the app's main
// stylesheet (a duplicate download on every page load). Loading it only via the
// plugin keeps the critical CSS lean.
import type { AncientSite, Battle, PanelContent, TimelineEvent } from '../lib/types';
import { yearToYearsBP, yearsBPToYear } from '../lib/timeScale';
import { loadGlobeModels, updateGlobeModelVisibility, reseatAll } from '../lib/globeModels';
import { buildEventIndex } from '../lib/eventIndex';
import { siteToPanel, placeDossierPanel, battleToPanel, eventToPanel, BATTLE_FLY_ALTITUDE } from '../lib/panel';
import { siteIcon, eventIcon, ICONS } from '../lib/markerIcons';
import { PaleoController } from './paleo';
import { SeaLevelController } from './seaLevel';
import { OceanDrainController } from './oceanDrain';
import { RiversController } from './rivers';
import { BordersController } from './borders';
import { CampaignController } from './campaign';
import { FaunaController, type FaunaEntry } from './fauna';
import { DisasterFx, CURATED_DISASTERS, CURATED_YEARS, disasterKindFor } from './disasterFx';
import { fetchNearbyHistory } from '../lib/liveFetch';

/** A battle marker is visible from its date until this many years after it —
 * battles are moments, so they show while news of them would still be fresh.
 * (Kept in sync with the timeline's red pin flare and the red war borders.) */
const BATTLE_VISIBLE_YEARS = 3;

/** Markers clamped to terrain sit exactly on the depth surface, so the depth
 * test would bury them in the ground when viewed from above. Within this
 * camera distance (m) the test is skipped — close enough that a marker can
 * never be beyond the horizon, so far-side markers still hide correctly. */
const MARKER_DEPTH_TEST_DISTANCE = 1_000_000;

/** How many imported events show at once, capped per category so cities
 * (which have the most sitelinks) don't crowd out the rest. The caps grow as
 * the camera descends: from orbit only the world-famous; near street level,
 * everything we have. Index = zoom tier (0 orbit … 3 low). */
const EVENT_MAX_VISIBLE_BY_TIER = [34, 52, 80, 130];
const EVENT_PER_CATEGORY_BY_TIER = [10, 16, 25, 42];
/** Reusable marker pool: only ever as many entities as can be shown at once
 * (max visible + focus + headroom), NOT one per import — so the globe's cost is
 * flat whether there are 2,000 events or 200,000. Assigned in the visibility
 * effect; the other 99% of imports stay as cheap plain data until shown. */
const EVENT_POOL_SIZE = 180;
/** A year slice this wide around the playhead safely contains every event that
 * eventVisibleAt could keep on screen — its widest window is ±150 years, and
 * the deep-time age-stretch multiplies that by at most 30 (= 4,500). We query a
 * touch beyond, then apply the exact test. So the index narrows without ever
 * dropping a visible event. */
const EVENT_QUERY_SPAN = 5000;

/** Camera height (m) → zoom tier 0..3. */
function zoomTierFor(height: number): number {
  if (height > 9_000_000) return 0;
  if (height > 3_500_000) return 1;
  if (height > 1_200_000) return 2;
  return 3;
}

/** Ease-out-back: a little overshoot so markers pop in with a bounce. */
function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

/** Marker scale grows with fame, so Waterloo outranks a skirmish at a glance. */
function fameScale(notability: number | undefined, base: number): number {
  const t = Math.min(1, (notability ?? 0) / 350);
  return base * (0.8 + 0.55 * t);
}

/** Whether an event is "current" — visible for as long as its real effects
 * last, not a fixed window either side. A battle shows for its moment; a
 * disaster for its duration (or a short aftermath); a person for a lifetime
 * after their birth; cities and monuments are sparse milestones, so they keep
 * a generous window. Deep-past events get their windows stretched with age —
 * the snapshots of history are coarser back then, and the map would otherwise
 * be empty. */
function eventVisibleAt(ev: TimelineEvent, year: number): boolean {
  // Records get sparser the further back we go: widen windows with age so a
  // 3000 BCE view still has something to show (×1 in modern times, up to ×30).
  const age = Math.min(30, Math.max(1, -ev.startYear / 300));
  const from = ev.startYear;
  if (ev.category === 'battle') {
    // Famous battles linger (Hastings stays findable); skirmishes pass quickly.
    const linger = 3 + 9 * Math.min(1, (ev.notability ?? 0) / 350);
    return year >= from && year <= from + linger * age;
  }
  if (ev.category === 'disaster') {
    const until = ev.endYear !== undefined ? ev.endYear + 2 : from + 5 * age;
    return year >= from && year <= until;
  }
  // People show only while alive: birth → death when known, else a lifetime.
  if (ev.category === 'person') {
    return year >= from && year <= (ev.endYear ?? from + 85 * age);
  }
  // Treaties & agreements: they take effect at signing and matter for
  // generations after — but never before.
  if (ev.category === 'event') return year >= from && year <= from + 120 * age;
  // Milestones (cities, monuments, discoveries…): wide symmetric window, or
  // their whole span when they have one.
  return (
    Math.abs(from - year) <= 150 * age ||
    (ev.endYear !== undefined && year >= from && year <= ev.endYear)
  );
}

/** Imperative handle so other components (panel, search) can move the camera. */
export interface GlobeHandle {
  flyTo: (lon: number, lat: number, altitude: number) => void;
  /** Dive to a monument standing on the globe: oblique approach from the
   * south, framed by the monument's real width in metres. */
  flyToMonument: (lon: number, lat: number, widthM: number) => void;
  /** Weather & Sky dial: light the globe by the real sun at this solar time
   * (solar time at lonRef converts to UTC), or switch real lighting off. */
  setSunTime: (date: Date, solarHours: number, lonRef: number) => void;
  setSunLighting: (on: boolean) => void;
  /** Compass: current camera heading in degrees, and a swing back to north. */
  getHeading: () => number;
  resetNorth: () => void;
  /** Sea level frame: manual sea in metres vs today (null = engine off). */
  setManualSea: (seaM: number | null) => void;
  /** Freeze the current globe pixels for the Time Rift comparison overlay. */
  captureFrame: () => string | null;
  /** Recompute the open "on the map" dossier for the current year so its ruling
   * polity + flag follow the timeline instead of freezing at the clicked year. */
  rebuildDossier: (lat: number, lon: number) => PanelContent;
}

interface GlobeProps {
  /** Current position in time, in years before present. */
  currentYearsBP: number;
  /** Time Rift freezes the camera so its captured left frame stays registered. */
  cameraLocked?: boolean;
  sites: AncientSite[];
  battles: Battle[];
  showSites: boolean;
  showBorders: boolean;
  /** Paint real flag artwork inside borders. */
  showFlags: boolean;
  showBattles: boolean;
  showCampaigns: boolean;
  showFauna: boolean;
  /** Fade in the Ice Age exposed-shelf land bridges as the seas fall. */
  showSeaLevel: boolean;
  /** Draw the curated great rivers whose courses shifted over time. */
  showRivers: boolean;
  events: TimelineEvent[];
  /** Imported-event categories currently enabled in the Layers panel. */
  enabledEventCats: Set<string>;
  /** When zoomed into the mural, the exact event ids it's showing (else null). */
  muralEventIds: string[] | null;
  /** A just-picked event whose marker must show even past the declutter caps. */
  focusEventId: string | null;
  onSelect: (content: PanelContent) => void;
  /** Reports the current war-front-line moment (or null) for a banner. */
  onCampaignLabel: (label: string | null) => void;
  /** Move the timeline to a clicked marker's date (globe → timeline sync). */
  onSeek: (yearsBP: number) => void;
  /** The dive: keep zooming onto a 3D-capable marker and this fires once so
   * the app can open its 3D scene. Re-arms when the camera climbs again. */
  onDive: (target: { kind: 'battle' | 'site' | 'event'; id: string }) => void;
  /** Reports the patch of Earth in view once zoomed toward a region (null at
   * orbit) — the timeline uses it to tell that region's own story. */
  onViewRegion: (rect: { w: number; s: number; e: number; n: number } | null) => void;
}

/** Diving below this camera height (m) over a marker opens its 3D scene.
 * Generous: real scroll-wheel zooming decelerates near the ground, so a
 * too-low threshold is never crossed in practice. */
const DIVE_HEIGHT = 75_000;
/** …and climbing above this (m) re-arms the dive. */
const DIVE_REARM_HEIGHT = 250_000;
/** How close (degrees, ~50 km) the camera must be over the marker. */
const DIVE_RADIUS_DEG = 0.45;

/** Deep time (continents drifting) begins at 4 million years before present. */
const PALEO_MA = 4;

const Globe = forwardRef<GlobeHandle, GlobeProps>(function Globe(
  { currentYearsBP, cameraLocked = false, sites, battles, showSites, showBorders, showFlags, showBattles, showCampaigns, showFauna, showSeaLevel, showRivers, events, enabledEventCats, muralEventIds, focusEventId, onSelect, onCampaignLabel, onSeek, onDive, onViewRegion },
  ref,
) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<Cesium.Viewer | null>(null);
  const cameraLockedRef = useRef(cameraLocked);
  cameraLockedRef.current = cameraLocked;
  const paleoRef = useRef<PaleoController | null>(null);
  const seaRef = useRef<SeaLevelController | null>(null);
  const oceanRef = useRef<OceanDrainController | null>(null);
  // While the manual Sea level frame is active it owns the water — the
  // timeline's ice-age overlay stands down until the frame lets go.
  const manualSeaActiveRef = useRef(false);
  const riversRef = useRef<RiversController | null>(null);
  const bordersRef = useRef<BordersController | null>(null);
  const campaignRef = useRef<CampaignController | null>(null);
  const faunaRef = useRef<FaunaController | null>(null);
  const fxRef = useRef<DisasterFx | null>(null);
  /** Disasters already played this session (no reruns on every scrub-past). */
  const playedFxRef = useRef(new Set<string>());
  const onCampaignLabelRef = useRef(onCampaignLabel);
  onCampaignLabelRef.current = onCampaignLabel;
  /** The modern-Earth imagery layers (Natural Earth fallback + sharp satellite). */
  const modernLayersRef = useRef<Cesium.ImageryLayer[]>([]);
  /** Real-elevation terrain, once loaded, and whether it is currently applied. */
  const terrainRef = useRef<{ provider: Cesium.TerrainProvider | null; active: boolean }>({
    provider: null,
    active: false,
  });
  const yearsBPRef = useRef(currentYearsBP);
  yearsBPRef.current = currentYearsBP;
  const entitiesRef = useRef<Map<string, Cesium.Entity>>(new Map());
  const battleEntitiesRef = useRef<Map<string, Cesium.Entity>>(new Map());
  const eventPoolRef = useRef<Cesium.Entity[]>([]);
  // Which event id currently owns which pooled marker, so a marker keeps its
  // slot (and stays put) as long as its event is on screen.
  const eventAssignRef = useRef<Map<string, Cesium.Entity>>(new Map());
  // Ids of imported events that duplicate a curated battle/site — hidden in the
  // overview, but still built so the zoomed-in mural can match every circle.
  const dupEventIdsRef = useRef<Set<string>>(new Set());
  // For each duplicate, WHICH curated marker replaces it — so the zoomed view
  // only hides the import while its curated twin is actually on screen.
  const dupTwinRef = useRef<Map<string, { kind: 'battle' | 'site'; id: string }>>(new Map());
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const onSeekRef = useRef(onSeek);
  onSeekRef.current = onSeek;
  const onDiveRef = useRef(onDive);
  onDiveRef.current = onDive;
  /** Bumped per empty-ground click, so a stale live-fetch can't repaint a newer dossier. */
  const dossierSeqRef = useRef(0);
  /** Markers for live-fetched finds — replaced whenever a new area is asked,
   * cleared when the camera leaves that area (anchor below). */
  const liveEntitiesRef = useRef<Map<string, Cesium.Entity>>(new Map());
  const liveAnchorRef = useRef<{ lat: number; lon: number } | null>(null);
  const onViewRegionRef = useRef(onViewRegion);
  onViewRegionRef.current = onViewRegion;
  /** True after a dive fired; re-arms once the camera climbs back up. */
  const divedRef = useRef(false);
  const eventsRef = useRef(events);
  eventsRef.current = events;
  /** More markers reveal themselves as the camera descends. */
  const [zoomTier, setZoomTier] = useState(0);
  // Below ~400 km the world-scale paintings (borders fill, rivers, ice-age
  // seas, campaign strokes — all coarse full-globe textures) smear across
  // the ground and hide the terrain. They retire close-up.
  const [closeUp, setCloseUp] = useState(false);
  /** What the camera can see (degrees), so zooming into a region fills THAT
   * region with markers instead of spending the quota worldwide. */
  const [viewRect, setViewRect] = useState<{ w: number; s: number; e: number; n: number } | null>(
    null,
  );
  const viewRectKeyRef = useRef('');

  // Tell the app what region we're looking at (null at orbit / whole globe).
  useEffect(() => {
    onViewRegionRef.current(zoomTier >= 1 ? viewRect : null);
  }, [zoomTier, viewRect]);

  // Crisp borders under zoom: the border engine re-rasterises the viewed
  // region at high resolution once the camera is properly down.
  useEffect(() => {
    bordersRef.current?.setDetailRegion(zoomTier >= 2 && viewRect ? viewRect : null);
  }, [zoomTier, viewRect]);

  // Linger deep over ANY region and it quietly asks Wikidata for its own
  // history — Derbyshire summons its silk mills, Greece its ancients. The
  // per-area cache means each patch of Earth is only ever asked once.
  useEffect(() => {
    if (zoomTier < 3 || !viewRect) return;
    const timer = window.setTimeout(() => {
      const lat = (viewRect.s + viewRect.n) / 2;
      const lon =
        viewRect.e >= viewRect.w
          ? (viewRect.w + viewRect.e) / 2
          : ((((viewRect.w + viewRect.e + 360) / 2 + 180) % 360) - 180);
      void fetchNearbyHistory(lat, lon).then((live) => spawnLiveMarkers(live, { lat, lon }));
    }, 1500);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoomTier, viewRect]);
  // Markers mid-pop (grow-in animation) and the timer driving them.
  const popAnimsRef = useRef<Map<Cesium.Entity, { t0: number; base: number }>>(new Map());
  const popTimerRef = useRef<number | null>(null);

  /** Animate a marker's billboard from tiny to its full size with a bounce.
   * `delay` staggers a batch into a cascade instead of a simultaneous blink. */
  const popIn = (entity: Cesium.Entity, delay = 0) => {
    const base = (entity as Cesium.Entity & { chronosScale?: number }).chronosScale ?? 0.4;
    const bb0 = entity.billboard as unknown as { scale: number } | undefined;
    if (bb0) bb0.scale = 0.01; // invisible until its turn in the cascade
    popAnimsRef.current.set(entity, { t0: performance.now() + delay, base });
    if (popTimerRef.current !== null) return;
    popTimerRef.current = window.setInterval(() => {
      const now = performance.now();
      for (const [ent, a] of popAnimsRef.current) {
        const t = (now - a.t0) / 340;
        const bb = ent.billboard as unknown as { scale: number } | undefined;
        if (!bb) {
          popAnimsRef.current.delete(ent);
          continue;
        }
        if (t < 0) continue; // still waiting for its cascade slot
        if (t >= 1) {
          bb.scale = a.base;
          popAnimsRef.current.delete(ent);
        } else {
          bb.scale = Math.max(0.01, a.base * easeOutBack(t));
        }
      }
      if (popAnimsRef.current.size === 0 && popTimerRef.current !== null) {
        window.clearInterval(popTimerRef.current);
        popTimerRef.current = null;
      }
    }, 33);
  };

  /** Live-fetched finds become globe markers in the house style — category
   * badge, fame-sized, cascading pop-in. Replaces the previous live batch. */
  const spawnLiveMarkers = (live: TimelineEvent[], anchor: { lat: number; lon: number }) => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed() || live.length === 0) return;
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '');
    const have = new Set(eventsRef.current.map((e) => norm(e.name)));
    const fresh = live.filter((ev) => !have.has(norm(ev.name)));
    if (fresh.length === 0) return;
    for (const old of liveEntitiesRef.current.values()) viewer.entities.remove(old);
    liveEntitiesRef.current.clear();
    liveAnchorRef.current = anchor;
    let order = 0;
    for (const ev of fresh) {
      const scale = fameScale(ev.notability, 0.4);
      const entity = viewer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(ev.lon, ev.lat),
        show: false,
        billboard: {
          image: eventIcon(ev.category),
          scale,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          disableDepthTestDistance: MARKER_DEPTH_TEST_DISTANCE,
        },
        label: {
          text: ev.name,
          font: '12px "Segoe UI", sans-serif',
          fillColor: Cesium.Color.WHITE,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 3,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          pixelOffset: new Cesium.Cartesian2(0, -28),
          distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 1_500_000),
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          disableDepthTestDistance: MARKER_DEPTH_TEST_DISTANCE,
        },
      });
      const tagged = entity as Cesium.Entity & { chronosEvent?: TimelineEvent; chronosScale?: number };
      tagged.chronosEvent = ev;
      tagged.chronosScale = scale;
      setShownPop(entity, true, Math.min(order * 70, 900));
      order++;
      liveEntitiesRef.current.set(ev.id, entity);
    }
  };

  /** Show/hide a marker; a fresh appearance pops in instead of just blinking on.
   * Returns true when the marker newly appeared (so callers can stagger). */
  const setShownPop = (entity: Cesium.Entity, show: boolean, delay = 0): boolean => {
    if (show && !entity.show) {
      entity.show = true;
      popIn(entity, delay);
      return true;
    }
    if (!show && entity.show) entity.show = false;
    return false;
  };

  const flyTo = (lon: number, lat: number, height: number) => {
    if (cameraLockedRef.current) return;
    viewerRef.current?.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(lon, lat, height),
      duration: 2,
    });
  };

  const flyToMonument = (lon: number, lat: number, widthM: number) => {
    const viewer = viewerRef.current;
    if (cameraLockedRef.current || !viewer) return;
    // Dress the ground as early as possible: preload neighbouring tiles and
    // keep more of them cached so revisits arrive fully dressed.
    viewer.scene.globe.preloadSiblings = true;
    viewer.scene.globe.tileCacheSize = 400;
    // Stand off to the south and look north-down at the site, close enough
    // that the model fills the view but stays inside its reveal distance.
    const dist = Math.min(60_000, Math.max(600, widthM * 5));
    const offsetLat = lat - (dist * 0.9) / 111_000;
    // TWO-STAGE DIVE: sprint to a spot high above the target first — the
    // camera is over the destination within a second, so its imagery starts
    // streaming immediately — then make the slow oblique descent onto
    // ground that is already dressing itself.
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(lon, lat, Math.max(dist * 8, 60_000)),
      duration: 1.3,
      complete: () => {
        viewer.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(lon, offsetLat, dist * 0.75),
          orientation: { heading: 0, pitch: Cesium.Math.toRadians(-38), roll: 0 },
          duration: 2.4,
        });
      },
    });
  };

  const setSunLighting = (on: boolean) => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;
    viewer.scene.globe.enableLighting = on;
    viewer.scene.requestRender();
  };

  const setSunTime = (date: Date, solarHours: number, lonRef: number) => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;
    viewer.scene.globe.enableLighting = true;
    // Solar time at the reference longitude → UTC: the sun is overhead at
    // solar noon, and each 15° of longitude is an hour.
    const utcMs =
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) +
      (solarHours - lonRef / 15) * 3_600_000;
    viewer.clock.currentTime = Cesium.JulianDate.fromDate(new Date(utcMs));
    viewer.clock.shouldAnimate = false;
    viewer.scene.requestRender();
  };

  const getHeading = () => {
    const viewer = viewerRef.current;
    return viewer && !viewer.isDestroyed() ? Cesium.Math.toDegrees(viewer.camera.heading) : 0;
  };

  const resetNorth = () => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed() || cameraLockedRef.current) return;
    const c = viewer.camera.positionCartographic;
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromRadians(c.longitude, c.latitude, c.height),
      orientation: { heading: 0, pitch: viewer.camera.pitch, roll: 0 },
      duration: 0.8,
    });
  };

  const captureFrame = (): string | null => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return null;
    try {
      // Cesium normally renders on demand. Force one synchronous frame so the
      // canvas is populated immediately before it is copied.
      viewer.scene.render();
      return viewer.scene.canvas.toDataURL('image/jpeg', 0.9);
    } catch {
      // A third-party imagery provider can make a WebGL canvas non-exportable.
      // Compare mode degrades cleanly instead of breaking the rest of the app.
      return null;
    }
  };

  /** Real mountains only make sense on the modern Earth — deep time (drifting
   * continents) goes back to the smooth ellipsoid, since today's mountain
   * ranges did not exist yet. */
  const applyTerrain = (on: boolean) => {
    const viewer = viewerRef.current;
    const t = terrainRef.current;
    if (!viewer || viewer.isDestroyed() || !t.provider || t.active === on) return;
    t.active = on;
    viewer.terrainProvider = on ? t.provider : new Cesium.EllipsoidTerrainProvider();
    // The ground just moved — re-seat every monument or they keep the OLD
    // ground's height and float ("raised into the heavens", daylight cut).
    reseatAll();
  };

  // The Sea level frame's hand on the water: metres vs today, null = off.
  const setManualSea = (seaM: number | null) => {
    oceanRef.current?.update(seaM);
    // The manual sea replaces the ice-age overlay while it holds the tiller.
    manualSeaActiveRef.current = seaM !== null && seaM !== 0;
  };

  // Rebuild the "on the map" place+time dossier for the CURRENT timeline year.
  // The click handler below builds it once at click time; App calls this as the
  // years scrub so the ruling polity, its flag and the era's nearby events
  // follow history — otherwise the flag "sticks" at whatever year you clicked.
  // Local only (no live Wikidata fetch — that stays on the fresh click). Mirrors
  // the click handler's dossier build; keep the two in step.
  const rebuildDossier = (lat: number, lon: number): PanelContent => {
    const year = Math.round(yearsBPToYear(yearsBPRef.current));
    const hit = bordersRef.current?.hitTest(lon, lat);
    const box = eventsRef.current.filter(
      (e) => !dupEventIdsRef.current.has(e.id) && Math.abs(e.lat - lat) < 7 && Math.abs(e.lon - lon) < 9,
    );
    const candidates = hit
      ? box.filter((e) => bordersRef.current?.hitTest(e.lon, e.lat)?.name === hit.name)
      : box.filter((e) => Math.abs(e.startYear - year) <= 150);
    const nearby = candidates
      .sort((a, b) => {
        const dt = Math.abs(a.startYear - year) - Math.abs(b.startYear - year);
        return dt !== 0 ? dt : (b.notability ?? 0) - (a.notability ?? 0);
      })
      .slice(0, 7);
    const openEvent = (ev: TimelineEvent) => {
      onSelectRef.current(eventToPanel(ev));
      onSeekRef.current(yearToYearsBP(ev.startYear));
      flyTo(ev.lon, ev.lat, 600_000);
    };
    return placeDossierPanel(lat, lon, year, hit?.name, nearby, openEvent);
  };

  useImperativeHandle(ref, () => ({ flyTo, flyToMonument, setSunTime, setSunLighting, getHeading, resetNorth, setManualSea, captureFrame, rebuildDossier }));

  // --- Create the viewer once. -------------------------------------------
  useEffect(() => {
    if (!containerRef.current) return;

    const viewer = new Cesium.Viewer(containerRef.current, {
      baseLayer: Cesium.ImageryLayer.fromProviderAsync(
        Cesium.TileMapServiceImageryProvider.fromUrl(
          Cesium.buildModuleUrl('Assets/Textures/NaturalEarthII'),
        ),
        {},
      ),
      baseLayerPicker: false,
      geocoder: false,
      timeline: false,
      animation: false,
      homeButton: false,
      sceneModePicker: false,
      navigationHelpButton: false,
      fullscreenButton: false,
      selectionIndicator: false,
      infoBox: false,
    });

    viewer.scene.globe.enableLighting = false;
    // Bare globe (imagery not yet streamed) reads as DESERT, not ocean —
    // Cesium's default blue base was hiding the ground under Giza whenever
    // tiles lagged, and blue-under-pyramids reads as "sea", not "loading".
    viewer.scene.globe.baseColor = Cesium.Color.fromCssColorString('#8a7d63');
    if (viewer.scene.skyAtmosphere) viewer.scene.skyAtmosphere.show = true;
    if (viewer.scene.fog) viewer.scene.fog.enabled = true;
    (viewer.cesiumWidget.creditContainer as HTMLElement).style.display = 'none';

    // Natural Earth (bundled, low-res) stays as an offline fallback at the
    // bottom. On top we add sharp Esri satellite imagery so flying down to a
    // battle stays crisp instead of blurry. If Esri can't load (offline), the
    // Natural Earth layer underneath still shows.
    const naturalEarth = viewer.imageryLayers.get(0);
    const satellite = Cesium.ImageryLayer.fromProviderAsync(
      Promise.resolve(
        new Cesium.UrlTemplateImageryProvider({
          url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
          maximumLevel: 18,
          credit: 'Imagery © Esri, Maxar, Earthstar Geographics',
        }),
      ),
      {},
    );
    viewer.imageryLayers.add(satellite);
    modernLayersRef.current = [naturalEarth, satellite];

    // The satellite tiles are Web-Mercator and stop at ±85° — cap both poles
    // with soft-edged ice so the planet doesn't have holes drilled through it.
    // Registered as modern layers so deep time (drifted continents) hides them.
    {
      // SOLID ice, no gradient — a fade rendered inverted on the first try
      // (glowing rim, black pole). Plain and opaque cannot be upside-down.
      const c = document.createElement('canvas');
      c.width = 64;
      c.height = 64;
      const g = c.getContext('2d')!;
      g.fillStyle = '#e7edf1';
      g.fillRect(0, 0, 64, 64);
      const capUrl = c.toDataURL('image/png');
      const addCap = (s: number, n: number) =>
        Cesium.SingleTileImageryProvider.fromUrl(capUrl, {
          rectangle: Cesium.Rectangle.fromDegrees(-180, s, 180, n),
        })
          .then((provider) => {
            if (viewer.isDestroyed()) return;
            const layer = viewer.imageryLayers.addImageryProvider(provider);
            modernLayersRef.current.push(layer);
          })
          .catch(() => {});
      void addCap(82.5, 90);
      void addCap(-90, -82.5);

      // The imagery caps can only paint geometry that EXISTS — the ArcGIS
      // terrain is Web-Mercator, so above ~85 deg there is no globe surface
      // at all. Attempt 2 (a camera-facing billboard) depth-fought the
      // terrain rim. Attempt 3: REAL geometry — a flattened ice dome
      // (synchronous Primitive; async ones crash in this build) sunk into
      // each pole: rim hides under the terrain that exists below 85 deg,
      // cap fills the void correctly from every camera angle.
      const capGeometry = new Cesium.EllipsoidGeometry({
        radii: new Cesium.Cartesian3(680_000, 680_000, 60_000),
        vertexFormat: Cesium.PerInstanceColorAppearance.VERTEX_FORMAT,
      });
      for (const lat of [89.999, -89.999]) {
        const center = Cesium.Cartesian3.fromDegrees(0, lat, -20_000);
        viewer.scene.primitives.add(
          new Cesium.Primitive({
            geometryInstances: new Cesium.GeometryInstance({
              geometry: capGeometry,
              modelMatrix: Cesium.Transforms.eastNorthUpToFixedFrame(center),
              attributes: {
                color: Cesium.ColorGeometryInstanceAttribute.fromColor(
                  Cesium.Color.fromCssColorString('#e7edf1'),
                ),
              },
            }),
            appearance: new Cesium.PerInstanceColorAppearance({ flat: true, closed: true }),
            asynchronous: false, // sync — the async path is unreliable here
          }),
        );
      }
    }

    // Real mountains and valleys: keyless Esri world-elevation terrain. If it
    // can't load (offline), the globe simply stays smooth — everything else
    // keeps working on the ellipsoid.
    Cesium.ArcGISTiledElevationTerrainProvider.fromUrl(
      'https://elevation3d.arcgis.com/arcgis/rest/services/WorldElevation3D/Terrain3D/ImageServer',
    )
      .then((terrain) => {
        if (viewer.isDestroyed()) return;
        terrainRef.current.provider = terrain;
        applyTerrain(yearsBPRef.current / 1_000_000 < PALEO_MA);
      })
      .catch(() => {
        /* offline — keep the smooth ellipsoid globe */
      });

    paleoRef.current = new PaleoController(viewer, import.meta.env.BASE_URL);
    seaRef.current = new SeaLevelController(viewer);
    oceanRef.current = new OceanDrainController(viewer);
    riversRef.current = new RiversController(viewer);
    bordersRef.current = new BordersController(viewer, import.meta.env.BASE_URL);
    fxRef.current = new DisasterFx(viewer, containerRef.current ?? undefined);
    campaignRef.current = new CampaignController(viewer, import.meta.env.BASE_URL);
    campaignRef.current.onActiveLabel = (label) => onCampaignLabelRef.current(label);
    faunaRef.current = new FaunaController(viewer, import.meta.env.BASE_URL);
    if (import.meta.env.DEV) {
      const w = window as unknown as {
        __viewer?: Cesium.Viewer;
        __Cesium?: typeof Cesium;
        __borders?: BordersController | null;
        __fx?: DisasterFx | null;
      };
      w.__viewer = viewer;
      w.__Cesium = Cesium;
      w.__borders = bordersRef.current;
      w.__fx = fxRef.current;
    }

    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(10, 25, 24_000_000),
      duration: 0,
    });

    // Descending reveals more history: watch the camera height and bucket it
    // into tiers that widen the event caps. Polled — Cesium's camera.changed
    // event does not fire reliably in this build.
    // Tiny always-on probe so live deployments stay diagnosable (the full dev
    // handles are stripped from production builds).
    (window as unknown as { __chronosCam?: () => { height: number; lon: number; lat: number } }).__chronosCam =
      () => {
        const c = viewer.camera.positionCartographic;
        return {
          height: Math.round(c.height),
          lon: +Cesium.Math.toDegrees(c.longitude).toFixed(3),
          lat: +Cesium.Math.toDegrees(c.latitude).toFixed(3),
        };
      };

    const tierTimer = window.setInterval(() => {
      if (viewer.isDestroyed()) return;
      const carto = viewer.camera.positionCartographic;
      setZoomTier(zoomTierFor(carto.height));

      // World-scale paintings (shifting rivers, ice-age seas) retire when
      // you fly close — their coarse strokes would smear over the ground.
      const worldScale = carto.height > 700_000;
      riversRef.current?.setZoomVisible(worldScale);
      seaRef.current?.setZoomVisible(worldScale);
      oceanRef.current?.setZoomVisible(carto.height > 300_000);
      setCloseUp(carto.height < 400_000);

      // Live-fetched markers pack up once the camera leaves their region
      // (drifted far away, or pulled back to orbit).
      const anchor = liveAnchorRef.current;
      if (anchor && liveEntitiesRef.current.size > 0) {
        const camLat = Cesium.Math.toDegrees(carto.latitude);
        const camLon = Cesium.Math.toDegrees(carto.longitude);
        const drift = Math.hypot(
          (camLon - anchor.lon) * Math.max(0.2, Math.cos(carto.latitude)),
          camLat - anchor.lat,
        );
        if (drift > 9 || carto.height > 9_000_000) {
          for (const ent of liveEntitiesRef.current.values()) viewer.entities.remove(ent);
          liveEntitiesRef.current.clear();
          liveAnchorRef.current = null;
        }
      }

      // The dive: sink below the threshold right over a 3D-capable marker and
      // its scene opens. One shot — climbing back up re-arms it.
      if (carto.height > DIVE_REARM_HEIGHT) {
        divedRef.current = false;
      } else if (!divedRef.current && carto.height < DIVE_HEIGHT) {
        const camLon = Cesium.Math.toDegrees(carto.longitude);
        const camLat = Cesium.Math.toDegrees(carto.latitude);
        const coslat = Math.max(0.2, Math.cos(carto.latitude));
        type DiveKind = 'battle' | 'site' | 'event';
        let best: { kind: DiveKind; id: string; d: number } | null = null;
        const consider = (kind: DiveKind, id: string, lon: number, lat: number, shown: boolean) => {
          if (!shown) return;
          const d = Math.hypot((lon - camLon) * coslat, lat - camLat);
          if (d <= DIVE_RADIUS_DEG && (!best || d < best.d)) best = { kind, id, d };
        };
        for (const [id, ent] of entitiesRef.current) {
          const site = (ent as Cesium.Entity & { chronosSite?: AncientSite }).chronosSite;
          if (site) consider('site', id, site.lon, site.lat, ent.show);
        }
        for (const [id, ent] of battleEntitiesRef.current) {
          const battle = (ent as Cesium.Entity & { chronosBattle?: Battle }).chronosBattle;
          if (battle) consider('battle', id, battle.lon, battle.lat, ent.show);
        }
        // Imported monuments are diveable too — every monument is zoomable.
        // Only pool slots currently assigned to a shown monument qualify.
        for (const ent of eventPoolRef.current) {
          const ev = (ent as Cesium.Entity & { chronosEvent?: TimelineEvent }).chronosEvent;
          if (ev && ev.category === 'monument') consider('event', ev.id, ev.lon, ev.lat, ent.show);
        }
        if (best) {
          divedRef.current = true;
          onDiveRef.current({ kind: (best as { kind: DiveKind }).kind, id: (best as { id: string }).id });
        }
      }
      // Track the visible patch of Earth (rounded, so tiny drifts don't churn).
      const rect = viewer.camera.computeViewRectangle();
      if (rect) {
        const deg = (r: number) => Math.round(Cesium.Math.toDegrees(r) * 2) / 2;
        const next = { w: deg(rect.west), s: deg(rect.south), e: deg(rect.east), n: deg(rect.north) };
        const key = `${next.w}|${next.s}|${next.e}|${next.n}`;
        if (key !== viewRectKeyRef.current) {
          viewRectKeyRef.current = key;
          setViewRect(next);
        }
      } else if (viewRectKeyRef.current !== 'space') {
        viewRectKeyRef.current = 'space';
        setViewRect(null); // whole globe (or space) in view
      }
    }, 500);

    // Keep Cesium's render buffer in sync with the container (avoids a 0x0 canvas).
    const resizeObserver = new ResizeObserver(() => {
      if (!viewer.isDestroyed()) viewer.resize();
    });
    resizeObserver.observe(containerRef.current);
    requestAnimationFrame(() => {
      if (!viewer.isDestroyed()) viewer.resize();
    });
    const resizeTimer = window.setTimeout(() => {
      if (!viewer.isDestroyed()) viewer.resize();
    }, 300);

    // Click handler: prefer a marker (ancient site / battle); otherwise, if the
    // borders layer is active, identify the polity under the cursor.
    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    handler.setInputAction((movement: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
      const picked = viewer.scene.pick(movement.position);
      const site: AncientSite | undefined = picked?.id?.chronosSite;
      if (site) {
        onSelectRef.current(siteToPanel(site));
        onSeekRef.current(yearToYearsBP(site.builtYear));
        flyTo(site.lon, site.lat, site.category === 'precursor-hypothesis' ? 3_000_000 : 1_200_000);
        return;
      }
      const battle: Battle | undefined = picked?.id?.chronosBattle;
      if (battle) {
        onSelectRef.current(battleToPanel(battle));
        onSeekRef.current(yearToYearsBP(battle.year));
        flyTo(battle.lon, battle.lat, BATTLE_FLY_ALTITUDE);
        return;
      }
      const fauna: FaunaEntry | undefined = picked?.id?.chronosFauna;
      if (fauna && faunaRef.current) {
        const panel = faunaRef.current.panelFor(fauna);
        onSelectRef.current(panel);
        if (panel.fly) flyTo(panel.fly.lon, panel.fly.lat, panel.fly.altitude);
        return;
      }
      const event: TimelineEvent | undefined = picked?.id?.chronosEvent;
      if (event) {
        onSelectRef.current(eventToPanel(event));
        onSeekRef.current(yearToYearsBP(event.startYear));
        flyTo(event.lon, event.lat, 600_000);
        // Clicking a disaster replays it where it happened.
        if (event.category === 'disaster') {
          fxRef.current?.play(disasterKindFor(event.name), event.lon, event.lat, 120);
        }
        return;
      }

      // Try to resolve a country/empire by where the click hit the globe.
      // pickEllipsoid is more robust than globe.pick (no dependence on rendered
      // terrain depth) for getting a lon/lat from a screen click.
      const cartesian = viewer.camera.pickEllipsoid(
        movement.position,
        viewer.scene.globe.ellipsoid,
      );
      if (cartesian) {
        const carto = Cesium.Cartographic.fromCartesian(cartesian);
        const lon = Cesium.Math.toDegrees(carto.longitude);
        const lat = Cesium.Math.toDegrees(carto.latitude);
        const year = Math.round(yearsBPToYear(yearsBPRef.current));
        const hit = bordersRef.current?.hitTest(lon, lat);
        // On-the-fly dossier: events within range, then kept to the same country
        // you clicked (so France doesn't list London's Big Ben), ranked by
        // notability AND closeness in time so the era's own events rise.
        const box = eventsRef.current.filter(
          (e) =>
            !dupEventIdsRef.current.has(e.id) &&
            Math.abs(e.lat - lat) < 7 &&
            Math.abs(e.lon - lon) < 9,
        );
        // Strictly the clicked country's OWN events — but drift in TIME (not
        // geography): show the ones nearest the set year, so a sparse country
        // reveals its real history from another decade, never a neighbour's.
        const candidates = hit
          ? box.filter((e) => bordersRef.current?.hitTest(e.lon, e.lat)?.name === hit.name)
          : box.filter((e) => Math.abs(e.startYear - year) <= 150);
        const nearby = candidates
          .sort((a, b) => {
            const dt = Math.abs(a.startYear - year) - Math.abs(b.startYear - year);
            return dt !== 0 ? dt : (b.notability ?? 0) - (a.notability ?? 0);
          })
          .slice(0, 7);
        if (hit || nearby.length > 0) {
          const openEvent = (ev: TimelineEvent) => {
            onSelectRef.current(eventToPanel(ev));
            onSeekRef.current(yearToYearsBP(ev.startYear));
            flyTo(ev.lon, ev.lat, 600_000);
          };
          onSelectRef.current(placeDossierPanel(lat, lon, year, hit?.name, nearby, openEvent));

          // Thin local dossier? Ask Wikidata live, right now — extra rows
          // appear a moment later, marked "fetched live". A newer click
          // invalidates the update; offline just means no extras.
          if (nearby.length < 6) {
            const seq = ++dossierSeqRef.current;
            void fetchNearbyHistory(lat, lon).then((live) => {
              if (dossierSeqRef.current !== seq || live.length === 0) return;
              const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '');
              const have = new Set(nearby.map((e) => norm(e.name)));
              const fresh = live.filter((e) => !have.has(norm(e.name)));
              if (fresh.length === 0) return;
              const merged = [...nearby, ...fresh]
                .sort((a, b) => Math.abs(a.startYear - year) - Math.abs(b.startYear - year))
                .slice(0, 9);
              onSelectRef.current(placeDossierPanel(lat, lon, year, hit?.name, merged, openEvent));

              // The new finds land on the map too — same dress code as
              // everyone else: category badge, fame-sized, cascading pop-in.
              spawnLiveMarkers(live, { lat, lon });
            });
          }
        }
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    // Hover bubble: know what a marker is before you click it. Picks are
    // throttled — a pick per mousemove would chug on busy eras.
    const tooltip = document.createElement('div');
    tooltip.className = 'globe-tooltip';
    containerRef.current?.appendChild(tooltip);
    let lastHoverPick = 0;
    handler.setInputAction((movement: Cesium.ScreenSpaceEventHandler.MotionEvent) => {
      const now = performance.now();
      if (now - lastHoverPick < 70) return;
      lastHoverPick = now;
      let label: string | null = null;
      try {
        const picked = viewer.scene.pick(movement.endPosition);
        const id = picked?.id as
          | (Cesium.Entity & {
              chronosSite?: AncientSite;
              chronosBattle?: Battle;
              chronosEvent?: TimelineEvent;
            })
          | undefined;
        if (id?.chronosSite) label = id.chronosSite.name;
        else if (id?.chronosBattle) label = `⚔ ${id.chronosBattle.name} · ${id.chronosBattle.dateLabel}`;
        else if (id?.chronosEvent) label = id.chronosEvent.name;
      } catch {
        /* picking mid-render can throw — never break the hover */
      }
      if (label) {
        tooltip.textContent = label;
        tooltip.style.left = `${movement.endPosition.x + 14}px`;
        tooltip.style.top = `${movement.endPosition.y - 12}px`;
        tooltip.style.opacity = '1';
      } else {
        tooltip.style.opacity = '0';
      }
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

    viewerRef.current = viewer;

    // STAGE E — the monuments stand on the Earth itself: the exported .glb
    // fleet, clamped to the ground at true scale and calibrated bearing,
    // revealed as you fly close. Fire-and-forget: no fleet manifest, no
    // models — the globe simply keeps its markers.
    void loadGlobeModels(viewer);

    return () => {
      tooltip.remove();
      window.clearTimeout(resizeTimer);
      resizeObserver.disconnect();
      window.clearInterval(tierTimer);
      if (popTimerRef.current !== null) {
        window.clearInterval(popTimerRef.current);
        popTimerRef.current = null;
      }
      popAnimsRef.current.clear();
      handler.destroy();
      faunaRef.current?.dispose();
      faunaRef.current = null;
      paleoRef.current?.dispose();
      seaRef.current?.dispose();
      oceanRef.current?.dispose();
      riversRef.current?.dispose();
      bordersRef.current?.dispose();
      campaignRef.current?.dispose();
      fxRef.current?.dispose();
      fxRef.current = null;
      paleoRef.current = null;
      bordersRef.current = null;
      campaignRef.current = null;
      if (!viewer.isDestroyed()) viewer.destroy();
      viewerRef.current = null;
      entitiesRef.current.clear();
      battleEntitiesRef.current.clear();
      eventPoolRef.current = [];
      eventAssignRef.current.clear();
      liveEntitiesRef.current.clear();
    };
  }, []);

  // Drive continental drift + historical borders from the timeline.
  useEffect(() => {
    const ma = currentYearsBP / 1_000_000;
    const year = yearsBPToYear(currentYearsBP);
    applyTerrain(ma < PALEO_MA);
    paleoRef.current?.update(ma, modernLayersRef.current);
    seaRef.current?.update(currentYearsBP, showSeaLevel && ma < PALEO_MA && !closeUp && !manualSeaActiveRef.current);
    riversRef.current?.update(year, showRivers && ma < PALEO_MA && !closeUp);
    bordersRef.current?.update(year, showBorders && !closeUp, ma >= PALEO_MA);
    campaignRef.current?.update(year, showCampaigns && ma < PALEO_MA && !closeUp);
    faunaRef.current?.update(ma, showFauna);
  }, [currentYearsBP, showBorders, showCampaigns, showFauna, showSeaLevel, showRivers, closeUp]);

  // Flag artwork inside borders on/off — and auto-hidden once you zoom in past a
  // whole-continent view. Flags label the broad picture; from tier 2 (below
  // ~3,500 km up) you're down to a region and the colour wash just clutters the
  // map, so it switches off. A plain zoom cutoff — no per-country geometry test —
  // is predictable and cheap. Only re-rasterise when the visibility flips.
  const flagsAppliedRef = useRef<boolean | null>(null);
  useEffect(() => {
    const borders = bordersRef.current;
    if (!borders) return;
    const want = showFlags && zoomTier < 2;
    if (flagsAppliedRef.current !== want) {
      flagsAppliedRef.current = want;
      borders.setFlags(want);
    }
  }, [showFlags, zoomTier]);

  // Feed the border engine every battle we know of (curated + imported), so
  // the line map can burn its borders red where fighting is current.
  useEffect(() => {
    bordersRef.current?.setWarPoints([
      ...battles.map((b) => ({ lon: b.lon, lat: b.lat, year: b.year })),
      ...events
        .filter((e) => e.category === 'battle')
        .map((e) => ({ lon: e.lon, lat: e.lat, year: e.startYear })),
    ]);
  }, [battles, events]);

  // --- Build marker entities whenever the site list changes. -------------
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    for (const entity of entitiesRef.current.values()) viewer.entities.remove(entity);
    entitiesRef.current.clear();

    for (const site of sites) {
      const entity = viewer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(site.lon, site.lat),
        billboard: {
          image: siteIcon(site.category),
          scale: 0.46,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          disableDepthTestDistance: MARKER_DEPTH_TEST_DISTANCE,
        },
        label: {
          text: site.name,
          font: '13px "Segoe UI", sans-serif',
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          disableDepthTestDistance: MARKER_DEPTH_TEST_DISTANCE,
          fillColor: Cesium.Color.WHITE,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 3,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          pixelOffset: new Cesium.Cartesian2(0, -32),
          distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 8_000_000),
        },
      });
      const tagged = entity as Cesium.Entity & { chronosSite?: AncientSite; chronosScale?: number };
      tagged.chronosSite = site;
      tagged.chronosScale = 0.46;
      entitiesRef.current.set(site.id, entity);
    }
  }, [sites]);

  // --- Show/hide markers based on the timeline + layer toggle. -----------
  useEffect(() => {
    for (const site of sites) {
      const entity = entitiesRef.current.get(site.id);
      if (!entity) continue;
      // One-off events (impacts, deluges) fade once their fall-out stops being
      // noticeable; monuments stand forever. yearsBP shrinks toward the present,
      // so "after fadeYear" means currentYearsBP < its BP value.
      const born = currentYearsBP <= yearToYearsBP(site.builtYear);
      const faded = site.fadeYear != null && currentYearsBP < yearToYearsBP(site.fadeYear);
      setShownPop(entity, showSites && born && !faded);
    }
    // The 3D fleet obeys the same clock and the same layer switch.
    updateGlobeModelVisibility(currentYearsBP, showSites);
  }, [currentYearsBP, showSites, sites]);

  // --- Build battle markers whenever the battle list changes. ------------
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    for (const entity of battleEntitiesRef.current.values()) viewer.entities.remove(entity);
    battleEntitiesRef.current.clear();

    for (const battle of battles) {
      const entity = viewer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(battle.lon, battle.lat),
        billboard: {
          image: ICONS.battle(),
          scale: 0.44,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          disableDepthTestDistance: MARKER_DEPTH_TEST_DISTANCE,
        },
        label: {
          text: battle.name,
          font: '12px "Segoe UI", sans-serif',
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          disableDepthTestDistance: MARKER_DEPTH_TEST_DISTANCE,
          fillColor: Cesium.Color.fromCssColorString('#ffd7d7'),
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 3,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          pixelOffset: new Cesium.Cartesian2(0, -32),
          distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 6_000_000),
        },
      });
      const tagged = entity as Cesium.Entity & { chronosBattle?: Battle; chronosScale?: number };
      tagged.chronosBattle = battle;
      tagged.chronosScale = 0.44;
      battleEntitiesRef.current.set(battle.id, entity);
    }
  }, [battles]);

  // A battle is "current" from its year until 10 years later.
  useEffect(() => {
    const year = yearsBPToYear(currentYearsBP);
    for (const battle of battles) {
      const entity = battleEntitiesRef.current.get(battle.id);
      if (!entity) continue;
      setShownPop(
        entity,
        showBattles && year >= battle.year && year <= battle.year + BATTLE_VISIBLE_YEARS,
      );
    }
  }, [currentYearsBP, showBattles, battles]);

  // --- Build imported-event markers (category icon badges) when data loads. ---
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    // Create the reusable marker pool ONCE. It is never rebuilt when more
    // events are imported — the visibility effect below just reassigns these
    // slots to whichever events are on screen, so cost stays flat.
    if (eventPoolRef.current.length === 0) {
      for (let i = 0; i < EVENT_POOL_SIZE; i++) {
        const ent = viewer.entities.add({
          position: Cesium.Cartesian3.fromDegrees(0, 0),
          show: false,
          billboard: {
            image: eventIcon('city'),
            scale: 0.4,
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
            disableDepthTestDistance: MARKER_DEPTH_TEST_DISTANCE,
          },
          label: {
            text: '',
            font: '12px "Segoe UI", sans-serif',
            fillColor: Cesium.Color.WHITE,
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 3,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            pixelOffset: new Cesium.Cartesian2(0, -28),
            distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 1_500_000),
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
            disableDepthTestDistance: MARKER_DEPTH_TEST_DISTANCE,
          },
        });
        eventPoolRef.current.push(ent);
      }
    }

    // Flag imported events that duplicate a curated battle or site (data only):
    // the curated marker wins in the overview, but a duplicate is still shown
    // when the zoomed-in mural asks for it.
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '');
    const findTwin = (ev: TimelineEvent): { kind: 'battle' | 'site'; id: string } | undefined => {
      if (ev.category === 'battle') {
        const evn = norm(ev.name);
        // Same name = same battle (coords from the two sources often differ by
        // tens of km), or a near-identical spot+year as a fallback.
        const twin = battles.find(
          (b) =>
            (norm(b.name) === evn && Math.abs(b.year - ev.startYear) <= 10) ||
            (Math.abs(b.lat - ev.lat) < 0.6 &&
              Math.abs(b.lon - ev.lon) < 0.6 &&
              Math.abs(b.year - ev.startYear) <= 3),
        );
        return twin ? { kind: 'battle', id: twin.id } : undefined;
      }
      if (ev.category === 'monument') {
        const twin = sites.find(
          (s) => Math.abs(s.lat - ev.lat) < 0.3 && Math.abs(s.lon - ev.lon) < 0.3,
        );
        return twin ? { kind: 'site', id: twin.id } : undefined;
      }
      return undefined;
    };

    const dups = new Set<string>();
    const twins = new Map<string, { kind: 'battle' | 'site'; id: string }>();
    for (const ev of events) {
      const twin = findTwin(ev);
      if (twin) {
        dups.add(ev.id);
        twins.set(ev.id, twin);
      }
    }
    dupEventIdsRef.current = dups;
    dupTwinRef.current = twins;
  }, [events, sites, battles]);

  const eventById = useMemo(() => {
    const m = new Map<string, TimelineEvent>();
    for (const e of events) m.set(e.id, e);
    return m;
  }, [events]);
  const eventIndex = useMemo(() => buildEventIndex(events), [events]);

  // Work out which events are on screen (capped to the most notable) and hand
  // the marker pool to them. Everything else stays as plain data — no entity,
  // no per-frame cost — so importing 10× more events costs the globe nothing.
  useEffect(() => {
    const pool = eventPoolRef.current;
    if (!pool.length) return;
    const year = yearsBPToYear(currentYearsBP);
    let visList: TimelineEvent[] = [];
    if (muralEventIds !== null) {
      // Zoomed into the mural — every circle the timeline shows gets a marker.
      // A duplicate of a curated battle/site steps aside ONLY while its curated
      // twin is actually on screen (curated battle markers are brief).
      for (const id of muralEventIds) {
        const twin = dupTwinRef.current.get(id);
        if (twin) {
          const twinEntity =
            twin.kind === 'battle'
              ? battleEntitiesRef.current.get(twin.id)
              : entitiesRef.current.get(twin.id);
          if (twinEntity?.show) continue;
        }
        const ev = eventById.get(id);
        if (ev) visList.push(ev);
      }
    } else {
      // When zoomed toward a region, the quota is spent on what's IN VIEW —
      // zooming into Kent fills Kent, not the whole planet. (Tier 0 = orbit,
      // where the whole world competes as before.)
      const scopeToView = zoomTier >= 1 && viewRect !== null;
      const inView = (ev: TimelineEvent): boolean => {
        if (!scopeToView) return true;
        const { w, s, e, n } = viewRect;
        const mLat = Math.max(1, (n - s) * 0.1); // a little margin past the edges
        if (ev.lat < s - mLat || ev.lat > n + mLat) return false;
        const mLon = Math.max(1, (e >= w ? e - w : 360 - (w - e)) * 0.1);
        return e >= w
          ? ev.lon >= w - mLon && ev.lon <= e + mLon
          : ev.lon >= w - mLon || ev.lon <= e + mLon; // view crosses the dateline
      };
      // Narrow with the index before the exact per-event test: a year slice
      // (wide enough to never drop a visible event) and, when scoped to a
      // region, the grid cells in view. Identical result to scanning all events.
      let candidates = eventIndex.window(year - EVENT_QUERY_SPAN, year + EVENT_QUERY_SPAN);
      if (scopeToView) {
        const { w, s, e, n } = viewRect;
        const mLat = Math.max(1, (n - s) * 0.1);
        const mLon = Math.max(1, (e >= w ? e - w : 360 - (w - e)) * 0.1);
        const viewSet = eventIndex.inView(viewRect, mLat, mLon);
        if (viewSet) candidates = candidates.filter((ev) => viewSet.has(ev));
      }
      const inWindow = candidates.filter((ev) => {
        if (dupEventIdsRef.current.has(ev.id)) return false; // curated twin wins in overview
        if (!enabledEventCats.has(ev.category)) return false; // category toggled off
        return inView(ev) && eventVisibleAt(ev, year);
      });
      const byCat = new Map<string, TimelineEvent[]>();
      for (const ev of inWindow) {
        const list = byCat.get(ev.category) ?? [];
        list.push(ev);
        byCat.set(ev.category, list);
      }
      const picked: TimelineEvent[] = [];
      for (const list of byCat.values()) {
        list.sort((a, b) => (b.notability ?? 0) - (a.notability ?? 0));
        picked.push(...list.slice(0, EVENT_PER_CATEGORY_BY_TIER[zoomTier]));
      }
      picked.sort((a, b) => (b.notability ?? 0) - (a.notability ?? 0));
      visList = picked.slice(0, EVENT_MAX_VISIBLE_BY_TIER[zoomTier]);
    }
    // Whatever the user just searched for / clicked always keeps its marker.
    if (focusEventId && !visList.some((e) => e.id === focusEventId)) {
      const fev = eventById.get(focusEventId);
      if (fev) visList.push(fev);
    }

    // Assign the pool with STABLE slots: an event keeps its marker while it
    // stays visible (so markers pop in/out in place, never teleport).
    const assign = eventAssignRef.current;
    const want = new Map(visList.slice(0, pool.length).map((ev) => [ev.id, ev] as const));
    // Release slots whose event has left the screen.
    for (const [id, ent] of [...assign]) {
      if (!want.has(id)) {
        ent.show = false;
        (ent as Cesium.Entity & { chronosEvent?: TimelineEvent }).chronosEvent = undefined;
        assign.delete(id);
      }
    }
    const assigned = new Set(assign.values());
    const free = pool.filter((e) => !assigned.has(e));
    let appeared = 0;
    for (const [id, ev] of want) {
      if (assign.has(id)) continue; // already on screen in a stable slot
      const ent = free.pop();
      if (!ent) break; // pool exhausted (shouldn't happen within the caps)
      assign.set(id, ent);
      const isBattle = ev.category === 'battle';
      const scale = fameScale(ev.notability, isBattle ? 0.44 : 0.4);
      (ent.position as Cesium.ConstantPositionProperty).setValue(Cesium.Cartesian3.fromDegrees(ev.lon, ev.lat));
      const bb = ent.billboard!;
      (bb.image as Cesium.ConstantProperty).setValue(eventIcon(ev.category));
      const lbl = ent.label!;
      (lbl.text as Cesium.ConstantProperty).setValue(ev.name);
      (lbl.pixelOffset as Cesium.ConstantProperty).setValue(new Cesium.Cartesian2(0, isBattle ? -32 : -28));
      (lbl.distanceDisplayCondition as Cesium.ConstantProperty).setValue(new Cesium.DistanceDisplayCondition(0, isBattle ? 6_000_000 : 1_500_000));
      const tagged = ent as Cesium.Entity & { chronosEvent?: TimelineEvent; chronosScale?: number };
      tagged.chronosEvent = ev;
      tagged.chronosScale = scale;
      if (setShownPop(ent, true, Math.min(appeared * 60, 900))) appeared++;
    }
  }, [currentYearsBP, enabledEventCats, events, muralEventIds, focusEventId, zoomTier, viewRect, eventById, eventIndex]);

  // Catastrophes play themselves where they happened as the timeline sweeps
  // across their moment — the comet finds Chicxulub, Krakatoa goes up.
  const prevBPRef = useRef(currentYearsBP);
  useEffect(() => {
    const prev = prevBPRef.current;
    prevBPRef.current = currentYearsBP;
    const fx = fxRef.current;
    if (!fx || prev === currentYearsBP) return;
    const lo = Math.min(prev, currentYearsBP);
    const hi = Math.max(prev, currentYearsBP);
    const span = hi - lo;
    let budget = 3; // a giant timeline jump must not become a fireworks show
    const crossed = (bp: number) =>
      bp > lo && bp <= hi && span < Math.max(400, bp * 0.5);
    for (const d of CURATED_DISASTERS) {
      const bp =
        CURATED_YEARS[d.name] !== undefined ? yearToYearsBP(CURATED_YEARS[d.name]) : d.bp;
      if (budget > 0 && crossed(bp) && !playedFxRef.current.has(d.name)) {
        playedFxRef.current.add(d.name);
        fx.play(d.kind, d.lon, d.lat, d.radiusKm, d.flash);
        budget--;
      }
    }
    for (const ev of events) {
      if (ev.category !== 'disaster' || budget <= 0) continue;
      const bp = yearToYearsBP(ev.startYear);
      if (!crossed(bp) || playedFxRef.current.has(ev.id)) continue;
      playedFxRef.current.add(ev.id);
      const radius = 60 + Math.min(1, (ev.notability ?? 0) / 350) * 140;
      fx.play(disasterKindFor(ev.name), ev.lon, ev.lat, radius);
      budget--;
    }
  }, [currentYearsBP, events]);

  return <div className="globe" ref={containerRef} role="main" aria-label="Interactive history globe" />;
});

export default Globe;
