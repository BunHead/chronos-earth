/**
 * SiteBuilder — compose an accurate site directly on the satellite globe.
 *
 * Opened from a monument's maker row (🏗). The Captain picks a primitive and
 * clicks the real satellite ground: squares and round towers drop where he
 * clicks; walls, platforms and water are TRACED vertex by vertex over the
 * imagery (click-click-click… ✓). Every part stays selectable and editable —
 * nudge, turn, resize, recolour, date — and the whole composition saves as a
 * georeferenced spec: always to this device, published for every visitor when
 * the maker key is present (the same trust model as placement trims).
 *
 * While the builder is open the globe's own click behaviour stands down
 * (setBuilderActive), so a trace click never opens a place dossier.
 */
import { useEffect, useRef, useState } from 'react';
import * as Cesium from 'cesium';
import {
  PART_DEFAULTS,
  PART_NAMES,
  MIN_VERTS,
  allVerts,
  clampPart,
  movePart,
  movePartTo,
  snapVert,
  type SitePart,
  type SitePartType,
  type SitePlan,
} from '../lib/sitePlan';
import {
  currentSitePlan,
  currentTimelineYear,
  loadLocalSitePlans,
  pickedSitePart,
  renderSitePlan,
  saveLocalSitePlan,
  setBuilderActive,
} from '../lib/sitePlanRender';
import { getViewer } from '../lib/globeModels';

interface SiteBuilderProps {
  /** "siteplan:<model>@<lat>,<lon>" — where this site saves. */
  siteKey: string;
  /** The monument anchor (plan origin for a fresh site). */
  origin: { lat: number; lon: number };
  /** Persist upward: MakerRow publishes via the key when present. */
  onPublish: (plan: SitePlan) => void;
  onStatus: (msg: string) => void;
}

type Mode =
  | { kind: 'idle' }
  | { kind: 'place'; type: 'box' | 'cylinder' }
  | { kind: 'trace'; type: 'wall' | 'platform' | 'water' }
  | { kind: 'movehere' }; // next ground click repositions the selected part

const TRACED = new Set(['wall', 'platform', 'water']);

