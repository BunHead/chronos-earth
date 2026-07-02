import { useEffect, useState } from 'react';
import type { ExternalLink, PanelContent } from '../lib/types';
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
export default function InfoPanel({ content, onClose, onFly, onZoomToBattle, onViewMonument }: InfoPanelProps) {
  const [wiki, setWiki] = useState<{
    status: 'idle' | 'loading' | 'done' | 'error';
    extract?: string;
    thumb?: string;
  }>({ status: 'idle' });

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
    <aside className={`info-panel ${content ? 'open' : ''}`} aria-hidden={!content}>
      {content && (
        <div className="info-inner">
          <button className="info-close" onClick={onClose} aria-label="Close panel">
            ×
          </button>

          <span className="info-kicker">{content.kicker}</span>
          <h2 className="info-title">{content.title}</h2>
          {content.date && <div className="info-date">{content.date}</div>}

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
                🧊 View in 3D
              </button>
            )}
            {content.fly && (
              <button className="btn" onClick={() => onFly(content)}>
                ✈ Fly here
              </button>
            )}
          </div>

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
