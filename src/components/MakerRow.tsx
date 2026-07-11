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
  validateMakerToken,
  loadReview,
  saveReview,
  type ReviewData,
  type ReviewStatus,
} from '../lib/review';

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

export default function MakerRow({ reviewKey }: { reviewKey: string }) {
  const [unlocked, setUnlocked] = useState(false);
  const [, bump] = useState(0);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    let alive = true;
    if (!getToken()) return;
    validateMakerToken().then(async (r) => {
      if (!alive || !r.ok) return;
      await sharedReview();
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
    </div>
  );
}
