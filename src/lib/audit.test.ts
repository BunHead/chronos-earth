import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
// The auditor's shared classifier…
import {
  monumentModelForName as auditName,
  resolveMonumentModel as auditSite,
} from '../../scripts/monument-archetype.mjs';
// …must agree with the app's real logic on every real name, forever.
import { monumentModelForName, resolveMonumentModel } from './panel';

const read = (rel: string) => JSON.parse(readFileSync(join(process.cwd(), rel), 'utf8'));

describe('audit classifier stays in lock-step with the app (panel.ts)', () => {
  const sites = read('public/data/ancient-sites.json').sites as Array<Record<string, unknown>>;
  const monumentNames = (read('public/data/imported/events.json').events as Array<Record<string, unknown>>)
    .filter((e) => e.category === 'monument')
    .map((e) => e.name as string);

  it('agrees on every imported monument name', () => {
    for (const name of monumentNames) {
      expect(auditName(name), `mismatch on "${name}"`).toBe(monumentModelForName(name));
    }
  });

  it('agrees on every curated ancient site', () => {
    for (const s of sites) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(auditSite(s as any), `mismatch on "${s.id}"`).toBe(resolveMonumentModel(s as any));
    }
  });

  it('agrees on tricky false-friend names', () => {
    for (const name of ['Temple University', 'Palace Hotel', 'Fort Worth Museum', 'Church Street Station']) {
      expect(auditName(name)).toBe(monumentModelForName(name));
    }
  });
});
