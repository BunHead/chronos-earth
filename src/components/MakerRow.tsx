/**
 * MakerRow — the Workshop's reins, floating over the globe.
 *
 * When the Captain's maker key is present (the same one the Workshop holds in
 * localStorage — same origin, same key), every monument and battle panel in
 * the MAIN APP grows a compact review strip: status badge, Approve / Allow /
 * Reject, a note, and Queue rework — writing to the same model-review.json
 * through the same GitHub-gated store. Visitors without the key see nothing;
 * the globe stays clean.
 */
import { useEffect, useState } from 'react';
import {
  getToken,
  getLocalMaker,
  validateMakerToken,
  loadReview,
  saveReview,
  saveLocalTransform,
  loadLocalTransforms,
  type ModelTransform,
  type ReviewData,
  type ReviewStatus,
} from '../lib/review';
import { applyLiveTransform, transformKey } from '../lib/globeModels';

// One shared copy of the review file per app session.
let shared: ReviewData | null = null;
let sharedLoading: Promise<ReviewData> | null = null;
async function sharedReview(): Promise<ReviewData> {
  if (shared) return shared;
  sharedLoading ??= loadReview().then((d) => (shared = d));
  return sharedLoading;
}

const BADGE: Record<string, string> = {
  approved: 'Approved',
  allowed: 'Allowed for now',
  rejected: 'Rejected',
};

interface MakerRowProps {
  reviewKey: string;
  /** When present, the ⟠ Adjust reins appear: live move / rotate / scale /
   * lift of this monument standing on the globe, saved through the key. */
  place?: { model: string; lat: number; lon: number };
}

export default function MakerRow({ reviewKey, place }: MakerRowProps) {
  const [unlocked, setUnlocked] = useState(false);
  // Local maker mode (⋯ menu switch): the reins work with no GitHub key,
  // saving to this device. `keyed` means a validated key — only then can
  // review verdicts and placements be PUBLISHED for every visitor.
  const [keyed, setKeyed] = useState(false);
  const [, bump] = useState(0);
  const [msg, setMsg] = useState('');
  const [adjusting, setAdjusting] = useState(false);

  useEffect(() => {
    let alive = true;
    const local = getLocalMaker();
    if (local) void sharedReview().then(() => { if (alive) setUnlocked(true); });
    if (!getToken()) return;
    validateMakerToken().then(async (r) => {
      if (!alive || !r.ok) return;
      await sharedReview();
      setKeyed(true);
      setUnlocked(true);
    });
    return () => { alive = false; };
  }, []);

  if (!unlocked || !shared) return null;
  const rec = (shared[reviewKey] ??= {});

  const persist = async () => {
    bump((n) => n + 1);
    setMsg('Saving…');
    const res = await saveReview(shared!);
    setMsg(res.ok ? 'Saved ✓' : res.msg);
  };

  const setStatus = (v: ReviewStatus) => {
    rec.status = rec.status === v ? undefined : v;
    rec.ts = Date.now();
    void persist();
  };

  return (
    <div className="maker-row" title={`Maker review · ${reviewKey}`}>
      <span className={`maker-badge ${rec.status ?? ''}`}>
        {rec.status ? BADGE[rec.status] : rec.rework ? 'Rework queued' : 'Unreviewed'}
      </span>
      <div className="maker-btns">
        <button className={rec.status === 'approved' ? 'on' : ''} onClick={() => setStatus('approved')}>✓</button>
        <button className={rec.status === 'allowed' ? 'on' : ''} onClick={() => setStatus('allowed')}>~</button>
        <button className={rec.status === 'rejected' ? 'on' : ''} onClick={() => setStatus('rejected')}>✕</button>
        <button
          title="Queue for rework next session"
          onClick={() => { rec.rework = true; rec.ts = Date.now(); void persist(); }}
        >
          🛠
        </button>
        {place && (
          <button
            className={adjusting ? 'on' : ''}
            title="Adjust this monument's placement on the globe"
            onClick={() => setAdjusting((v) => !v)}
          >
            🧭
          </button>
        )}
      </div>
      <input
        className="maker-note"
        placeholder="note for the modeller…"
        defaultValue={rec.note ?? ''}
        onBlur={(e) => {
          const v = e.currentTarget.value.trim();
          if ((rec.note ?? '') === v) return;
          rec.note = v || undefined;
          rec.ts = Date.now();
          void persist();
        }}
      />
      {msg && <span className="maker-msg">{msg}</span>}
      {adjusting && place && (
        <AdjustReins
          place={place}
          onStatus={setMsg}
          persist={(t) => {
            const key = transformKey(place.model, place.lat, place.lon);
            const trim = Object.keys(t).length ? t : undefined;
            // Always keep this device's copy so the alignment survives reload.
            saveLocalTransform(key, trim);
            if (keyed) {
              // With a key, ALSO publish it for every visitor via the repo.
              const r = (shared![key] ??= {});
              r.transform = trim;
              r.ts = Date.now();
              void persist();
            } else {
              setMsg('Saved on this device. Add your key to publish for everyone.');
            }
          }}
        />
      )}
    </div>
  );
}

