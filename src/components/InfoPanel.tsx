import { useEffect, useRef, useState } from 'react';
import MakerRow from './MakerRow';
import type { ExternalLink, PanelContent } from '../lib/types';
import { flagCanvasFor } from '../lib/flags';
import { hydrateEvent } from '../lib/detail';
import { eventToPanel } from '../lib/panel';
import CommanderFaces from './CommanderFaces';

interface InfoPanelProps {
  content: PanelContent | null;
  onClose: () => void;
  onFly: (content: PanelContent) => void;
  onZoomToBattle: (battleId: string) => void;
  onViewMonument: (monument: NonNullable<PanelContent['monument3d']>) => void;
}

function LinkList({ links }: { links: ExternalLink[] }) {
  return (
    <ul className="links">
      {links.map((link) => (
        <li key={link.url}>
          <a href={link.url} target="_blank" rel="noopener noreferrer">
            {link.label} ↗
          </a>
        </li>
      ))}
    </ul>
  );
}

/**
 * InfoPanel
 * ---------
 * Slides in from the right for any selected thing (ancient site, political
 * entity, or battle). Shows the mainstream content first, then — if present —
 * a clearly-flagged alternative hypothesis.
 */
export default function InfoPanel({ content: rawContent, onClose, onFly, onZoomToBattle, onViewMonument }: InfoPanelProps) {
  // Skeleton-loaded events arrive without their heavy fields (sides, deaths,
  // the war they belong to…). `content.hydrate` carries the source event; we
  // fetch its per-cell detail lazily and rebuild the panel when it lands. The
  // `source` tag ties the upgrade to the content that asked for it, so a
  // late fetch can never resurrect a closed or replaced panel.
  const [upgraded, setUpgraded] = useState<{ source: PanelContent; content: PanelContent } | null>(null);
  useEffect(() => {
    const ev = rawContent?.hydrate;
    if (!ev) return;
    let cancelled = false;
    void hydrateEvent(ev).then((changed) => {
      if (!cancelled && changed) setUpgraded({ source: rawContent, content: eventToPanel(ev) });
    });
    return () => {
      cancelled = true;
    };
  }, [rawContent]);
  const content = upgraded && upgraded.source === rawContent ? upgraded.content : rawContent;

  const [wiki, setWiki] = useState<{
    status: 'idle' | 'loading' | 'done' | 'error';
    extract?: string;
    thumb?: string;
  }>({ status: 'idle' });
  // User-chosen panel width (px), via the left-edge grab bar. Null = CSS default.
  const [panelWidth, setPanelWidth] = useState<number | null>(null);
  const panelRef = useRef<HTMLElement | null>(null);

  // Drag the panel anywhere by its top pill. The panel normally slides in via
  // a CSS transform, so moving works by switching to explicit left/top — and
  // everything resets when the panel closes, so the slide-in stays intact.
  const startPanelMove = (e: React.PointerEvent) => {
    const el = panelRef.current;
    if (!el) return;
    e.preventDefault();
    const rect = el.getBoundingClientRect();
    el.style.top = `${rect.top}px`;
    el.style.left = `${rect.left}px`;
    el.style.right = 'auto';
    el.style.bottom = 'auto';
    el.style.height = `${rect.height}px`;
    const sx = e.clientX;
    const sy = e.clientY;
    const move = (ev: PointerEvent) => {
      el.style.left = `${rect.left + ev.clientX - sx}px`;
      el.style.top = `${Math.max(0, rect.top + ev.clientY - sy)}px`;
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  useEffect(() => {
    if (!content && panelRef.current) {
      const s = panelRef.current.style;
      s.top = s.left = s.right = s.bottom = s.height = '';
    }
  }, [content]);
  // Click the flag banner → fetch that flag's own story from Wikipedia.
  const [flagStory, setFlagStory] = useState<{
    status: 'closed' | 'loading' | 'done' | 'none';
    extract?: string;
    thumb?: string;
  }>({ status: 'closed' });
  useEffect(() => {
    setFlagStory({ status: 'closed' });
  }, [content?.title, content?.flag?.name]);

  const openFlagStory = (name: string) => {
    if (flagStory.status !== 'closed') {
      setFlagStory({ status: 'closed' }); // second click folds it away
      return;
    }
    setFlagStory({ status: 'loading' });
    // Try the modern country's flag article; strip common historical prefixes.
    const base = name.replace(/^(kingdom|empire|republic|duchy|grand duchy|principality) of /i, '');
    fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent('Flag_of_' + base.replace(/ /g, '_'))}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((j) => setFlagStory({ status: 'done', extract: j.extract, thumb: j.thumbnail?.source }))
      .catch(() => setFlagStory({ status: 'none' }));
  };

  // For imported events, fetch the real Wikipedia summary + photo on open.
  useEffect(() => {
    const title = content?.wikiTitle;
    if (!title) {
      setWiki({ status: 'idle' });
      return;
    }
    let cancelled = false;
    setWiki({ status: 'loading' });
    fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((j) => {
        if (!cancelled) setWiki({ status: 'done', extract: j.extract, thumb: j.thumbnail?.source });
      })
      .catch(() => {
        if (!cancelled) setWiki({ status: 'error' });
      });
    return () => {
      cancelled = true;
    };
  }, [content?.wikiTitle]);

  return (
    <aside
      ref={panelRef}
      className={`info-panel ${content ? 'open' : ''}`}
      aria-hidden={!content}
      style={panelWidth !== null ? { width: `${panelWidth}px` } : undefined}
    >
      {content && (
        <div className="info-inner">
          {/* Top pill — drag it to move the whole panel anywhere. */}
          <div className="panel-move" title="Drag to move" onPointerDown={startPanelMove} />
          {/* Visible grab bar — drag the panel's left edge to resize it. */}
          <div
            className="panel-grip"
            title="Drag to resize"
            onPointerDown={(e) => {
              e.preventDefault();
              const startX = e.clientX;
              const startW = panelWidth ?? panelRef.current?.offsetWidth ?? 380;
              const move = (ev: PointerEvent) => {
                const cap = Math.max(320, window.innerWidth * 0.75);
                setPanelWidth(Math.min(cap, Math.max(280, startW + (startX - ev.clientX))));
              };
              const up = () => {
                window.removeEventListener('pointermove', move);
                window.removeEventListener('pointerup', up);
              };
              window.addEventListener('pointermove', move);
              window.addEventListener('pointerup', up);
            }}
          />
          <button className="info-close" onClick={onClose} aria-label="Close panel">
            ×
          </button>

          <span className="info-kicker">{content.kicker}</span>
          <h2 className="info-title">{content.title}</h2>
          {content.date && <div className="info-date">{content.date}</div>}

          {content.flag &&
            (() => {
              const fc = flagCanvasFor(content.flag.name, content.flag.year);
              if (!fc) return null;
              return (
                <>
                  <img
                    className="info-flag"
                    src={fc.toDataURL()}
                    alt={`Flag of ${content.flag.name}`}
                    title="Click for this flag's story"
                    onClick={() => openFlagStory(content.flag!.name)}
                  />
                  <em className="flag-then">
                    flying in {Math.abs(content.flag.year)} {content.flag.year < 0 ? 'BCE' : 'CE'}
                  </em>
                  {flagStory.status === 'loading' && <p className="flag-story dim">Fetching this flag's story…</p>}
                  {flagStory.status === 'done' && (
                    <div className="flag-story">
                      {/* The banner above shows the flag OF THAT YEAR; this is
                          the country's flag today — captioned so the pair
                          reads as history, not a glitch. */}
                      {flagStory.thumb && (
                        <span className="flag-today">
                          <img src={flagStory.thumb} alt="" />
                          <em>the flag today</em>
                        </span>
                      )}
                      <p>{flagStory.extract}</p>
                    </div>
                  )}
                  {flagStory.status === 'none' && (
                    <p className="flag-story dim">
                      No flag article survives for {content.flag.name} — this banner is our own colours
                      for telling nations apart.
                    </p>
                  )}
                </>
              );
            })()}

          <div className="info-actions">
            {content.battleId && (
              <button className="btn primary" onClick={() => onZoomToBattle(content.battleId!)}>
                ⚔ Zoom to battle
              </button>
            )}
            {content.monument3d && (
              <button
                className="btn primary"
                onClick={() => onViewMonument(content.monument3d!)}
              >
                🌍 Visit on the globe
              </button>
            )}
            {content.fly && (
              <button className="btn" onClick={() => onFly(content)}>
                ✈ Fly here
              </button>
            )}
          </div>

          {/* The maker's reins over the globe: review any monument or battle
              right here — appears only when the Captain's key is present. */}
          {(content.monument3d || content.battleId) && (
            <MakerRow reviewKey={content.battleId ? `battle:${content.battleId}` : content.monument3d!.model} />
          )}

          {wiki.thumb && (
            <img className="info-thumb" src={wiki.thumb} alt={content.title} loading="lazy" />
          )}

          {content.commanders && content.commanders.length > 0 && (
            <CommanderFaces commanders={content.commanders} sideNames={content.sideNames} size="lg" />
          )}

          {wiki.status === 'done' && wiki.extract ? (
            <p className="info-summary">{wiki.extract}</p>
          ) : (
            content.summary && <p className="info-summary">{content.summary}</p>
          )}
          {content.wikiTitle && wiki.status === 'loading' && (
            <p className="info-loading">Loading the full summary…</p>
          )}
          {content.wikiTitle && wiki.status === 'error' && (
            <p className="info-note">Couldn't reach Wikipedia just now — the link below has the full article.</p>
          )}

          {content.related && content.related.length > 0 && (
            <ul className="related-list">
              {content.related.map((r, i) => (
                <li key={i}>
                  <button className="related-item" onClick={r.onClick}>
                    <span className="related-label">{r.label}</span>
                    {r.sublabel && <span className="related-sub">{r.sublabel}</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}

          {content.sections?.map((section) => (
            <div key={section.heading}>
              <h3 className="info-h3">{section.heading}</h3>
              {section.body && <p className="info-summary">{section.body}</p>}
              {section.bullets && (
                <ul className="facts">
                  {section.bullets.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}

          {content.links && content.links.length > 0 && (
            <>
              <h3 className="info-h3">Learn more</h3>
              <LinkList links={content.links} />
            </>
          )}

          {content.alternative && (
            <div className="alt-block">
              <div className="alt-flag">⚠ Contested / alternative hypothesis</div>
              <h3 className="info-h3">{content.alternative.proponent}</h3>
              <p className="info-summary">{content.alternative.claim}</p>
              <p className="alt-note">
                <b>Reality check:</b> {content.alternative.note}
              </p>
              <LinkList links={content.alternative.links} />
            </div>
          )}
        </div>
      )}
    </aside>
  );
}
