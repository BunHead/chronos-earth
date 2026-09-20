/**
 * resolve-data-conflicts.mjs — let the nightly harvest land even when the
 * branch moved under it.
 *
 * THE PROBLEM. The harvest runs for over an hour. Its commit step ends with
 * `git pull --rebase origin main`, and if anybody pushed to `public/data`
 * while it was working, that rebase stops on a conflict, the step fails, and
 * the WHOLE NIGHT'S CATCH is thrown away. It happened on 18 Sept 2026, and it
 * will happen again every time a session commits data during the small hours.
 *
 * THE INSIGHT that makes this safe. `public/data/imported/events.json` is an
 * ADDITIVE UNION — every writer only ever adds rows, keyed by `id`. Two people
 * adding different events is not a real conflict at all; it only looks like one
 * because git compares text and the file is one enormous line of JSON. The
 * correct resolution is simply "keep both", and it cannot lose data.
 *
 * Everything else under `public/data` (core-index.json, core-index/*, detail/*)
 * is DERIVED from that file. There is no sense in merging derived output: take
 * either side, then rebuild it from the merged source. The workflow does
 * exactly that — `build-core-index.mjs` runs again straight after this script.
 *
 * WHICH SIDE IS WHICH. In a REBASE the stages are the opposite way round from a
 * merge, which is a classic way to get this backwards: `:2` ("ours") is the
 * upstream commit being replayed onto, and `:3` ("theirs") is our own harvest
 * patch. For the union it makes no difference — we take both — and that is
 * another reason to prefer a union over picking a side.
 *
 * Run from the repo root, mid-rebase:
 *     node scripts/resolve-data-conflicts.mjs
 * It writes the merged files into the working tree; the caller then does
 * `git add public/data && git rebase --continue`.
 */
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const SOURCE_OF_TRUTH = 'public/data/imported/events.json';

const git = (args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });

/** The file's content at one merge stage, or null if that stage is absent
 * (which happens when one side added or deleted the file outright). */
function stage(n, path) {
  try {
    return git(['show', `:${n}:${path}`]);
  } catch {
    return null;
  }
}

function conflicted() {
  return git(['diff', '--name-only', '--diff-filter=U'])
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Union two events.json blobs by row id. Later wins on a genuine clash, which
 * only matters if two writers edited the SAME row — vanishingly rare, and the
 * alternative (dropping one) is strictly worse. */
function unionEvents(a, b) {
  const rows = new Map();
  let kept = 0;
  for (const blob of [a, b]) {
    if (!blob) continue;
    const parsed = JSON.parse(blob).events ?? [];
    for (const row of parsed) {
      if (!rows.has(row.id)) kept++;
      rows.set(row.id, row);
    }
  }
  const events = [...rows.values()].sort((x, y) => x.startYear - y.startYear);
  return { json: JSON.stringify({ events }), count: events.length, kept };
}

function main() {
  const files = conflicted();
  if (files.length === 0) {
    console.log('No conflicted files — nothing to resolve.');
    return;
  }
  console.log(`${files.length} conflicted file(s).`);

  const strays = files.filter((f) => !f.startsWith('public/data/'));
  if (strays.length > 0) {
    // Refuse loudly. This script understands ONE kind of conflict; a clash in
    // source code or a workflow needs a human, and silently "resolving" it
    // would be far worse than losing a night's harvest.
    console.error('Conflicts outside public/data — this needs a human:');
    for (const f of strays) console.error(`  ${f}`);
    process.exit(1);
  }

  for (const file of files) {
    if (file === SOURCE_OF_TRUTH) {
      const ours = stage(2, file);
      const theirs = stage(3, file);
      const before = ours ? (JSON.parse(ours).events ?? []).length : 0;
      const mine = theirs ? (JSON.parse(theirs).events ?? []).length : 0;
      const { json, count } = unionEvents(ours, theirs);
      writeFileSync(file, json);
      console.log(`  ${file}: union of ${before} (upstream) + ${mine} (harvest) -> ${count}`);
    } else {
      // Derived. Take a side to clear the conflict; the rebuild that follows
      // replaces it wholesale from the merged source of truth.
      const pick = stage(2, file) ?? stage(3, file);
      if (pick === null) {
        console.log(`  ${file}: deleted on both sides — leaving removed`);
        continue;
      }
      writeFileSync(file, pick);
      console.log(`  ${file}: derived, taking one side (rebuilt next step)`);
    }
  }
  console.log('Resolved. Caller must `git add public/data` and rebuild the index.');
}

main();