/**
 * The transform reins: every press moves the model LIVE on the globe, so
 * the Captain lines it up against the real satellite footprint by eye —
 * then 💾 commits the trim to the review file for every future visitor.
 */
function AdjustReins({
  place,
  persist,
  onStatus,
}: {
  place: { model: string; lat: number; lon: number };
  persist: (t: ModelTransform) => void;
  onStatus: (s: string) => void;
}) {
  const key = transformKey(place.model, place.lat, place.lon);
  // Seed the pad from THIS DEVICE's saved trim first (local maker mode saves
  // there), then the published one — so reopening a monument shows the trim
  // you actually saved, and a new nudge builds on it instead of from zero.
  const [t, setT] = useState<ModelTransform>(() => ({
    ...(shared?.[key]?.transform ?? {}),
    ...(loadLocalTransforms()[key] ?? {}),
  }));

  const change = (delta: Partial<ModelTransform>) => {
    const next: ModelTransform = { ...t };
    for (const [k, v] of Object.entries(delta) as Array<[keyof ModelTransform, number]>) {
      const base = k === 'scale' ? (next[k] ?? 1) : (next[k] ?? 0);
      const val = k === 'scale' ? +(base * v).toFixed(3) : +(base + v).toFixed(1);
      if ((k === 'scale' && Math.abs(val - 1) < 0.001) || (k !== 'scale' && Math.abs(val) < 0.05)) delete next[k];
      else next[k] = val;
    }
    setT(next);
    applyLiveTransform(place.model, place.lat, place.lon, next);
    onStatus('adjusting — 💾 to keep');
  };

  // A compass pad (the Captain's layout): move N/S/E/W around a centre +,
  // turn on the two TOP corners (NW left, NE right), height at SW, scale at
  // SE. Corner steppers show their live readout beneath.
  const stepCorner = (label: string, down: () => void, up: () => void, readout: string, cls: string) => (
    <div className={`adj-corner ${cls}`}>
      <span className="adj-clabel">{label}</span>
      <div className="adj-cbtns">
        <button onClick={down} aria-label={`${label} down`}>−</button>
        <button onClick={up} aria-label={`${label} up`}>＋</button>
      </div>
      <span className="adj-cread">{readout}</span>
    </div>
  );

  return (
    <div className="maker-adjust">
      <div className="adj-pad">
        <button className="adj-corner nw turnbtn" onClick={() => change({ headingDeg: -2.5 })} aria-label="turn left">
          <span className="adj-clabel">turn</span>⟲<span className="adj-cread">{t.headingDeg ?? 0}°</span>
        </button>
        <button className="adj-dir n" onClick={() => change({ northM: 10 })} aria-label="move north">▲<small>N</small></button>
        <button className="adj-corner ne turnbtn" onClick={() => change({ headingDeg: 2.5 })} aria-label="turn right">
          <span className="adj-clabel">turn</span>⟳<span className="adj-cread">{t.headingDeg ?? 0}°</span>
        </button>

        <button className="adj-dir w" onClick={() => change({ eastM: -10 })} aria-label="move west">◀<small>W</small></button>
        <div className="adj-hub">✛</div>
        <button className="adj-dir e" onClick={() => change({ eastM: 10 })} aria-label="move east">▶<small>E</small></button>

        {stepCorner('height', () => change({ upM: -2 }), () => change({ upM: 2 }), `${t.upM ?? 0} m`, 'sw')}
        <button className="adj-dir s" onClick={() => change({ northM: -10 })} aria-label="move south">▼<small>S</small></button>
        {stepCorner('scale', () => change({ scale: 1 / 1.05 }), () => change({ scale: 1.05 }), `×${t.scale ?? 1}`, 'se')}
      </div>
      <div className="adj-actions">
        <button
          onClick={() => {
            setT({});
            applyLiveTransform(place.model, place.lat, place.lon, {});
            persist({});
          }}
        >
          reset
        </button>
        <button className="adj-save" onClick={() => persist(t)}>💾 save placement</button>
      </div>
    </div>
  );
}
