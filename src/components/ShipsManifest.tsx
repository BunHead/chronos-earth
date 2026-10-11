import { useEffect, useState } from 'react';
import { startWindowDrag } from '../lib/windowDrag';
import { FOUNDING_BERTHS, PATREON_URL, loadManifest, type CrewMember } from '../lib/manifest';

interface ShipsManifestProps {
  onClose: () => void;
}

/**
 * ShipsManifest
 * -------------
 * The roll of patrons keeping the voyage free (the £3 Time Traveller perk),
 * from the ⋯ menu. Founding patrons — the first 20 aboard — wear a star.
 * No pop-ups, no nagging: it opens only when someone asks for it.
 */
export default function ShipsManifest({ onClose }: ShipsManifestProps) {
  const [crew, setCrew] = useState<CrewMember[] | null>(null);
  useEffect(() => {
    let alive = true;
    void loadManifest().then((c) => { if (alive) setCrew(c); });
    return () => { alive = false; };
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="bv-overlay" role="dialog" aria-label="The ship's manifest" onClick={onClose}>
      <div className="about-window manifest-window" onClick={(e) => e.stopPropagation()}>
        <header className="bv-header" onPointerDown={startWindowDrag} title="Drag to move">
          <div>
            <h2>The Ship&rsquo;s Manifest ⚓</h2>
            <p>The patrons keeping Chronos Earth free for everyone.</p>
          </div>
          <button className="info-close" onClick={onClose} aria-label="Close the manifest">
            ×
          </button>
        </header>
        <div className="about-body">
          {crew === null && <p className="info-summary">Reading the manifest…</p>}
          {crew !== null && crew.length === 0 && (
            <div className="manifest-empty">
              <p>
                The manifest is open and the first berth is empty. Every patron from £3 a month is
                listed here, and the <b>first {FOUNDING_BERTHS} aboard wear a founding star ⭐ forever</b>.
              </p>
              <a className="support-btn" href={PATREON_URL} target="_blank" rel="noopener noreferrer">
                ⚓ Be the first aboard
              </a>
            </div>
          )}
          {crew !== null && crew.length > 0 && (
            <>
              <p className="info-summary">
                {crew.length} aboard, with gratitude.{' '}
                {crew.some((c) => c.founding) && <span className="manifest-key">⭐ founding patron</span>}
              </p>
              <ol className="manifest-list">
                {crew.map((c, i) => (
                  <li key={`${i}-${c.name}`} className={c.founding ? 'founding' : undefined}>
                    <span className="manifest-name">{c.name}</span>
                    {c.founding && <span className="manifest-star" title="Founding patron — among the first aboard">⭐</span>}
                  </li>
                ))}
              </ol>
              <p className="manifest-join">
                <a href={PATREON_URL} target="_blank" rel="noopener noreferrer">Join the crew on Patreon</a> — the site stays free either way.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
