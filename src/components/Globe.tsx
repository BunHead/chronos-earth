import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import * as Cesium from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import type { AncientSite, Battle, PanelContent, TimelineEvent } from '../lib/types';
import { yearToYearsBP, yearsBPToYear } from '../lib/timeScale';
import { siteToPanel, placeDossierPanel, battleToPanel, eventToPanel, BATTLE_FLY_ALTITUDE } from '../lib/panel';
import { siteIcon, eventIcon, ICONS } from '../lib/markerIcons';
import { PaleoController } from './paleo';
import { BordersController } from './borders';
import { CampaignController } from './campaign';
import { FaunaController, type FaunaEntry } from './fauna';

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
  if (ev.category === 'battle') return year >= from && year <= from + 3 * age;
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
}

interface GlobeProps {
  /** Current position in time, in years before present. */
  currentYearsBP: number;
  sites: AncientSite[];
  battles: Battle[];
  showSites: boolean;
  showBorders: boolean;
  showBattles: boolean;
  showCampaigns: boolean;
  showFauna: boolean;
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
  onDive: (target: { kind: 'battle' | 'site'; id: string }) => void;
}

/** Diving below this camera height (m) over a marker opens its 3D scene. */
const DIVE_HEIGHT = 26_000;
/** …and this is how far away (m) is re-armed. */
const DIVE_REARM_HEIGHT = 90_000;
/** How close (degrees, ~50 km) the camera must be over the marker. */
const DIVE_RADIUS_DEG = 0.45;

/** Deep time (continents drifting) begins at 4 million years before present. */
const PALEO_MA = 4;

