import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { DISPUTED_NOTES, eventToPanel, monumentModelForName, placeDossierPanel, resolveMonumentModel } from './panel';
import type { AncientSite, TimelineEvent } from './types';

describe('monumentModelForName — honest 3D or nothing', () => {
  it('churches get the cathedral model', () => {
    expect(monumentModelForName('Cologne Cathedral')).toBe('cathedral');
    expect(monumentModelForName('Notre-Dame de Paris')).toBe('cathedral');
    expect(monumentModelForName('Canterbury Cathedral')).toBe('cathedral');
    expect(monumentModelForName('Westminster Abbey')).toBe('cathedral');
    expect(monumentModelForName('Southwell Minster')).toBe('cathedral');
  });

  it('things we cannot honestly represent get NO model (no 3D button)', () => {
    expect(monumentModelForName('Dr. Hari Singh Gour University')).toBeNull();
    expect(monumentModelForName('Bhimbetka rock art')).toBeNull();
    expect(monumentModelForName('Eiffel Tower restaurant')).toBeNull();
    expect(monumentModelForName('Royal Opera House')).toBeNull();
  });

  it('classic mappings still hold', () => {
    expect(monumentModelForName('Great Pyramid of Giza')).toBe('pyramid');
    expect(monumentModelForName('Chichén Itzá')).toBe('stepped-pyramid');
    expect(monumentModelForName('Teotihuacan')).toBe('stepped-pyramid');
    expect(monumentModelForName('Avebury henge')).toBe('circle');
    expect(monumentModelForName('Great Sphinx of Giza')).toBe('sphinx');
  });

  it('Machu Picchu wears its surveyed citadel — only the citadel does', () => {
    expect(monumentModelForName('Machu Picchu')).toBe('machu-picchu');
    expect(monumentModelForName('Citadel of Machu Picchu')).toBe('machu-picchu');
    // The wider sanctuary's pin sits 6.7 km away; the citadel there would be wrong.
    expect(monumentModelForName('Historic Sanctuary of Machu Picchu')).toBeNull();
  });

  it('castles, forts and palaces get their own castle model (not a settlement box)', () => {
    // Examples chosen to sit OUTSIDE the suppression list (NO_3D_NAMES), which
    // runs first — these exercise the keyword rule itself, one per sub-pattern.
    expect(monumentModelForName('Edinburgh Castle')).toBe('castle');
    expect(monumentModelForName('Nottingham Castle')).toBe('castle');
    expect(monumentModelForName('Bodiam Castle')).toBe('castle');
    expect(monumentModelForName('Fort Ticonderoga')).toBe('castle');
    expect(monumentModelForName('Citadel of Aleppo')).toBe('castle');
    expect(monumentModelForName('Buckingham Palace')).toBe('buckingham'); // its own facade now
    expect(monumentModelForName('Château de Chenonceau')).toBe('castle');
    expect(monumentModelForName('Moscow Kremlin')).toBe('castle');
    expect(monumentModelForName('Warwick Castle')).toBe('castle');
  });

  it('London landmarks get their own models, not the generic castle/palace', () => {
    expect(monumentModelForName('London Eye')).toBe('london-eye');
    expect(monumentModelForName('Buckingham Palace')).toBe('buckingham');
    expect(monumentModelForName('Palace of Westminster')).toBe('westminster');
    expect(monumentModelForName('Big Ben')).toBe('westminster');
    expect(monumentModelForName('Houses of Parliament')).toBe('westminster');
    // …but Westminster Abbey is a church, not Parliament.
    expect(monumentModelForName('Westminster Abbey')).toBe('cathedral');
  });

  it('false friends: bridges and parks are NOT dragged into the castle model', () => {
    // "Forth" contains the letters of "fort"; "Fortress" starts with "fort".
    // Word boundaries keep both out of the castle bucket.
    expect(monumentModelForName('Forth Bridge')).toBeNull();
    expect(monumentModelForName('Brimstone Hill Fortress National Park')).toBeNull();
    expect(monumentModelForName('Golden Gate Bridge')).toBeNull();
  });

  it('South/SE-Asian temples get a spired temple, not a generic stone pile', () => {
    expect(monumentModelForName('Prambanan Temple')).toBe('temple-tower');
    expect(monumentModelForName('Preah Vihear Temple')).toBe('temple-tower');
    expect(monumentModelForName('Khajuraho Temples')).toBe('temple-tower');
    // A plain "Temple of X" gets NO 3D now (photo beats random standing stones);
    // temple-mountains still map by their own keyword.
    expect(monumentModelForName('Temple of Heaven')).toBeNull();
    expect(monumentModelForName('Templo Mayor')).toBe('stepped-pyramid');
  });

  it('the Greeks get a real temple (apology accepted, Athens)', () => {
    expect(monumentModelForName('Parthenon')).toBe('greek-temple');
    expect(monumentModelForName('Acropolis of Athens')).toBe('greek-temple');
    expect(monumentModelForName('Temple of Artemis')).toBe('greek-temple');
    expect(monumentModelForName('Temple of Heaven')).toBeNull(); // no generic temple bucket now
    expect(monumentModelForName('Monte Albán')).toBe('stepped-pyramid'); // temple-mountain, by design
  });

  it('the new archetypes: aqueduct, pagoda, lighthouse', () => {
    expect(monumentModelForName('Pont du Gard')).toBe('aqueduct');
    expect(monumentModelForName('Aqueduct of Segovia')).toBe('aqueduct');
    expect(monumentModelForName('Yellow Crane Pagoda')).toBe('pagoda');
    expect(monumentModelForName('Pharos of Alexandria')).toBe('lighthouse');
    expect(monumentModelForName('Eddystone Lighthouse')).toBe('lighthouse');
  });

  it('matching is case-insensitive', () => {
    expect(monumentModelForName('SAGRADA FAMILIA BASILICA')).toBe('cathedral');
    expect(monumentModelForName('great pyramid')).toBe('pyramid');
  });
});

