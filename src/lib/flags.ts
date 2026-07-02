/**
 * flags.ts — time-aware procedural flag artwork for the border map.
 *
 * Famous powers get their REAL flag painted inside their borders — drawn
 * with canvas geometry (crosses, stripes, discs, stars), no image downloads,
 * so it costs nothing and works offline. Each entry carries optional
 * from/to years so the RIGHT flag flies at the RIGHT time: St George's cross
 * on medieval England, the Union Jack from 1707, the tricolore only after
 * 1789, Imperial black-white-red before Weimar's black-red-gold, Soviet red
 * before the Russian tricolour.
 *
 * Matching mirrors the FLAG_COLORS approach: lowercase substring of the
 * polity name, first hit wins, so more specific names must come first.
 */

type Draw = (ctx: CanvasRenderingContext2D, w: number, h: number) => void;

export interface FlagSpec {
  /** Lowercase substring matched against the polity name. */
  match: string;
  /** Stable cache/id key. */
  key: string;
  /** Inclusive year bounds (undefined = open-ended). */
  from?: number;
  to?: number;
  draw: Draw;
}

/* ---------------- drawing helpers ---------------- */

const fill = (ctx: CanvasRenderingContext2D, color: string, x: number, y: number, w: number, h: number) => {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
};

/** Horizontal bands, top to bottom. */
const hBands = (...colors: string[]): Draw => (ctx, w, h) => {
  const bh = h / colors.length;
  colors.forEach((c, i) => fill(ctx, c, 0, i * bh, w, bh + 1));
};

/** Vertical bands, left to right. */
const vBands = (...colors: string[]): Draw => (ctx, w, h) => {
  const bw = w / colors.length;
  colors.forEach((c, i) => fill(ctx, c, i * bw, 0, bw + 1, h));
};

/** Centred upright cross (St George style). */
const centredCross = (bg: string, cross: string, thickness = 0.2): Draw => (ctx, w, h) => {
  fill(ctx, bg, 0, 0, w, h);
  const t = Math.min(w, h) * thickness;
  fill(ctx, cross, 0, (h - t) / 2, w, t);
  fill(ctx, cross, (w - t) / 2, 0, t, h);
};

/** Off-centre Nordic cross. */
const nordicCross = (bg: string, cross: string, outline?: string): Draw => (ctx, w, h) => {
  fill(ctx, bg, 0, 0, w, h);
  const cx = w * 0.36;
  const draw = (t: number, c: string) => {
    fill(ctx, c, 0, (h - t) / 2, w, t);
    fill(ctx, c, cx - t / 2, 0, t, h);
  };
  if (outline) draw(h * 0.3, outline);
  draw(h * 0.18, cross);
};

/** Diagonal saltire (St Andrew style). */
const saltire = (bg: string, cross: string, lineWidth = 0.16): Draw => (ctx, w, h) => {
  fill(ctx, bg, 0, 0, w, h);
  ctx.strokeStyle = cross;
  ctx.lineWidth = Math.min(w, h) * lineWidth;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(w, h);
  ctx.moveTo(w, 0);
  ctx.lineTo(0, h);
  ctx.stroke();
};

/** Plain field with a centred disc (Japan style). */
const discFlag = (bg: string, disc: string, r = 0.3): Draw => (ctx, w, h) => {
  fill(ctx, bg, 0, 0, w, h);
  ctx.fillStyle = disc;
  ctx.beginPath();
  ctx.arc(w / 2, h / 2, Math.min(w, h) * r, 0, Math.PI * 2);
  ctx.fill();
};

/** Five-pointed star path. */
const starPath = (ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) => {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? r : r * 0.4;
    const a = (Math.PI / 5) * i - Math.PI / 2;
    const x = cx + rad * Math.cos(a);
    const y = cy + rad * Math.sin(a);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
};

const unionJack: Draw = (ctx, w, h) => {
  fill(ctx, '#012169', 0, 0, w, h);
  // White diagonals under red diagonals.
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = h * 0.22;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(w, h);
  ctx.moveTo(w, 0);
  ctx.lineTo(0, h);
  ctx.stroke();
  ctx.strokeStyle = '#C8102E';
  ctx.lineWidth = h * 0.08;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(w, h);
  ctx.moveTo(w, 0);
  ctx.lineTo(0, h);
  ctx.stroke();
  // White cross under red cross.
  fill(ctx, '#ffffff', 0, h * 0.36, w, h * 0.28);
  fill(ctx, '#ffffff', w * 0.41, 0, w * 0.18, h);
  fill(ctx, '#C8102E', 0, h * 0.42, w, h * 0.16);
  fill(ctx, '#C8102E', w * 0.45, 0, w * 0.1, h);
};