const Globe = forwardRef<GlobeHandle, GlobeProps>(function Globe(
  { currentYearsBP, sites, battles, showSites, showBorders, showBattles, showCampaigns, showFauna, events, enabledEventCats, muralEventIds, focusEventId, onSelect, onCampaignLabel, onSeek, onDive },
  ref,
) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<Cesium.Viewer | null>(null);
  const paleoRef = useRef<PaleoController | null>(null);
  const bordersRef = useRef<BordersController | null>(null);
  const campaignRef = useRef<CampaignController | null>(null);
  const faunaRef = useRef<FaunaController | null>(null);
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
  const eventEntitiesRef = useRef<Map<string, Cesium.Entity>>(new Map());
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
  /** True after a dive fired; re-arms once the camera climbs back up. */
  const divedRef = useRef(false);
  const eventsRef = useRef(events);
  eventsRef.current = events;
  /** More markers reveal themselves as the camera descends. */
  const [zoomTier, setZoomTier] = useState(0);
  /** What the camera can see (degrees), so zooming into a region fills THAT
   * region with markers instead of spending the quota worldwide. */
  const [viewRect, setViewRect] = useState<{ w: number; s: number; e: number; n: number } | null>(
    null,
  );
  const viewRectKeyRef = useRef('');
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
    viewerRef.current?.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(lon, lat, height),
      duration: 2,
    });
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
  };

  useImperativeHandle(ref, () => ({ flyTo }));

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
    bordersRef.current = new BordersController(viewer, import.meta.env.BASE_URL);
    campaignRef.current = new CampaignController(viewer, import.meta.env.BASE_URL);
    campaignRef.current.onActiveLabel = (label) => onCampaignLabelRef.current(label);
    faunaRef.current = new FaunaController(viewer, import.meta.env.BASE_URL);
    if (import.meta.env.DEV) {
      const w = window as unknown as {
        __viewer?: Cesium.Viewer;
        __Cesium?: typeof Cesium;
        __borders?: BordersController | null;
      };
      w.__viewer = viewer;
      w.__Cesium = Cesium;
      w.__borders = bordersRef.current;
    }

    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(10, 25, 24_000_000),
      duration: 0,
    });

    // Descending reveals more history: watch the camera height and bucket it
    // into tiers that widen the event caps. Polled — Cesium's camera.changed
    // event does not fire reliably in this build.
    const tierTimer = window.setInterval(() => {
      if (viewer.isDestroyed()) return;
      const carto = viewer.camera.positionCartographic;
      setZoomTier(zoomTierFor(carto.height));

      // The dive: sink below the threshold right over a 3D-capable marker and
      // its scene opens. One shot — climbing back up re-arms it.
      if (carto.height > DIVE_REARM_HEIGHT) {
        divedRef.current = false;
      } else if (!divedRef.current && carto.height < DIVE_HEIGHT) {
        const camLon = Cesium.Math.toDegrees(carto.longitude);
        const camLat = Cesium.Math.toDegrees(carto.latitude);
        const coslat = Math.max(0.2, Math.cos(carto.latitude));
        let best: { kind: 'battle' | 'site'; id: string; d: number } | null = null;
        const consider = (kind: 'battle' | 'site', id: string, lon: number, lat: number, shown: boolean) => {
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
        if (best) {
          divedRef.current = true;
          onDiveRef.current({ kind: (best as { kind: 'battle' | 'site' }).kind, id: (best as { id: string }).id });
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
          onSelectRef.current(
            placeDossierPanel(lat, lon, year, hit?.name, nearby, (ev) => {
              onSelectRef.current(eventToPanel(ev));
              onSeekRef.current(yearToYearsBP(ev.startYear));
              flyTo(ev.lon, ev.lat, 600_000);
            }),
          );
        }
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    viewerRef.current = viewer;

    return () => {
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
      bordersRef.current?.dispose();
      campaignRef.current?.dispose();
      paleoRef.current = null;
      bordersRef.current = null;
      campaignRef.current = null;
      if (!viewer.isDestroyed()) viewer.destroy();
      viewerRef.current = null;
      entitiesRef.current.clear();
      battleEntitiesRef.current.clear();
      eventEntitiesRef.current.clear();
    };
  }, []);

  // Drive continental drift + historical borders from the timeline.
  useEffect(() => {
    const ma = currentYearsBP / 1_000_000;
    const year = yearsBPToYear(currentYearsBP);
    applyTerrain(ma < PALEO_MA);
    paleoRef.current?.update(ma, modernLayersRef.current);
    bordersRef.current?.update(year, showBorders, ma >= PALEO_MA);
    campaignRef.current?.update(year, showCampaigns && ma < PALEO_MA);
    faunaRef.current?.update(ma, showFauna);
  }, [currentYearsBP, showBorders, showCampaigns, showFauna]);

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
      setShownPop(entity, showSites && currentYearsBP <= yearToYearsBP(site.builtYear));
    }
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

    for (const entity of eventEntitiesRef.current.values()) viewer.entities.remove(entity);
    eventEntitiesRef.current.clear();

    // Flag imported events that duplicate a curated battle or site. We still
    // build a marker (so the zoomed-in mural can match every circle), but hide
    // them in the overview, where the richer curated marker wins.
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
      const isBattle = ev.category === 'battle';
      const scale = fameScale(ev.notability, isBattle ? 0.44 : 0.4);
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
          pixelOffset: new Cesium.Cartesian2(0, isBattle ? -32 : -28),
          distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, isBattle ? 6_000_000 : 1_500_000),
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          disableDepthTestDistance: MARKER_DEPTH_TEST_DISTANCE,
        },
      });
      const tagged = entity as Cesium.Entity & { chronosEvent?: TimelineEvent; chronosScale?: number };
      tagged.chronosEvent = ev;
      tagged.chronosScale = scale;
      eventEntitiesRef.current.set(ev.id, entity);
    }
    dupEventIdsRef.current = dups;
    dupTwinRef.current = twins;
  }, [events, sites, battles]);

  // Show events within a window of the current year, capped to the most notable —
  // so scrubbing the timeline lights up the era you're viewing.
  useEffect(() => {
    const year = yearsBPToYear(currentYearsBP);
    let visibleIds = new Set<string>();
    if (muralEventIds !== null) {
      // Zoomed into the mural — every circle the timeline shows gets a marker.
      // An import that duplicates a curated battle/site steps aside ONLY while
      // its curated twin is actually on screen (curated battle markers are
      // brief, so otherwise a mural circle would have no marker at all).
      visibleIds = new Set(
        muralEventIds.filter((id) => {
          const twin = dupTwinRef.current.get(id);
          if (!twin) return true;
          const twinEntity =
            twin.kind === 'battle'
              ? battleEntitiesRef.current.get(twin.id)
              : entitiesRef.current.get(twin.id);
          return !twinEntity?.show;
        }),
      );
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
      const inWindow = events.filter((ev) => {
        if (!eventEntitiesRef.current.has(ev.id)) return false;
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
      visibleIds = new Set(picked.slice(0, EVENT_MAX_VISIBLE_BY_TIER[zoomTier]).map((e) => e.id));
    }
    // Whatever the user just searched for / clicked always keeps its marker.
    if (focusEventId && eventEntitiesRef.current.has(focusEventId)) visibleIds.add(focusEventId);
    let appeared = 0;
    for (const [id, entity] of eventEntitiesRef.current) {
      if (setShownPop(entity, visibleIds.has(id), Math.min(appeared * 60, 900))) appeared++;
    }
  }, [currentYearsBP, enabledEventCats, events, muralEventIds, focusEventId, zoomTier, viewRect]);

  return <div className="globe" ref={containerRef} />;
});

export default Globe;
