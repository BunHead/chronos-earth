/**
 * quiz-sheet.mjs — build a single contact-sheet image + a ready prompt from the
 * 8 Sphinx quiz renders, so the whole quiz is ONE paste into any AI.
 *
 *   node scripts/quiz-sheet.mjs
 * writes quiz/sheet.png (drag this in) and quiz/PROMPT.txt (paste this).
 */
import { readFile, writeFile } from 'node:fs/promises';
import puppeteer from 'puppeteer';

const cells = [];
for (let i = 1; i <= 8; i++) {
  const b = await readFile(`quiz/q${i}.png`);
  cells.push(`<div class="cell"><div class="lbl">q${i}</div><img src="data:image/png;base64,${b.toString('base64')}"></div>`);
}

const QUESTION =
  'These are 8 top-down renders (q1–q8) of the SAME Sphinx, each turned flat by a different amount. ' +
  'The Sphinx’s head/paws are its FRONT. On the little ground compass: the RED arrow points North, ' +
  'the GREEN bar points East — IMPORTANT: look at where the green bar actually points, do not assume east is on the right. ' +
  'For EACH panel, tell me the compass bearing the Sphinx is FACING (0°=N, 90°=E, 180°=S, 270°=W). ' +
  'Reply with exactly one line per panel, in this format:\nq1: <degrees>\nq2: <degrees>\n… through q8.';

const html = `<!doctype html><html><body style="margin:0;background:#fff;font-family:system-ui,sans-serif">
  <div style="padding:14px 18px;font-size:17px;line-height:1.4;font-weight:600;color:#111;white-space:pre-wrap">${QUESTION}</div>
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;padding:6px">${cells.join('')}</div>
  <style>.cell{border:2px solid #222;position:relative}.cell img{width:100%;display:block}
  .lbl{position:absolute;top:0;left:0;background:#222;color:#fff;font-weight:800;font-size:18px;padding:2px 9px}</style>
</body></html>`;

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1720, height: 1000, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: 'networkidle0' });
  const body = await page.$('body');
  await body.screenshot({ path: 'quiz/sheet.png' });
  console.log('wrote quiz/sheet.png');
} finally {
  await browser.close();
}

await writeFile('quiz/PROMPT.txt', QUESTION + '\n');
console.log('wrote quiz/PROMPT.txt');