const usaFlag: Draw = (ctx, w, h) => {
  // 13 stripes + starred canton (stars as dots at this size).
  for (let i = 0; i < 13; i++) fill(ctx, i % 2 === 0 ? '#B22234' : '#ffffff', 0, (h / 13) * i, w, h / 13 + 1);
  fill(ctx, '#3C3B6E', 0, 0, w * 0.42, h * (7 / 13));
  ctx.fillStyle = '#ffffff';
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 5; c++) {
      ctx.beginPath();
      ctx.arc(w * (0.05 + c * 0.08), h * (0.07 + r * 0.12), Math.min(w, h) * 0.02, 0, Math.PI * 2);
      ctx.fill();
    }
  }
};

const sovietFlag: Draw = (ctx, w, h) => {
  fill(ctx, '#CC0000', 0, 0, w, h);
  ctx.fillStyle = '#FFD700';
  starPath(ctx, w * 0.18, h * 0.22, Math.min(w, h) * 0.12);
  ctx.fill();
};

const chinaFlag: Draw = (ctx, w, h) => {
  fill(ctx, '#DE2910', 0, 0, w, h);
  ctx.fillStyle = '#FFDE00';
  starPath(ctx, w * 0.17, h * 0.25, Math.min(w, h) * 0.15);
  ctx.fill();
  for (const [sx, sy] of [[0.32, 0.1], [0.38, 0.2], [0.38, 0.33], [0.32, 0.43]]) {
    starPath(ctx, w * sx, h * sy, Math.min(w, h) * 0.045);
    ctx.fill();
  }
};