export default function SiteBuilder({ siteKey, origin, onPublish, onStatus }: SiteBuilderProps) {
  const [plan, setPlan] = useState<SitePlan>(
    () =>
      currentSitePlan(siteKey) ??
      loadLocalSitePlans()[siteKey] ?? { origin, parts: [] },
  );
  const [mode, setMode] = useState<Mode>({ kind: 'idle' });
  const [selected, setSelected] = useState<number | null>(null);
  const [trace, setTrace] = useState<Array<[number, number]>>([]);

  // Refs so the (one) Cesium handler always sees current state.
  const planRef = useRef(plan);
  planRef.current = plan;
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const traceRef = useRef(trace);
  traceRef.current = trace;
  const selectedRef = useRef(selected);
  selectedRef.current = selected;

  /** Apply + live-render a new plan (the single write path). */
  const commit = (next: SitePlan) => {
    setPlan(next);
    renderSitePlan(siteKey, next);
  };

  // Trace preview: a polyline + points that follow the clicks.
  const previewRef = useRef<Cesium.Entity[]>([]);
  const drawPreview = (verts: Array<[number, number]>) => {
    const viewer = getViewer();
    if (!viewer) return;
    for (const e of previewRef.current) viewer.entities.remove(e);
    previewRef.current = [];
    if (verts.length) {
      previewRef.current.push(
        viewer.entities.add({
          polyline: {
            positions: verts.map(([la, lo]) => Cesium.Cartesian3.fromDegrees(lo, la)),
            width: 3,
            material: Cesium.Color.GOLD,
            clampToGround: true,
          },
        }),
      );
      for (const [la, lo] of verts) {
        previewRef.current.push(
          viewer.entities.add({
            position: Cesium.Cartesian3.fromDegrees(lo, la),
            point: { pixelSize: 7, color: Cesium.Color.GOLD, heightReference: Cesium.HeightReference.CLAMP_TO_GROUND },
          }),
        );
      }
    }
    viewer.scene.requestRender();
  };

  // The builder's own click handler — coexists with the globe's (which stands
  // down via setBuilderActive while we're open).
  useEffect(() => {
    const viewer = getViewer();
    if (!viewer) return;
    setBuilderActive(true);
    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);

    handler.setInputAction((movement: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
      const m = modeRef.current;

      // Selecting an existing part always works in idle mode.
      if (m.kind === 'idle') {
        const picked = viewer.scene.pick(movement.position) as { id?: { id?: unknown } } | undefined;
        const hit = pickedSitePart(picked?.id?.id);
        if (hit && hit.key === siteKey) {
          setSelected(hit.index);
          onStatus(`selected part ${hit.index + 1}`);
        }
        return;
      }

      // Place / trace need a ground position.
      const cartesian = viewer.camera.pickEllipsoid(movement.position, viewer.scene.globe.ellipsoid);
      if (!cartesian) return;
      const carto = Cesium.Cartographic.fromCartesian(cartesian);
      const lat = Cesium.Math.toDegrees(carto.latitude);
      const lon = Cesium.Math.toDegrees(carto.longitude);

      if (m.kind === 'movehere') {
        const idx = selectedRef.current;
        const part = idx != null ? planRef.current.parts[idx] : undefined;
        if (idx != null && part) {
          const parts = planRef.current.parts.slice();
          parts[idx] = movePartTo(part, [lat, lon]);
          commit({ ...planRef.current, parts });
          onStatus('moved ✓');
        }
        setMode({ kind: 'idle' });
        return;
      }

      if (m.kind === 'place') {
        // Record the drawing moment: a part composed at 1097 CE belongs to
        // 1097 CE (clear "from yr" in the edit panel to make it timeless).
        const fromYear = Math.round(currentTimelineYear());
        const part = clampPart({ ...PART_DEFAULTS[m.type], type: m.type, lat, lon, fromYear });
        const next = { ...planRef.current, parts: [...planRef.current.parts, part] };
        commit(next);
        setSelected(next.parts.length - 1);
        setMode({ kind: 'idle' });
        onStatus(`${PART_NAMES[m.type]} placed at ${fromYear} — drag it true with the pad`);
        return;
      }

      // Tracing: snap the click onto existing geometry so walls meet corners.
      const snapped = snapVert([lat, lon], [...allVerts(planRef.current), ...traceRef.current]);
      const nextTrace = [...traceRef.current, snapped];
      setTrace(nextTrace);
      drawPreview(nextTrace);
      onStatus(`${nextTrace.length} point${nextTrace.length === 1 ? '' : 's'} — ✓ when done`);
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    return () => {
      handler.destroy();
      setBuilderActive(false);
      drawPreview([]);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteKey]);

  const finishTrace = () => {
    const m = modeRef.current;
    if (m.kind !== 'trace') return;
    const min = MIN_VERTS[m.type];
    if (trace.length < min) {
      onStatus(`need at least ${min} points`);
      return;
    }
    // Traced parts record the drawing moment too (see the place path).
    const fromYear = Math.round(currentTimelineYear());
    const part = clampPart({ ...PART_DEFAULTS[m.type], type: m.type, verts: trace, fromYear });
    const next = { ...plan, parts: [...plan.parts, part] };
    commit(next);
    setSelected(next.parts.length - 1);
    setTrace([]);
    drawPreview([]);
    setMode({ kind: 'idle' });
    onStatus(`${PART_NAMES[m.type]} traced ✓`);
  };

  const cancelTrace = () => {
    setTrace([]);
    drawPreview([]);
    setMode({ kind: 'idle' });
    onStatus('trace cancelled');
  };

  const undoPoint = () => {
    const next = traceRef.current.slice(0, -1);
    setTrace(next);
    drawPreview(next);
    onStatus(next.length ? `${next.length} point${next.length === 1 ? '' : 's'}` : 'trace empty — click to start');
  };

  // Keyboard: Escape backs out of any mode, Enter finishes a trace. Typing in
  // a field (name, years) is left alone.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === 'Escape') {
        if (modeRef.current.kind === 'trace') cancelTrace();
        else if (modeRef.current.kind !== 'idle') { setMode({ kind: 'idle' }); onStatus('cancelled'); }
        else setSelected(null);
      }
      if (e.key === 'Enter' && modeRef.current.kind === 'trace') finishTrace();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const editSelected = (edit: (p: SitePart) => SitePart) => {
    if (selected == null || !plan.parts[selected]) return;
    const parts = plan.parts.slice();
    parts[selected] = clampPart(edit(parts[selected]));
    commit({ ...plan, parts });
  };

  const removeSelected = () => {
    if (selected == null) return;
    const parts = plan.parts.filter((_, i) => i !== selected);
    commit({ ...plan, parts });
    setSelected(null);
  };

  const duplicateSelected = () => {
    if (selected == null || !plan.parts[selected]) return;
    // Offset the copy 10 m east so it doesn't hide inside the original.
    const copy = movePart(plan.parts[selected], 10, 0);
    const next = { ...plan, parts: [...plan.parts, copy] };
    commit(next);
    setSelected(next.parts.length - 1);
  };

  const save = () => {
    saveLocalSitePlan(siteKey, plan.parts.length ? plan : undefined);
    onPublish(plan);
  };

  const pickMode = (t: SitePartType) => {
    setSelected(null);
    if (TRACED.has(t)) {
      setTrace([]);
      setMode({ kind: 'trace', type: t as 'wall' | 'platform' | 'water' });
      onStatus(`tracing ${PART_NAMES[t].toLowerCase()} — click the ground, ✓ to finish`);
    } else {
      setMode({ kind: 'place', type: t as 'box' | 'cylinder' });
      onStatus(`click the ground to drop a ${PART_NAMES[t].toLowerCase()}`);
    }
  };

  const sel = selected != null ? plan.parts[selected] : null;
  const step = (label: string, get: () => string, dn: () => void, up: () => void) => (
    <div className="sb-step" key={label}>
      <span>{label}</span>
      <button onClick={dn} aria-label={`${label} down`}>−</button>
      <b>{get()}</b>
      <button onClick={up} aria-label={`${label} up`}>＋</button>
    </div>
  );

  return (
    <div className="site-builder">
      <div className="sb-palette" role="toolbar" aria-label="Add a part">
        {(Object.keys(PART_NAMES) as SitePartType[]).map((t) => (
          <button
            key={t}
            className={((mode.kind === 'place' || mode.kind === 'trace') && mode.type === t) ? 'on' : ''}
            onClick={() => pickMode(t)}
          >
            {t === 'box' ? '▢' : t === 'cylinder' ? '◯' : t === 'wall' ? '─' : t === 'platform' ? '▬' : '≈'} {PART_NAMES[t]}
          </button>
        ))}
      </div>

      {mode.kind === 'trace' && (
        <div className="sb-tracebar">
          <span>{trace.length} pts</span>
          <button className="sb-ok" onClick={finishTrace}>✓ finish</button>
          <button onClick={undoPoint} disabled={!trace.length}>↩ undo point</button>
          <button onClick={cancelTrace}>✕ cancel</button>
        </div>
      )}

      {plan.parts.length > 0 && (
        <div className="sb-parts">
          {plan.parts.map((p, i) => (
            <button
              key={i}
              className={`sb-chip ${selected === i ? 'on' : ''}`}
              onClick={() => setSelected(selected === i ? null : i)}
            >
              {p.label ?? `${PART_NAMES[p.type]} ${i + 1}`}
            </button>
          ))}
        </div>
      )}

      {sel && (
        <div className="sb-edit">
          <input
            className="sb-name"
            placeholder="name this part…"
            defaultValue={sel.label ?? ''}
            onBlur={(e) => {
              const v = e.currentTarget.value.trim();
              editSelected((p) => ({ ...p, label: v || undefined }));
            }}
          />
          <div className="sb-pad">
            <button onClick={() => editSelected((p) => movePart(p, 0, 2))}>▲ N</button>
            <div>
              <button onClick={() => editSelected((p) => movePart(p, -2, 0))}>◀ W</button>
              <button onClick={() => editSelected((p) => movePart(p, 2, 0))}>E ▶</button>
            </div>
            <button onClick={() => editSelected((p) => movePart(p, 0, -2))}>▼ S</button>
          </div>
          <div className="sb-steps">
            {sel.type === 'box' && [
              step('width', () => `${sel.widthM} m`, () => editSelected((p) => ({ ...p, widthM: (p.widthM ?? 20) - 2 })), () => editSelected((p) => ({ ...p, widthM: (p.widthM ?? 20) + 2 }))),
              step('length', () => `${sel.lengthM} m`, () => editSelected((p) => ({ ...p, lengthM: (p.lengthM ?? 20) - 2 })), () => editSelected((p) => ({ ...p, lengthM: (p.lengthM ?? 20) + 2 }))),
              step('turn', () => `${sel.rotationDeg}°`, () => editSelected((p) => ({ ...p, rotationDeg: (p.rotationDeg ?? 0) - 5 })), () => editSelected((p) => ({ ...p, rotationDeg: (p.rotationDeg ?? 0) + 5 }))),
            ]}
            {sel.type === 'cylinder' &&
              step('radius', () => `${sel.radiusM} m`, () => editSelected((p) => ({ ...p, radiusM: (p.radiusM ?? 6) - 1 })), () => editSelected((p) => ({ ...p, radiusM: (p.radiusM ?? 6) + 1 })))}
            {sel.type === 'wall' &&
              step('thick', () => `${sel.thicknessM} m`, () => editSelected((p) => ({ ...p, thicknessM: (p.thicknessM ?? 3) - 0.5 })), () => editSelected((p) => ({ ...p, thicknessM: (p.thicknessM ?? 3) + 0.5 })))}
            {sel.type !== 'water' &&
              step('height', () => `${sel.heightM} m`, () => editSelected((p) => ({ ...p, heightM: (p.heightM ?? 10) - 1 })), () => editSelected((p) => ({ ...p, heightM: (p.heightM ?? 10) + 1 })))}
          </div>
          <div className="sb-row">
            <label>
              colour
              <input
                type="color"
                value={sel.color ?? '#d8d2c4'}
                onChange={(e) => editSelected((p) => ({ ...p, color: e.target.value }))}
              />
            </label>
            <label>
              from yr
              <input
                type="number"
                className="sb-year"
                value={sel.fromYear ?? ''}
                placeholder="always"
                onChange={(e) => {
                  const v = e.target.value === '' ? undefined : Number(e.target.value);
                  editSelected((p) => ({ ...p, fromYear: Number.isFinite(v as number) ? v : undefined }));
                }}
              />
            </label>
            <label>
              to yr
              <input
                type="number"
                className="sb-year"
                value={sel.toYear ?? ''}
                placeholder="today"
                onChange={(e) => {
                  const v = e.target.value === '' ? undefined : Number(e.target.value);
                  editSelected((p) => ({ ...p, toYear: Number.isFinite(v as number) ? v : undefined }));
                }}
              />
            </label>
            <button
              className={mode.kind === 'movehere' ? 'on' : ''}
              title="then click the ground — the part jumps there"
              onClick={() => {
                setMode(mode.kind === 'movehere' ? { kind: 'idle' } : { kind: 'movehere' });
                onStatus(mode.kind === 'movehere' ? '' : 'click the ground to move it there');
              }}
            >
              📍 move here
            </button>
            <button onClick={duplicateSelected} title="duplicate this part">⧉</button>
            <button onClick={removeSelected} title="delete this part">🗑</button>
          </div>
        </div>
      )}

      <div className="sb-actions">
        <span className="sb-hint">
          {plan.parts.length ? `${plan.parts.length} part${plan.parts.length === 1 ? '' : 's'}` : 'pick a shape, then click the satellite ground'}
        </span>
        <button className="sb-save" onClick={save}>💾 save site</button>
      </div>
    </div>
  );
}
