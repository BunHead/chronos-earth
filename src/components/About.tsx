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
  return (
    <div className="bv-overlay" role="dialog" aria-label="About Chronos Earth" onClick={onClose}>
      <div className="about-window" onClick={(e) => e.stopPropagation()}>
        <header className="bv-header">
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
          </ul>

          <h3 className="info-h3">Built with</h3>
          <ul className="facts">
            <li>CesiumJS (3D globe) · Three.js (3D battle scenes)</li>
            <li>React · TypeScript · Vite</li>
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
        </div>
      </div>
    </div>
  );
}
