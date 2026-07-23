import { useEffect, useState } from 'react';
import { startWindowDrag } from '../lib/windowDrag';

interface AboutProps {
  onClose: () => void;
}

/**
 * About
 * -----
 * Credits the open data and tools that power Chronos Earth, and is honest about
 * how the historical content was put together.
 */
export default function About({ onClose }: AboutProps) {
  const [patrons, setPatrons] = useState<string[] | null>(null);
  useEffect(() => {
    let alive = true;
    fetch(`${import.meta.env.BASE_URL}data/supporters.json?b=${Date.now()}`)
      .then((r) => (r.ok ? r.json() : { patrons: [] }))
      .then((d: { patrons?: string[] }) => { if (alive) setPatrons(Array.isArray(d.patrons) ? d.patrons : []); })
      .catch(() => { if (alive) setPatrons([]); });
    return () => { alive = false; };
  }, []);

  return (
    <div className="bv-overlay" role="dialog" aria-label="About Chronos Earth" onClick={onClose}>
      <div className="about-window" onClick={(e) => e.stopPropagation()}>
        <header className="bv-header" onPointerDown={startWindowDrag} title="Drag to move">
          <div>
            <h2>About Chronos Earth</h2>
            <p>An interactive tour through 250 million years of Earth and human history.</p>
          </div>
          <button className="info-close" onClick={onClose} aria-label="Close about">
            ×
          </button>
        </header>

        <div className="about-body">
          <p>
            Chronos Earth lets you scrub through deep geological time and recorded history on a 3D
            globe — watching continents drift, empires rise and fall, and famous battles unfold.
          </p>

          <div className="about-support">
            <p>
              <b>Chronos Earth is free — and always will be.</b> No ads, no accounts, no paywall.
              If you'd like to keep the crew building, you can support the voyage on Patreon — from
              £3 your name joins the ship's manifest below.
            </p>
            <a
              className="support-btn"
              href="https://www.patreon.com/c/ChronosEarth"
              target="_blank"
              rel="noopener noreferrer"
            >
              ❤ Support on Patreon
            </a>
          </div>

          {patrons !== null && (
            <>
              <h3 className="info-h3">The ship's manifest ⚓</h3>
              {patrons.length > 0 ? (
                <>
                  <p className="info-summary">With gratitude to the patrons keeping this voyage free for everyone:</p>
                  <ul className="manifest-roll">
                    {patrons.map((name, i) => (
                      // The first 20 aboard are FOUNDING patrons — they wear the
                      // star forever (order in supporters.json = order joined).
                      <li key={i} title={i < 20 ? 'Founding patron — among the first 20 aboard' : undefined}>
                        {i < 20 ? '⭐ ' : ''}{name}
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="info-summary">
                  The manifest is open, and the first berth is empty — be the first name aboard.
                  Every patron is listed here, and the <b>first 20 wear a founding star ⭐ forever</b>.
                </p>
              )}
            </>
          )}

          <h3 className="info-h3">Data sources</h3>
          <ul className="facts">
            <li>
              <b>Continental drift:</b> plate reconstructions from the{' '}
              <a href="https://gws.gplates.org/" target="_blank" rel="noopener noreferrer">GPlates Web Service</a>{' '}
              (EarthByte, University of Sydney), MERDITH2021 rotation model. Snapshots are bundled with the app.
            </li>
            <li>
              <b>Historical borders:</b> the{' '}
              <a href="https://github.com/aourednik/historical-basemaps" target="_blank" rel="noopener noreferrer">historical-basemaps</a>{' '}
              dataset by André Ourednik (ODbL).
            </li>
            <li>
              <b>Globe imagery:</b> Natural Earth II, bundled with{' '}
              <a href="https://cesium.com/platform/cesiumjs/" target="_blank" rel="noopener noreferrer">CesiumJS</a>{' '}
              (used here with no account or token).
            </li>
            <li>
              <b>Sea level &amp; ocean floor:</b> elevation and bathymetry from{' '}
              <a href="https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/" target="_blank" rel="noopener noreferrer">NASA Blue Marble Next Generation</a>{' '}
              (GEBCO-derived, public domain), fused into a bundled raster — approximate at coastal detail.
            </li>
            <li>
              <b>Ancient sites &amp; battles:</b> a curated dataset written for this project, with links to{' '}
              <a href="https://www.wikipedia.org/" target="_blank" rel="noopener noreferrer">Wikipedia</a>{' '}
              and other sources for each entry.
            </li>
            <li>
              <b>Commander portraits:</b> lead images from each commander's{' '}
              <a href="https://www.wikipedia.org/" target="_blank" rel="noopener noreferrer">Wikipedia</a>{' '}
              article (largely public-domain paintings and photographs — click any portrait to open
              the article and its image licence).
            </li>
            <li>
              <b>Prehistoric life positions:</b> fossil-site locations reconstructed onto the
              drifting continents with the{' '}
              <a href="https://gws.gplates.org/" target="_blank" rel="noopener noreferrer">GPlates Web Service</a>{' '}
              point reconstruction (MERDITH2021).
            </li>
            <li>
              <b>Historical battle maps:</b>{' '}
              <a href="https://commons.wikimedia.org/" target="_blank" rel="noopener noreferrer">Wikimedia Commons</a>{' '}
              (public domain / Creative Commons — each map shows its credit and links to the original
              file).
            </li>
            <li>
              <b>Monument stone &amp; ground textures:</b>{' '}
              <a href="https://polyhaven.com/" target="_blank" rel="noopener noreferrer">Poly Haven</a>{' '}
              (CC0 — large_sandstone_blocks, old_stone_wall, dry_ground_01).
            </li>
          </ul>

          <h3 className="info-h3">Built with</h3>
          <ul className="facts">
            <li>
              <b>Version:</b>{' '}
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                {typeof __BUILD_LABEL__ === 'string' ? __BUILD_LABEL__ : 'dev'}
              </span>{' '}
              — if the deployed site differs, a refresh prompt appears.
            </li>
            <li>CesiumJS (3D globe) · Three.js (3D battle scenes)</li>
            <li>React · TypeScript · Vite</li>
            <li>
              Built by the Captain with Claude — Fable&nbsp;5 and Opus&nbsp;4.8 at the helm in
              turns, July 2026. Zero running cost, one raised eyebrow at a time.
            </li>
          </ul>

          <h3 className="info-h3">A note on accuracy</h3>
          <p className="info-summary">
            Geography comes from real open datasets — we don't invent coastlines or borders. The
            battle and site write-ups were authored for teaching and simplified for clarity; always
            follow the links for deeper, sourced detail. Fringe or contested ideas (such as Graham
            Hancock's "lost Ice Age civilization") are shown only in clearly-labelled
            "alternative hypothesis" boxes alongside the mainstream scholarly consensus — never as
            established fact.
          </p>

          <h3 className="info-h3">Copyright &amp; licence</h3>
          <p className="info-summary">
            <b>© 2026 Spencer Austin.</b> The software behind Chronos Earth — the app, the
            harvesters, the model workshop — is open source under the{' '}
            <a
              href="https://www.apache.org/licenses/LICENSE-2.0"
              target="_blank"
              rel="noopener noreferrer"
            >
              Apache License 2.0
            </a>
            : free to use, change and share, including commercially, provided the licence and
            these credits travel with it. The source lives at{' '}
            <a
              href="https://github.com/BunHead/chronos-earth"
              target="_blank"
              rel="noopener noreferrer"
            >
              github.com/BunHead/chronos-earth
            </a>
            .
          </p>
          <p className="info-summary">
            The historical <b>data</b> listed above is a different matter, and keeps the licence
            its makers gave it — this project cannot and does not relicense it. In particular the
            historical borders dataset is <b>ODbL</b>, which is share-alike: improve that data and
            pass it on, and it must stay open on the same terms. Wikipedia text is CC BY-SA and is
            linked to rather than copied. The full breakdown is in the{' '}
            <a
              href="https://github.com/BunHead/chronos-earth/blob/main/NOTICE"
              target="_blank"
              rel="noopener noreferrer"
            >
              NOTICE file
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
