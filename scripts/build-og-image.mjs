/**
 * build-og-image.mjs — bake the 1200×630 social share card.
 * -----------------------------------------------------------
 * The card is a REAL orthographic globe drawn from the same Natural Earth II
 * imagery the app's base layer uses (Cesium's bundled TMS tiles), composited
 * with the title, tagline and the app's signature era-gradient timeline bar.
 *
 * Deliberately a 2D-canvas render, NOT a headless-WebGL screenshot of the live
 * Cesium globe: a hidden/headless tab throttles Cesium's render loop (see the
 * item-9 note in docs/roadmap-queue.md), so a WebGL capture is fragile. A 2D
 * canvas is bulletproof headless and pixel-exact.
 *
 * ZERO running cost: the output `public/og-image.jpg` is a committed static
 * asset served by GitHub Pages. This script only REGENERATES it; it is NOT in
 * the CI build (a puppeteer step must never be able to break a deploy).
 *
 *   1. start the dev server (npm run dev) so Cesium's tiles are served
 *      same-origin at /cesium/... (an untainted canvas needs same-origin)
 *   2. node scripts/build-og-image.mjs   [--port 5173]
 *
 * The card was first produced by running the identical drawing code in a real
 * browser tab on the dev origin (2026-07-29); this script reproduces it.
 */
import { writeFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import puppeteer from 'puppeteer';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC = join(__dirname, '..', 'public');
const portArg = process.argv.indexOf('--port');
const PORT = portArg > -1 ? process.argv[portArg + 1] : '5173';
const ORIGIN = `http://localhost:${PORT}`;

// The drawing runs in the PAGE (same origin as the tiles). Sets window.__ogDone.
const DRAW = /* js */ `
async function drawOG(){
  // The card wears the ship's own face. Canvas silently falls back to a default
  // serif if the face has not loaded, so load it EXPLICITLY through the
  // FontFace API rather than declaring @font-face and awaiting
  // document.fonts.ready — on this bare builder page that never settles
  // (measured: it hangs indefinitely, while FontFace.load resolves at once).
  const face = new FontFace('EB Garamond', "url('/fonts/ebgaramond-var.woff2')");
  await face.load();
  document.fonts.add(face);
  if (!document.fonts.check('600 70px "EB Garamond"')) {
    throw new Error('EB Garamond did not load — the card would render in a fallback serif');
  }
  const W=2048,H=1024,TS=256,NX=8,NY=4;
  const loadImg=(s)=>new Promise((res,rej)=>{const im=new Image();im.crossOrigin='anonymous';im.onload=()=>res(im);im.onerror=()=>rej(new Error(s));im.src=s;});
  const eq=document.createElement('canvas');eq.width=W;eq.height=H;const ec=eq.getContext('2d');
  const jobs=[];
  for(let x=0;x<NX;x++)for(let y=0;y<NY;y++)jobs.push(loadImg('/cesium/Assets/Textures/NaturalEarthII/2/'+x+'/'+y+'.jpg').then(im=>ec.drawImage(im,x*TS,(NY-1-y)*TS,TS,TS)));
  await Promise.all(jobs);
  const eqd=ec.getImageData(0,0,W,H).data;
  const cw=1200,ch=630;const cv=document.getElementById('og');cv.width=cw;cv.height=ch;const g=cv.getContext('2d');
  let bg=g.createRadialGradient(900,315,60,900,315,900);bg.addColorStop(0,'#111a15');bg.addColorStop(1,'#070b09');g.fillStyle=bg;g.fillRect(0,0,cw,ch);
  g.save();for(let i=0;i<340;i++){const sx=(i*73.13)%cw,sy=(i*181.7)%ch;const a=0.15+((i*97)%100)/100*0.6;const r=((i*53)%100)/100<0.12?1.4:0.7;g.globalAlpha=a;g.fillStyle='#dfeaff';g.beginPath();g.arc(sx,sy,r,0,7);g.fill();}g.restore();
  const cx=905,cy=315,R=292,lon0=15*Math.PI/180,lat0=20*Math.PI/180,sinL0=Math.sin(lat0),cosL0=Math.cos(lat0);
  const Lx=-0.42,Ly=0.55,Lz=0.72,Ln=Math.hypot(Lx,Ly,Lz);
  const img=g.getImageData(0,0,cw,ch);const d=img.data;
  for(let py=cy-R;py<=cy+R;py++)for(let px=cx-R;px<=cx+R;px++){
    const X=(px-cx)/R,Y=(cy-py)/R,rho=Math.hypot(X,Y);if(rho>1)continue;
    const cc=Math.asin(rho),sinc=Math.sin(cc),cosc=Math.cos(cc);let lat,lon;
    if(rho<1e-6){lat=lat0;lon=lon0;}else{lat=Math.asin(cosc*sinL0+Y*sinc*cosL0/rho);lon=lon0+Math.atan2(X*sinc,rho*cosL0*cosc-Y*sinL0*sinc);}
    let u=((lon*180/Math.PI)+180)/360;u=u-Math.floor(u);const v=(90-lat*180/Math.PI)/180;
    const sx=Math.min(W-1,Math.max(0,(u*W)|0)),sy=Math.min(H-1,Math.max(0,(v*H)|0)),si=(sy*W+sx)*4;
    const nz=Math.sqrt(Math.max(0,1-rho*rho));let sh=(X*Lx+Y*Ly+nz*Lz)/Ln;sh=Math.max(0.18,Math.min(1,0.5+sh*0.6));
    const di=(py*cw+px)*4;d[di]=Math.min(255,eqd[si]*sh);d[di+1]=Math.min(255,eqd[si+1]*sh);d[di+2]=Math.min(255,eqd[si+2]*sh+(1-nz)*22);d[di+3]=255;
  }
  g.putImageData(img,0,0);
  g.save();g.globalCompositeOperation='lighter';let rim=g.createRadialGradient(cx,cy,R*0.92,cx,cy,R*1.06);rim.addColorStop(0,'rgba(90,150,220,0)');rim.addColorStop(0.6,'rgba(96,160,230,0.30)');rim.addColorStop(1,'rgba(96,160,230,0)');g.fillStyle=rim;g.beginPath();g.arc(cx,cy,R*1.06,0,7);g.fill();g.restore();
  g.textBaseline='alphabetic';
  g.fillStyle='#c9a24b';g.font='600 15px "EB Garamond", Georgia, serif';g.letterSpacing='3px';g.fillText('FREE · NO ADS · NO ACCOUNTS · OPEN DATA',70,205);g.letterSpacing='0px';
  g.fillStyle='#e8e2d0';g.font='600 70px "EB Garamond", Georgia, serif';g.fillText('Chronos Earth',68,285);
  g.fillStyle='#a8a08a';g.font='400 28px "EB Garamond", Georgia, serif';g.fillText('250 million years of history,',70,340);g.fillText('on one living globe.',70,378);
  const bx=70,by=430,bw=470,bh=13;let tl=g.createLinearGradient(bx,0,bx+bw,0);[[0,'#2b4a7a'],[0.35,'#2f7d6a'],[0.6,'#5f8a3a'],[0.8,'#b7842f'],[1,'#a83a3a']].forEach(([s,c])=>tl.addColorStop(s,c));g.fillStyle=tl;g.beginPath();g.roundRect(bx,by,bw,bh,7);g.fill();
  g.fillStyle='#a8a08a';g.font='400 15px "EB Garamond", Georgia, serif';g.fillText('Deep time',bx,by+34);g.textAlign='right';g.fillText('Today',bx+bw,by+34);g.textAlign='left';
  window.__ogDone=true;
}
drawOG().catch(e=>{window.__ogError=String(e);});
`;

// The face is loaded in JS (see drawOG) rather than declared here — see the
// note there about document.fonts.ready never settling on a bare page.
const HTML = `<!doctype html><meta charset=utf-8><style>
html,body{margin:0}#og{display:block}
</style><canvas id="og" width="1200" height="630"></canvas><script>${DRAW}<\/script>`;

const tmpName = '_og-builder.html';
await writeFile(join(PUBLIC, tmpName), HTML);
const browser = await puppeteer.launch({ headless: 'new' });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 });
  const resp = await page.goto(`${ORIGIN}/${tmpName}`, { waitUntil: 'domcontentloaded' });
  if (!resp || !resp.ok()) throw new Error(`dev server not reachable at ${ORIGIN} (start "npm run dev")`);
  await page.waitForFunction('window.__ogDone===true || window.__ogError', { timeout: 20000 });
  const err = await page.evaluate('window.__ogError||null');
  if (err) throw new Error(`draw failed: ${err}`);
  const canvas = await page.$('#og');
  await canvas.screenshot({ path: join(PUBLIC, 'og-image.jpg'), type: 'jpeg', quality: 90 });
  console.log('wrote public/og-image.jpg (1200×630)');
} finally {
  await browser.close();
  await rm(join(PUBLIC, tmpName), { force: true });
}
