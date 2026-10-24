import { useEffect, useRef, useState, type ReactNode } from 'react';
import MakerRow from './MakerRow';
import type { ExternalLink, MergedRecord, PanelContent } from '../lib/types';
import { flagCanvasFor } from '../lib/flags';
import { hydrateEvent } from '../lib/detail';
import { eventToPanel, sourceLabel, yearLabel } from '../lib/panel';
import { gizaCapNote } from '../lib/gizaCap';
import { stonehengeNote } from '../lib/stonehengeNote';
import { buckinghamNote } from '../lib/buckinghamNote';
import { westminsterNote } from '../lib/westminsterNote';
import { landmarkNote } from '../lib/landmarkMesh';
import { applyTone, type ToneId } from '../lib/tone';
import CommanderFaces from './CommanderFaces';

interface InfoPanelProps {
  content: PanelContent | null;
  /** The reader's chosen register — Explorer, Scholar or Curious Reader. */
  tone: ToneId;
  onClose: () => void;
  onFly: (content: PanelContent) => void;
  onZoomToBattle: (battleId: string) => void;
  onViewMonument: (monument: NonNullable<PanelContent['monument3d']>) => void;
  /** The Richat's "Plato's Atlantis, imagined" switch. */
  atlantis?: { on: boolean; onToggle: (monument: NonNullable<PanelContent['monument3d']>) => void };
  /** The battle map, when this panel's battle is the one on the field.
   * Rendered inline here by default; `onPopOutMap` floats it instead. */
  battleMap?: ReactNode;
  onPopOutMap?: () => void;
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
/** A merged record's lead picture, fetched from Wikipedia when it has an article. */
function RecordThumb({ title }: { title?: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    if (!title) return;
    let live = true;
    fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (live) setSrc(j?.thumbnail?.source ?? null); })
      .catch(() => { /* no picture is fine */ });
    return () => { live = false; };
  }, [title]);
  return src ? <img className="record-thumb" src={src} alt={title ?? ''} loading="lazy" /> : null;
}

/** The REAL picture for a site with no honest 3D model (a map, say): the
 * Wikipedia article's lead image, hosted on Wikimedia Commons, with a plain
 * caption, its licence, and a link to the file page. */
function RealImagePanel({ image }: { image: NonNullable<PanelContent['realImage']> }) {
  const [src, setSrc] = useState<{ thumb: string; file?: string } | null>(null);
  useEffect(() => {
    let live = true;
    setSrc(null);
    fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(image.wikiTitle.replace(/ /g, '_'))}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        const thumb: string | undefined = j?.thumbnail?.source;
        if (!live || !thumb) return;
        // …/commons/thumb/a/ab/File_name.jpg/320px-File_name.jpg → File_name.jpg
        const m = /\/commons\/(?:thumb\/)?[0-9a-f]\/[0-9a-f]{2}\/([^/]+)/.exec(thumb);
        setSrc({ thumb, file: m ? decodeURIComponent(m[1]) : undefined });
      })
      .catch(() => { /* no picture — the caption and link still stand */ });
    return () => { live = false; };
  }, [image.wikiTitle]);
  return (
    <figure className="info-real-image">
      {src && <img className="info-thumb" src={src.thumb} alt={image.caption} loading="lazy" />}
      <figcaption className="info-note">
        {image.caption} {image.licence}.{' '}
        {src?.file ? (
          <a href={`https://commons.wikimedia.org/wiki/File:${encodeURIComponent(src.file)}`} target="_blank" rel="noreferrer">
            Image on Wikimedia Commons
          </a>
        ) : (
          <a href={`https://en.wikipedia.org/wiki/${encodeURIComponent(image.wikiTitle.replace(/ /g, '_'))}`} target="_blank" rel="noreferrer">
            See it on Wikipedia
          </a>
        )}
      </figcaption>
    </figure>
  );
}

/** "One pin for all duplicates": every record merged into this pin, each with
 * its own dates, source, picture and a button to fly to its exact spot. */