const ottomanFlag: Draw = (ctx, w, h) => {
  fill(ctx, '#E30A17', 0, 0, w, h);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(w * 0.42, h * 0.5, h * 0.26, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#E30A17';
  ctx.beginPath();
  ctx.arc(w * 0.47, h * 0.5, h * 0.21, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  starPath(ctx, w * 0.58, h * 0.5, h * 0.1);
  ctx.fill();
};

const brazilFlag: Draw = (ctx, w, h) => {
  fill(ctx, '#009C3B', 0, 0, w, h);
  ctx.fillStyle = '#FFDF00';
  ctx.beginPath();
  ctx.moveTo(w * 0.5, h * 0.1);
  ctx.lineTo(w * 0.92, h * 0.5);
  ctx.lineTo(w * 0.5, h * 0.9);
  ctx.lineTo(w * 0.08, h * 0.5);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#002776';
  ctx.beginPath();
  ctx.arc(w * 0.5, h * 0.5, h * 0.24, 0, Math.PI * 2);
  ctx.fill();
};

const indiaFlag: Draw = (ctx, w, h) => {
  hBands('#FF9933', '#ffffff', '#138808')(ctx, w, h);
  ctx.strokeStyle = '#000080';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(w / 2, h / 2, h * 0.13, 0, Math.PI * 2);
  ctx.stroke();
};

const franceRoyal: Draw = (ctx, w, h) => {
  // Royal France: golden fleurs-de-lis on blue (stylised as gold diamonds).
  fill(ctx, '#2E4B9B', 0, 0, w, h);
  ctx.fillStyle = '#F5C518';
  for (const [fx, fy] of [[0.5, 0.24], [0.3, 0.62], [0.7, 0.62]]) {
    const s = Math.min(w, h) * 0.1;
    ctx.beginPath();
    ctx.moveTo(w * fx, h * fy - s);
    ctx.lineTo(w * fx + s * 0.7, h * fy);
    ctx.lineTo(w * fx, h * fy + s);
    ctx.lineTo(w * fx - s * 0.7, h * fy);
    ctx.closePath();
    ctx.fill();
  }
};

const burgundyCross: Draw = (ctx, w, h) => saltire('#f2ead8', '#AA151B', 0.12)(ctx, w, h);

const switzerlandFlag: Draw = (ctx, w, h) => {
  fill(ctx, '#DA291C', 0, 0, w, h);
  const t = Math.min(w, h) * 0.18;
  const L = Math.min(w, h) * 0.55;
  fill(ctx, '#ffffff', (w - t) / 2, (h - L) / 2, t, L);
  fill(ctx, '#ffffff', (w - L) / 2, (h - t) / 2, L, t);
};

const greeceFlag: Draw = (ctx, w, h) => {
  for (let i = 0; i < 9; i++) fill(ctx, i % 2 === 0 ? '#0D5EAF' : '#ffffff', 0, (h / 9) * i, w, h / 9 + 1);
  fill(ctx, '#0D5EAF', 0, 0, w * 0.37, h * (5 / 9));
  const t = h * 0.11;
  fill(ctx, '#ffffff', 0, (h * (5 / 9) - t) / 2, w * 0.37, t);
  fill(ctx, '#ffffff', (w * 0.37 - t) / 2, 0, t, h * (5 / 9));
};

/** Hoist-side triangle over bands (pan-Arab / Cuba / Philippines style). */
const triangleFlag = (bands: Draw, tri: string): Draw => (ctx, w, h) => {
  bands(ctx, w, h);
  ctx.fillStyle = tri;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(w * 0.42, h / 2);
  ctx.lineTo(0, h);
  ctx.closePath();
  ctx.fill();
};

/** A crescent (+ optional star) over whatever is already painted — the inner
 * disc is ERASED (destination-out), so it works over any background. Pass a
 * bg colour to paint a field first, or 'none' to draw on the existing art. */
const crescentFlag = (bg: string, mark: string, star = true): Draw => (ctx, w, h) => {
  if (bg !== 'none') fill(ctx, bg, 0, 0, w, h);
  ctx.fillStyle = mark;
  ctx.beginPath();
  ctx.arc(w * 0.48, h * 0.5, h * 0.28, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  ctx.arc(w * 0.54, h * 0.46, h * 0.23, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  if (star) {
    ctx.fillStyle = mark;
    starPath(ctx, w * 0.64, h * 0.42, h * 0.09);
    ctx.fill();
  }
};

/** Field with one centred star. */
const starFlag = (bg: string, star: string, r = 0.22, cx = 0.5, cy = 0.5): Draw => (ctx, w, h) => {
  fill(ctx, bg, 0, 0, w, h);
  ctx.fillStyle = star;
  starPath(ctx, w * cx, h * cy, Math.min(w, h) * r);
  ctx.fill();
};

const romanVexillum: Draw = (ctx, w, h) => {
  fill(ctx, '#8E1C1C', 0, 0, w, h);
  ctx.strokeStyle = '#D4AF37';
  ctx.lineWidth = Math.min(w, h) * 0.06;
  ctx.strokeRect(w * 0.12, h * 0.14, w * 0.76, h * 0.72);
};

const byzantineFlag: Draw = (ctx, w, h) => {
  fill(ctx, '#5B2C83', 0, 0, w, h);
  centredCross('#5B2C83', '#D4AF37', 0.12)(ctx, w, h);
};

/* ---------------- the registry (order matters) ---------------- */

export const FLAGS: FlagSpec[] = [
  // Britain — St George / St Andrew before the 1707 Union, Union Jack after.
  { match: 'united kingdom', key: 'union-jack', draw: unionJack },
  { match: 'great britain', key: 'union-jack', draw: unionJack },
  { match: 'england', key: 'st-george', to: 1706, draw: centredCross('#ffffff', '#C8102E', 0.16) },
  { match: 'england', key: 'union-jack', from: 1707, draw: unionJack },
  { match: 'scotland', key: 'st-andrew', draw: saltire('#005EB8', '#ffffff') },
  { match: 'ireland', key: 'ireland', from: 1916, draw: vBands('#169B62', '#ffffff', '#FF883E') },

  // France — royal lilies, then the tricolore.
  { match: 'france', key: 'france-royal', to: 1788, draw: franceRoyal },
  { match: 'france', key: 'tricolore', from: 1789, draw: vBands('#0055A4', '#ffffff', '#EF4135') },
  { match: 'frankish', key: 'france-royal', draw: franceRoyal },

  // Iberia.
  { match: 'spain', key: 'burgundy-cross', to: 1784, draw: burgundyCross },
  { match: 'spain', key: 'spain', from: 1785, draw: hBands('#AA151B', '#F1BF00', '#AA151B') },
  { match: 'portugal', key: 'portugal-royal', to: 1910, draw: hBands('#2E4B9B', '#ffffff') },
  { match: 'portugal', key: 'portugal', from: 1911, draw: vBands('#046A38', '#DA291C', '#DA291C') },

  // Germanies.
  { match: 'prussia', key: 'prussia', draw: hBands('#1a1a1a', '#ffffff') },
  { match: 'german', key: 'german-empire', to: 1918, draw: hBands('#1a1a1a', '#ffffff', '#DD0000') },
  { match: 'german', key: 'germany', from: 1919, draw: hBands('#1a1a1a', '#DD0000', '#FFCE00') },
  { match: 'austria', key: 'austria', draw: hBands('#ED2939', '#ffffff', '#ED2939') },

  // Russia — tricolour, Soviet red in between.
  { match: 'soviet', key: 'soviet', draw: sovietFlag },
  { match: 'russia', key: 'russia', from: 1699, draw: hBands('#ffffff', '#0039A6', '#D52B1E') },

  // Rest of Europe.
  { match: 'netherlands', key: 'netherlands', draw: hBands('#AE1C28', '#ffffff', '#21468B') },
  { match: 'dutch', key: 'netherlands', draw: hBands('#AE1C28', '#ffffff', '#21468B') },
  { match: 'belgium', key: 'belgium', from: 1830, draw: vBands('#1a1a1a', '#FDDA24', '#EF3340') },
  { match: 'italy', key: 'italy', from: 1861, draw: vBands('#008C45', '#ffffff', '#CD212A') },
  { match: 'sweden', key: 'sweden', draw: nordicCross('#005CBF', '#FECC00') },
  { match: 'norway', key: 'norway', draw: nordicCross('#BA0C2F', '#00205B', '#ffffff') },
  { match: 'denmark', key: 'denmark', draw: nordicCross('#C8102E', '#ffffff') },
  { match: 'finland', key: 'finland', draw: nordicCross('#ffffff', '#002F6C') },
  { match: 'switzerland', key: 'switzerland', draw: switzerlandFlag },
  { match: 'poland', key: 'poland', draw: hBands('#ffffff', '#DC143C') },
  { match: 'hungary', key: 'hungary', draw: hBands('#CD2A3E', '#ffffff', '#436F4D') },
  { match: 'greece', key: 'greece', from: 1822, draw: greeceFlag },
  { match: 'ukraine', key: 'ukraine', from: 1917, draw: hBands('#005BBB', '#FFD500') },

  // Classical & medieval powers.
  { match: 'holy roman', key: 'holy-roman', draw: discFlag('#F5C518', '#1a1a1a', 0.22) },
  { match: 'eastern roman', key: 'byzantium', draw: byzantineFlag },
  { match: 'byzanti', key: 'byzantium', draw: byzantineFlag },
  { match: 'roman', key: 'rome', draw: romanVexillum },
  { match: 'ottoman', key: 'ottoman', draw: ottomanFlag },
  { match: 'turkey', key: 'turkey', draw: ottomanFlag },

  // Asia.
  { match: 'japan', key: 'japan', draw: discFlag('#ffffff', '#BC002D') },
  { match: 'qing', key: 'qing', draw: discFlag('#F5C518', '#DE2910', 0.16) },
  { match: 'china', key: 'china', from: 1949, draw: chinaFlag },
  { match: 'india', key: 'india', from: 1947, draw: indiaFlag },
  { match: 'korea, south', key: 'south-korea', draw: discFlag('#ffffff', '#CD2E3A', 0.24) },
  { match: 'south korea', key: 'south-korea', draw: discFlag('#ffffff', '#CD2E3A', 0.24) },
  { match: 'vietnam', key: 'vietnam', from: 1945, draw: sovietFlag },
  { match: 'israel', key: 'israel', from: 1948, draw: (ctx, w, h) => {
    fill(ctx, '#ffffff', 0, 0, w, h);
    fill(ctx, '#0038B8', 0, h * 0.1, w, h * 0.12);
    fill(ctx, '#0038B8', 0, h * 0.78, w, h * 0.12);
    ctx.strokeStyle = '#0038B8';
    ctx.lineWidth = 2.5;
    const r = h * 0.18;
    for (const flip of [1, -1]) {
      ctx.beginPath();
      for (let i = 0; i < 3; i++) {
        const a = ((Math.PI * 2) / 3) * i + (flip === 1 ? -Math.PI / 2 : Math.PI / 2);
        const x = w / 2 + r * Math.cos(a);
        const y = h / 2 + r * Math.sin(a);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
    }
  } },

  // Colonial-era polity names ("French West Africa", "British Raj", ...) so the
  // whole imperial map wears its metropole's colours.
  { match: 'british', key: 'union-jack', draw: unionJack },
  { match: 'french', key: 'tricolore', from: 1789, draw: vBands('#0055A4', '#ffffff', '#EF4135') },
  { match: 'belgian', key: 'belgium', draw: vBands('#1a1a1a', '#FDDA24', '#EF3340') },
  { match: 'portuguese', key: 'portugal-royal', to: 1910, draw: hBands('#2E4B9B', '#ffffff') },
  { match: 'portuguese', key: 'portugal', from: 1911, draw: vBands('#046A38', '#DA291C', '#DA291C') },
  { match: 'spanish', key: 'burgundy-cross', to: 1784, draw: burgundyCross },
  { match: 'spanish', key: 'spain', from: 1785, draw: hBands('#AA151B', '#F1BF00', '#AA151B') },
  { match: 'italian', key: 'italy', from: 1861, draw: vBands('#008C45', '#ffffff', '#CD212A') },

  // Africa.
  { match: 'ethiopia', key: 'ethiopia', from: 1897, draw: hBands('#078930', '#FCDD09', '#DA121A') },
  { match: 'abyssinia', key: 'ethiopia', from: 1897, draw: hBands('#078930', '#FCDD09', '#DA121A') },
  { match: 'liberia', key: 'liberia', from: 1847, draw: (ctx, w, h) => {
    for (let i = 0; i < 11; i++) fill(ctx, i % 2 === 0 ? '#B22234' : '#ffffff', 0, (h / 11) * i, w, h / 11 + 1);
    fill(ctx, '#002868', 0, 0, w * 0.34, h * (5 / 11));
    ctx.fillStyle = '#ffffff';
    starPath(ctx, w * 0.17, h * 0.22, h * 0.12);
    ctx.fill();
  } },
  { match: 'morocco', key: 'morocco', from: 1915, draw: starFlag('#C1272D', '#006233') },
  { match: 'algeria', key: 'algeria', from: 1962, draw: (ctx, w, h) => {
    vBands('#006233', '#ffffff')(ctx, w, h);
    crescentFlag('none', '#D21034')(ctx, w, h);
  } },
  { match: 'tunisia', key: 'tunisia', from: 1831, draw: (ctx, w, h) => {
    fill(ctx, '#E70013', 0, 0, w, h);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, h * 0.3, 0, Math.PI * 2);
    ctx.fill();
    crescentFlag('none', '#E70013')(ctx, w, h);
  } },
  { match: 'libya', key: 'libya-green', from: 1977, to: 2010, draw: (ctx, w, h) => fill(ctx, '#239E46', 0, 0, w, h) },
  { match: 'libya', key: 'libya', from: 2011, draw: hBands('#E70013', '#1a1a1a', '#239E46') },
  { match: 'sudan', key: 'sudan', from: 1970, draw: triangleFlag(hBands('#D21034', '#ffffff', '#1a1a1a'), '#007229') },
  { match: 'nigeria', key: 'nigeria', from: 1960, draw: vBands('#008751', '#ffffff', '#008751') },
  { match: 'ghana', key: 'ghana', from: 1957, draw: (ctx, w, h) => {
    hBands('#CE1126', '#FCD116', '#006B3F')(ctx, w, h);
    ctx.fillStyle = '#1a1a1a';
    starPath(ctx, w / 2, h / 2, h * 0.14);
    ctx.fill();
  } },
  { match: 'kenya', key: 'kenya', from: 1963, draw: hBands('#1a1a1a', '#BB0000', '#006600') },
  { match: 'tanzania', key: 'tanzania', from: 1964, draw: (ctx, w, h) => {
    fill(ctx, '#1EB53A', 0, 0, w, h);
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = h * 0.32;
    ctx.beginPath();
    ctx.moveTo(0, h);
    ctx.lineTo(w, 0);
    ctx.stroke();
    ctx.fillStyle = '#00A3DD';
    ctx.beginPath();
    ctx.moveTo(w, h * 0.35);
    ctx.lineTo(w, h);
    ctx.lineTo(w * 0.35, h);
    ctx.closePath();
    ctx.fill();
  } },
  { match: 'congo', key: 'dr-congo', from: 1960, draw: starFlag('#007FFF', '#F7D618', 0.2, 0.3, 0.3) },
  { match: 'angola', key: 'angola', from: 1975, draw: (ctx, w, h) => {
    hBands('#CC092F', '#1a1a1a')(ctx, w, h);
    ctx.fillStyle = '#FFCB00';
    starPath(ctx, w / 2, h / 2, h * 0.12);
    ctx.fill();
  } },
  { match: 'mozambique', key: 'mozambique', from: 1975, draw: triangleFlag(hBands('#009639', '#1a1a1a', '#FFD100'), '#D21034') },
  { match: 'zimbabwe', key: 'zimbabwe', from: 1980, draw: triangleFlag(hBands('#319208', '#FFD200', '#DE2010', '#1a1a1a', '#DE2010', '#FFD200', '#319208'), '#ffffff') },
  { match: 'somalia', key: 'somalia', from: 1954, draw: starFlag('#4189DD', '#ffffff') },
  { match: 'madagascar', key: 'madagascar', from: 1958, draw: (ctx, w, h) => {
    fill(ctx, '#ffffff', 0, 0, w, h);
    fill(ctx, '#FC3D32', w * 0.33, 0, w * 0.67, h / 2);
    fill(ctx, '#007E3A', w * 0.33, h / 2, w * 0.67, h / 2);
  } },
  { match: 'south africa', key: 'south-africa', from: 1994, draw: triangleFlag(hBands('#DE3831', '#ffffff', '#007A4D'), '#1a1a1a') },
  { match: 'egypt', key: 'egypt', from: 1953, draw: (ctx, w, h) => {
    hBands('#CE1126', '#ffffff', '#1a1a1a')(ctx, w, h);
    ctx.fillStyle = '#C09300';
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, h * 0.1, 0, Math.PI * 2);
    ctx.fill();
  } },

  // More of Asia & the Middle East.
  { match: 'indonesia', key: 'indonesia', from: 1945, draw: hBands('#CE1126', '#ffffff') },
  { match: 'malaysia', key: 'malaysia', from: 1963, draw: (ctx, w, h) => {
    for (let i = 0; i < 14; i++) fill(ctx, i % 2 === 0 ? '#CC0001' : '#ffffff', 0, (h / 14) * i, w, h / 14 + 1);
    fill(ctx, '#010066', 0, 0, w * 0.45, h / 2);
    crescentFlag('none', '#FFCC00')(ctx, w * 0.7, h * 0.75);
  } },
  { match: 'philippines', key: 'philippines', from: 1946, draw: triangleFlag(hBands('#0038A8', '#CE1126'), '#ffffff') },
  { match: 'thailand', key: 'thailand', from: 1917, draw: (ctx, w, h) => {
    fill(ctx, '#A51931', 0, 0, w, h);
    fill(ctx, '#ffffff', 0, h / 6, w, h / 6);
    fill(ctx, '#2D2A4A', 0, h / 3, w, h / 3);
    fill(ctx, '#ffffff', 0, h * (2 / 3), w, h / 6);
  } },
  { match: 'siam', key: 'siam', to: 1916, draw: discFlag('#A51931', '#ffffff', 0.22) },
  { match: 'myanmar', key: 'myanmar', from: 2010, draw: (ctx, w, h) => {
    hBands('#FECB00', '#34B233', '#EA2839')(ctx, w, h);
    ctx.fillStyle = '#ffffff';
    starPath(ctx, w / 2, h / 2, h * 0.22);
    ctx.fill();
  } },
  { match: 'pakistan', key: 'pakistan', from: 1947, draw: (ctx, w, h) => {
    fill(ctx, '#ffffff', 0, 0, w, h);
    fill(ctx, '#01411C', w * 0.25, 0, w * 0.75, h);
    ctx.save();
    ctx.translate(w * 0.14, 0);
    crescentFlag('none', '#ffffff')(ctx, w, h);
    ctx.restore();
  } },
  { match: 'iran', key: 'iran', from: 1979, draw: hBands('#239F40', '#ffffff', '#DA0000') },
  { match: 'persia', key: 'persia', from: 1906, to: 1978, draw: hBands('#239F40', '#ffffff', '#DA0000') },
  { match: 'iraq', key: 'iraq', from: 1963, draw: hBands('#CE1126', '#ffffff', '#1a1a1a') },
  { match: 'syria', key: 'syria', from: 1946, draw: hBands('#CE1126', '#ffffff', '#1a1a1a') },
  { match: 'jordan', key: 'jordan', from: 1928, draw: triangleFlag(hBands('#1a1a1a', '#ffffff', '#007A3D'), '#CE1126') },
  { match: 'saudi', key: 'saudi', from: 1932, draw: (ctx, w, h) => {
    fill(ctx, '#006C35', 0, 0, w, h);
    fill(ctx, '#ffffff', w * 0.2, h * 0.62, w * 0.6, h * 0.06);
  } },
  { match: 'kazakhstan', key: 'kazakhstan', from: 1991, draw: discFlag('#00AFCA', '#FEC50C', 0.24) },
  { match: 'mongolia', key: 'mongolia-modern', from: 1945, draw: (ctx, w, h) => {
    vBands('#C4272F', '#015197', '#C4272F')(ctx, w, h);
    ctx.fillStyle = '#F9CF02';
    ctx.beginPath();
    ctx.arc(w * 0.17, h * 0.5, h * 0.1, 0, Math.PI * 2);
    ctx.fill();
  } },
  { match: 'north korea', key: 'north-korea', from: 1948, draw: (ctx, w, h) => {
    fill(ctx, '#024FA2', 0, 0, w, h);
    fill(ctx, '#ffffff', 0, h * 0.18, w, h * 0.64);
    fill(ctx, '#ED1C27', 0, h * 0.24, w, h * 0.52);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(w * 0.3, h * 0.5, h * 0.18, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ED1C27';
    starPath(ctx, w * 0.3, h * 0.5, h * 0.15);
    ctx.fill();
  } },
  { match: 'korea, north', key: 'north-korea-alt', from: 1948, draw: starFlag('#024FA2', '#ED1C27', 0.2, 0.3, 0.5) },

  // The Americas & beyond.
  { match: 'united states', key: 'usa', draw: usaFlag },
  { match: 'canada', key: 'canada', from: 1965, draw: (ctx, w, h) => {
    vBands('#D80621', '#ffffff', '#D80621')(ctx, w, h);
    ctx.fillStyle = '#D80621';
    starPath(ctx, w / 2, h / 2, h * 0.2);
    ctx.fill();
  } },
  { match: 'mexico', key: 'mexico', from: 1821, draw: vBands('#006847', '#ffffff', '#CE1126') },
  { match: 'brazil', key: 'brazil', from: 1889, draw: brazilFlag },
  { match: 'argentina', key: 'argentina', from: 1812, draw: hBands('#74ACDF', '#ffffff', '#74ACDF') },
  { match: 'australia', key: 'australia', from: 1901, draw: (ctx, w, h) => {
    fill(ctx, '#00247D', 0, 0, w, h);
    ctx.save();
    ctx.scale(0.5, 0.5);
    unionJack(ctx, w, h);
    ctx.restore();
    ctx.fillStyle = '#ffffff';
    for (const [sx, sy] of [[0.75, 0.2], [0.85, 0.45], [0.7, 0.6], [0.78, 0.82], [0.25, 0.75]]) {
      starPath(ctx, w * sx, h * sy, Math.min(w, h) * 0.05);
      ctx.fill();
    }
  } },
  { match: 'new zealand', key: 'new-zealand', from: 1902, draw: (ctx, w, h) => {
    fill(ctx, '#00247D', 0, 0, w, h);
    ctx.save();
    ctx.scale(0.5, 0.5);
    unionJack(ctx, w, h);
    ctx.restore();
    ctx.fillStyle = '#CC142B';
    for (const [sx, sy] of [[0.75, 0.22], [0.85, 0.45], [0.68, 0.5], [0.77, 0.78]]) {
      starPath(ctx, w * sx, h * sy, Math.min(w, h) * 0.05);
      ctx.fill();
    }
  } },
  { match: 'colombia', key: 'colombia', from: 1819, draw: (ctx, w, h) => {
    fill(ctx, '#FCD116', 0, 0, w, h / 2);
    fill(ctx, '#003893', 0, h / 2, w, h / 4);
    fill(ctx, '#CE1126', 0, h * 0.75, w, h / 4);
  } },
  { match: 'venezuela', key: 'venezuela', from: 1830, draw: hBands('#FCD116', '#003893', '#CE1126') },
  { match: 'ecuador', key: 'ecuador', from: 1830, draw: (ctx, w, h) => {
    fill(ctx, '#FCD116', 0, 0, w, h / 2);
    fill(ctx, '#003893', 0, h / 2, w, h / 4);
    fill(ctx, '#CE1126', 0, h * 0.75, w, h / 4);
  } },
  { match: 'peru', key: 'peru', from: 1825, draw: vBands('#D91023', '#ffffff', '#D91023') },
  { match: 'chile', key: 'chile', from: 1817, draw: (ctx, w, h) => {
    fill(ctx, '#ffffff', 0, 0, w, h / 2);
    fill(ctx, '#D52B1E', 0, h / 2, w, h / 2);
    fill(ctx, '#0039A6', 0, 0, w * 0.33, h / 2);
    ctx.fillStyle = '#ffffff';
    starPath(ctx, w * 0.165, h * 0.25, h * 0.12);
    ctx.fill();
  } },
  { match: 'bolivia', key: 'bolivia', from: 1825, draw: hBands('#D52B1E', '#F9E300', '#007934') },
  { match: 'uruguay', key: 'uruguay', from: 1828, draw: (ctx, w, h) => {
    for (let i = 0; i < 9; i++) fill(ctx, i % 2 === 0 ? '#ffffff' : '#0038A8', 0, (h / 9) * i, w, h / 9 + 1);
    fill(ctx, '#ffffff', 0, 0, w * 0.35, h * (5 / 9));
    ctx.fillStyle = '#FCD116';
    ctx.beginPath();
    ctx.arc(w * 0.17, h * 0.27, h * 0.14, 0, Math.PI * 2);
    ctx.fill();
  } },
  { match: 'paraguay', key: 'paraguay', from: 1842, draw: hBands('#D52B1E', '#ffffff', '#0038A8') },
  { match: 'cuba', key: 'cuba', from: 1902, draw: (ctx, w, h) => {
    for (let i = 0; i < 5; i++) fill(ctx, i % 2 === 0 ? '#002A8F' : '#ffffff', 0, (h / 5) * i, w, h / 5 + 1);
    triangleFlag((c) => void c, '#CF142B')(ctx, w, h);
    ctx.fillStyle = '#ffffff';
    starPath(ctx, w * 0.15, h * 0.5, h * 0.13);
    ctx.fill();
  } },
  { match: 'haiti', key: 'haiti', from: 1804, draw: hBands('#00209F', '#D21034') },
];

/** The flag spec valid for this polity name at this year, or null. */
export function flagSpecFor(name: string, year: number): FlagSpec | null {
  const lower = name.toLowerCase();
  for (const spec of FLAGS) {
    if (!lower.includes(spec.match)) continue;
    if (spec.from !== undefined && year < spec.from) continue;
    if (spec.to !== undefined && year > spec.to) continue;
    return spec;
  }
  return null;
}

/* Rendered flags, cached by spec key. */
const flagCache = new Map<string, HTMLCanvasElement>();

/** A rendered flag canvas for this polity at this year, or null. */
export function flagCanvasFor(name: string, year: number): HTMLCanvasElement | null {
  const spec = flagSpecFor(name, year);
  if (!spec) return null;
  const cached = flagCache.get(spec.key);
  if (cached) return cached;
  const canvas = document.createElement('canvas');
  canvas.width = 150;
  canvas.height = 100;
  const ctx = canvas.getContext('2d')!;
  spec.draw(ctx, canvas.width, canvas.height);
  flagCache.set(spec.key, canvas);
  return canvas;
}
