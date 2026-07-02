import type { BattleCommander } from '../lib/types';
import { initialsOf, portraitUrl, wikiPageUrl } from '../lib/portraits';

interface CommanderFacesProps {
  commanders: BattleCommander[];
  /** Belligerent names shown under each group: [side1, side2]. */
  sideNames?: [string, string];
  /** 'lg' for the info panel, 'sm' for the battle-view header strip. */
  size?: 'lg' | 'sm';
}

/** One clickable commander portrait (photo if we have one, else initials). */
function Face({ commander }: { commander: BattleCommander }) {
  const img = commander.noPortrait ? undefined : portraitUrl(commander.wiki);
  return (
    <a
      className="cmdr"
      href={wikiPageUrl(commander.wiki)}
      target="_blank"
      rel="noopener noreferrer"
      title={`${commander.name} — open Wikipedia`}
    >
      {img ? (
        <img className="cmdr-img" src={img} alt={commander.name} loading="lazy" />
      ) : (
        <span className="cmdr-img cmdr-initials">{initialsOf(commander.name)}</span>
      )}
      <span className="cmdr-name">{commander.name}</span>
    </a>
  );
}

/**
 * CommanderFaces
 * --------------
 * The "who led whom" face-off: side 1's commanders on the left, side 2's on
 * the right, with a VS badge between them. Clicking a face opens Wikipedia.
 */
export default function CommanderFaces({ commanders, sideNames, size = 'lg' }: CommanderFacesProps) {
  const side1 = commanders.filter((c) => c.side === 1);
  const side2 = commanders.filter((c) => c.side === 2);
  if (side1.length === 0 && side2.length === 0) return null;

  return (
    <div className={`cmdr-faceoff ${size}`}>
      <div className="cmdr-side">
        <div className="cmdr-row">
          {side1.map((c) => (
            <Face key={c.wiki + c.name} commander={c} />
          ))}
        </div>
        {sideNames && <div className="cmdr-side-name">{sideNames[0]}</div>}
      </div>
      <div className="cmdr-vs">VS</div>
      <div className="cmdr-side">
        <div className="cmdr-row">
          {side2.map((c) => (
            <Face key={c.wiki + c.name} commander={c} />
          ))}
        </div>
        {sideNames && <div className="cmdr-side-name">{sideNames[1]}</div>}
      </div>
    </div>
  );
}