function MergedRecords({ records, onZoom }: { records: MergedRecord[]; onZoom: (r: MergedRecord) => void }) {
  return (
    <div className="merged-records">
      <h3 className="info-h3">Also recorded here ({records.length})</h3>
      <p className="info-note">These entries named the same place within 30 km and are shown as this one pin.</p>
      <ul className="related-list">
        {records.map((r) => (
          <li key={r.id} className="record-row">
            <RecordThumb title={r.wikiTitle} />
            <span className="record-text">
              <span className="related-label">{r.name}</span>
              <span className="related-sub">
                {r.endYear !== undefined ? `${yearLabel(r.startYear)} – ${yearLabel(r.endYear)}` : yearLabel(r.startYear)} · {r.source}
              </span>
            </span>
            <button className="btn record-zoom" onClick={() => onZoom(r)} aria-label={`Zoom to ${r.name} (${r.source})`}>
              Zoom to
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function InfoPanel({ content: rawContent, tone, onClose, onFly, onZoomToBattle, onViewMonument, atlantis, battleMap, onPopOutMap }: InfoPanelProps) {
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
    // Rebuild even when THIS call fetched nothing new: another consumer may
    // have hydrated the shared event a moment earlier (search does), after
    // the panel content was built — which is how a pin's merged records went
    // missing from its panel (11 Oct 2026).
    void hydrateEvent(ev).then(() => {
      if (!cancelled) setUpgraded({ source: rawContent, content: eventToPanel(ev) });
    });
    return () => {
      cancelled = true;
    };
  }, [rawContent]);
  const built = upgraded && upgraded.source === rawContent ? upgraded.content : rawContent;
  // THE LAST STOP BEFORE THE SCREEN. Every panel in the app is built exactly as
  // it always was and retold here in the reader's chosen register — one set of
  // facts, three voices. Explorer is the identity transform, so the default
  // reader pays nothing for this. See lib/tone.ts for the iron rule: a tone
  // changes how something is said, never what is said.
  const content = built ? applyTone(built, tone) : built;

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
            {content.monument3d && /giza/i.test(content.monument3d.title) && content.monument3d.model !== 'sphinx' && (
              <p className="model-credit" style={{ fontSize: '0.75em', opacity: 0.8, margin: '4px 0' }}>
                3D pyramids: a reconstruction from the best evidence — published sizes (Lehner 1997,
                Verner 2007), OpenStreetMap footprints and reign dates. The white casing, the courses
                rising and the stripped ruins follow that evidence; how the stone was raised is
                debated, so no ramps are shown.
              </p>
            )}
            {content.monument3d?.model === 'rings' && atlantis && (
              <div className={`atlantis-vision${atlantis.on ? ' on' : ''}`}>
                <button
                  className="btn atlantis-toggle"
                  aria-pressed={atlantis.on}
                  onClick={() => atlantis.onToggle(content.monument3d!)}
                >
                  {atlantis.on ? '✕ Back to the real Richat' : "🏛 Plato's Atlantis, imagined"}
                </button>
                <p className="atlantis-label">
                  <strong>A representation, not evidence.</strong> Imagined with AI logic and the best evidence we have,
                  following Plato's own description (<em>Timaeus</em> 24e–25d, <em>Critias</em> 113c–117e): rings of land
                  and water, red, white and black stone, metal-clad walls, bridges, harbours, Poseidon's temple and a
                  50-stadia canal to the sea. Geologists agree the Richat is a natural eroded dome, and no trace of a
                  city has ever been found here.
                  {atlantis.on && (
                    <>
                      {' '}The sea is raised +200 m with the real elevation data, which brings the Atlantic from about
                      530 km away to about 195 km. The harbour sea around the city is imagined too.{' '}
                      <strong>The estuary linking Plato's canal to the raised Atlantic is our own invention, not in Plato;
                      the real coast would be about 195 km away even at +200 m.</strong>
                    </>
                  )}
                </p>
              </div>
            )}
            {westminsterNote(content.monument3d) && (
              <p className="model-credit westminster-note" style={{ fontSize: '0.75em', opacity: 0.85, margin: '4px 0' }}>
                {westminsterNote(content.monument3d)}
              </p>
            )}
            {buckinghamNote(content.monument3d) && (
              <p className="model-credit buckingham-note" style={{ fontSize: '0.75em', opacity: 0.85, margin: '4px 0' }}>
                {buckinghamNote(content.monument3d)}
              </p>
            )}
            {stonehengeNote(content.monument3d) && (
              <p className="model-credit stonehenge-note" style={{ fontSize: '0.75em', opacity: 0.85, margin: '4px 0' }}>
                {stonehengeNote(content.monument3d)}
              </p>
            )}
            {landmarkNote(content.monument3d) && (
              <p className="model-credit landmark-note" style={{ fontSize: '0.75em', opacity: 0.85, margin: '4px 0' }}>
                {landmarkNote(content.monument3d)}
              </p>
            )}
            {gizaCapNote(content.monument3d) && (
              <p className="model-credit giza-cap-note" style={{ fontSize: '0.75em', opacity: 0.85, margin: '4px 0' }}>
                ✨ {gizaCapNote(content.monument3d)}
              </p>
            )}
            {content.monument3d?.model === 'sphinx' && (
              <p className="model-credit" style={{ fontSize: '0.75em', opacity: 0.8, margin: '4px 0' }}>
                3D model:{' '}
                <a href="https://sketchfab.com/3d-models/f169dbe7974648babe327179091e0ee3" target="_blank" rel="noreferrer">
                  'The Great Sphinx of Giza - Egypt'
                </a>{' '}
                by Chenzoss, CC BY 4.0
              </p>
            )}
            {/* Real scans standing on the globe (24 Oct 2026) — keyed by site, since
                the 3D viewer keeps the archetype for these two. */}
            {content.monument3d && /g[öo]bekli/i.test(content.monument3d.title) && (
              <p className="model-credit" style={{ fontSize: '0.75em', opacity: 0.8, margin: '4px 0' }}>
                Globe 3D scan:{' '}
                <a href="https://sketchfab.com/3d-models/gobekli-tepe-5a4d25c355ff48d59ab76c36812b9cf3" target="_blank" rel="noreferrer">'Gobekli Tepe'</a>
                {' '}by rmark, CC BY 4.0 (simplified, re-textured)
              </p>
            )}
            {content.monument3d && /puma\s?punku/i.test(content.monument3d.title) && (
              <p className="model-credit" style={{ fontSize: '0.75em', opacity: 0.8, margin: '4px 0' }}>
                Globe 3D scan:{' '}
                <a href="https://sketchfab.com/3d-models/pumapunku-bolivia-855ef2eb94f94587aa4177502ae2949f" target="_blank" rel="noreferrer">'pumaPunku Bolivia'</a>
                {' '}by NeoTec, CC BY 4.0 (simplified)
              </p>
            )}
            {content.fly && (
              <button className="btn" onClick={() => onFly(content)}>
                ✈ Fly here
              </button>
            )}
          </div>

          {/* THE PLAN, beside the real ground. Lives here by default; the
              pop-out floats it over the globe as a movable window. */}
          {battleMap && (
            <div className="info-battlemap">
              <div className="info-battlemap-head">
                <span>🗺 Battle map</span>
                {onPopOutMap && (
                  <button
                    className="info-battlemap-pop"
                    onClick={onPopOutMap}
                    aria-label="Pop the map out into its own window"
                    title="Pop out into a movable window"
                  >
                    ⧉
                  </button>
                )}
              </div>
              {battleMap}
            </div>
          )}

          {wiki.thumb && (
            <img className="info-thumb" src={wiki.thumb} alt={content.title} loading="lazy" />
          )}
          {content.realImage && <RealImagePanel image={content.realImage} />}

          {content.commanders && content.commanders.length > 0 && (
            <CommanderFaces commanders={content.commanders} sideNames={content.sideNames} size="lg" />
          )}

          {content.summaryChecked && content.summary ? (
            <p className="info-summary">{content.summary}</p>
          ) : wiki.status === 'done' && wiki.extract ? (
            <p className="info-summary">{wiki.extract}</p>
          ) : (
            content.summary && <p className="info-summary">{content.summary}</p>
          )}
          {content.sourceUrl && (
            <p className="info-source">
              Source:{' '}
              <a href={content.sourceUrl} target="_blank" rel="noopener noreferrer">
                {sourceLabel(content.sourceUrl)}
              </a>
            </p>
          )}
          {content.wikiTitle && !content.summaryChecked && wiki.status === 'loading' && (
            <p className="info-loading">Loading the full summary…</p>
          )}
          {content.wikiTitle && !content.summaryChecked && wiki.status === 'error' && (
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

          {content.records && content.records.length > 0 && (
            <MergedRecords
              records={content.records}
              onZoom={(r) => onFly({ ...content, fly: { lon: r.lon, lat: r.lat, altitude: 2_500 } })}
            />
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

          {/* The maker's reins over the globe: review any monument or battle
              right here — appears only when the Captain's key is present.
              LAST in the panel: it's a workbench control, not something a
              reader wants between the battle and its history. */}
          {(content.monument3d || content.battleId) && (
            <MakerRow
              // Key per site so the reins RESET when you move to another
              // monument — their state must not follow the old model.
              key={content.battleId ? `battle:${content.battleId}` : `${content.monument3d!.model}@${content.monument3d!.lat},${content.monument3d!.lon}`}
              reviewKey={content.battleId ? `battle:${content.battleId}` : content.monument3d!.model}
              place={
                content.monument3d
                  ? { model: content.monument3d.model, lat: content.monument3d.lat, lon: content.monument3d.lon }
                  : undefined
              }
            />
          )}
        </div>
      )}
    </aside>
  );
}