describe('the Seven Wonders of the Ancient World each carry their own archetype', () => {
  const sites = JSON.parse(
    readFileSync(join(process.cwd(), 'public/data/ancient-sites.json'), 'utf8'),
  ).sites as AncientSite[];
  const byId = Object.fromEntries(sites.map((s) => [s.id, s]));

  const EXPECTED: Record<string, string> = {
    'giza-pyramids': 'giza',
    'hanging-gardens-babylon': 'hanging-gardens',
    'temple-of-artemis': 'artemis-temple',
    'statue-of-zeus': 'zeus-statue',
    'mausoleum-halicarnassus': 'mausoleum',
    'colossus-of-rhodes': 'colossus',
    'lighthouse-of-alexandria': 'pharos',
  };

  it('all seven are present and resolve to their handcrafted model', () => {
    for (const [id, model] of Object.entries(EXPECTED)) {
      expect(byId[id], `missing wonder ${id}`).toBeTruthy();
      expect(resolveMonumentModel(byId[id]), id).toBe(model);
    }
  });
});

describe('eventToPanel — a marker must not claim precision the history lacks', () => {
  // Read the real shipped data, so this breaks if the curation is ever lost.
  const events: TimelineEvent[] = JSON.parse(
    readFileSync(join(process.cwd(), 'public/data/imported/events.json'), 'utf-8'),
  ).events;
  const byId = (id: string) => {
    const e = events.find((x) => x.id === id);
    if (!e) throw new Error(`missing curated event: ${id}`);
    return e;
  };

  it('says WHY the Black Death is pinned in Sicily', () => {
    const p = eventToPanel(byId('cur-dis-black-death'));
    const s = p.sections?.find((x) => x.heading === 'Why it is shown here');
    expect(s, 'placeNote section').toBeTruthy();
    expect(s!.body).toMatch(/Messina/);
    // The crucial half: it must admit the pandemic had no single location.
    expect(s!.body).toMatch(/no single location/i);
  });

  it('admits the 1918 flu’s origin is disputed', () => {
    const p = eventToPanel(byId('cur-dis-spanish-flu'));
    const s = p.sections?.find((x) => x.heading === 'Why it is shown here');
    expect(s!.body).toMatch(/disputed/i);
  });

  it('explains an uncertain date without calling the subject legendary', () => {
    // Chicxulub is dated by an iridium layer, not a chronicle — so it gets a
    // date note but no attestation, and must not be filed under "legend".
    const chicxulub = byId('cur-dis-chicxulub');
    expect(chicxulub.attestation).toBeUndefined();
    const p = eventToPanel(chicxulub);
    expect(p.kicker).not.toBe('Legend');
    expect(p.sections?.find((x) => x.heading === 'About the date')?.body).toMatch(/iridium/i);
  });

  it('leaves an ordinary event with no notes at all', () => {
    const plain = events.find((e) => !e.placeNote && !e.dateNote && !e.attestation)!;
    const p = eventToPanel(plain);
    const headings = (p.sections ?? []).map((s) => s.heading);
    expect(headings).not.toContain('Why it is shown here');
    expect(headings).not.toContain('About the date');
  });
});

describe('a disputed territory says what the dispute is', () => {
  const names = new Set(
    (JSON.parse(readFileSync(join(process.cwd(), 'public', 'data', 'borders', 'countries.json'), 'utf8')) as { name: string[] }).name,
  );

  it('every territory named "(disputed)" on the map has a note', () => {
    for (const n of names) if (n.includes('(disputed)')) expect(DISPUTED_NOTES[n], `${n} has no note`).toBeTruthy();
  });

  it('the note appears in the dossier', () => {
    const p = placeDossierPanel(42.6, 21.1, 2026, 'Kosovo (disputed)', [], () => {});
    expect(p.sections?.[0].heading).toBe('Disputed territory');
    expect(placeDossierPanel(48.8, 2.3, 2026, 'France', [], () => {}).sections).toBeUndefined();
  });
});

it('keeps "(disputed)" out of the middle of a sentence', () => {
  const p = placeDossierPanel(42.6, 21.1, 2026, 'Kosovo (disputed)', [], () => {});
  expect(p.title).toBe('Kosovo (disputed)');
  expect(p.summary).not.toContain('(disputed)');
});

it('a dispute note appears only once the dispute exists', () => {
  // Taiwan is on the map from 1500; "governed by the ROC since 1949" is not true then.
  expect(placeDossierPanel(23.7, 121, 1600, 'Taiwan', [], () => {}).sections).toBeUndefined();
  expect(placeDossierPanel(23.7, 121, 2026, 'Taiwan', [], () => {}).sections?.[0].heading).toBe('Disputed territory');
  expect(placeDossierPanel(24.2, -13, 2026, 'Western Sahara', [], () => {}).sections).toBeDefined();
});

it('a capital lists what it is capital of NOW first', () => {
  const paris = {
    id: 'q90', name: 'Paris', category: 'city', startYear: -300, lat: 48.86, lon: 2.35,
    capitalOf: [
      { of: 'French Fourth Republic', from: 1946, to: 1958 },
      { of: 'Kingdom of France', from: 987, to: 1791 },
      { of: 'France', from: 481, to: null },
    ],
  } as unknown as TimelineEvent;
  const sec = eventToPanel(paris).sections?.find((s) => s.heading === 'Capital of');
  expect(sec?.bullets?.[0]).toMatch(/^France · from/);
  expect(sec?.bullets?.[1]).toMatch(/^French Fourth Republic/);
});
