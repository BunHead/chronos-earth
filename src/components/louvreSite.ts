import * as THREE from 'three';

/**
 * The Louvre, in true metres: the palace round the Cour Carrée and the Cour
 * Napoléon, its wings to the Tuileries, and I. M. Pei's pyramid.
 *
 * WHY A NEW MODEL (Nov 2026). The old 'louvre' model was a square ring of
 * wings about 300 m across with no pyramid, sitting over the Cour Napoléon
 * and half of the Cour Carrée; the Captain had flagged it for rework.
 *
 * SOURCES (read 20 Nov 2026).
 *  - Plan: Esri World Imagery (z18, 0.39 m/px). The palace's long axis runs on
 *    bearing about 102°. Read off the photo, in metres along that axis (u,
 *    east-south-east) and across it (w, toward the Seine) from the pyramid:
 *    the Cour Carrée about 180 m square; the Richelieu wing's block of courts
 *    to the north of the Cour Napoléon and the Denon wing's to the south, the
 *    Cour Napoléon about 90 m across between them; the long gallery along the
 *    Seine and the Rivoli wing on the north running west about 390 m to the
 *    Pavillons de Flore and de Marsan. Good to about 10 m: the photo leans
 *    and OpenStreetMap could not be reached.
 *  - The pyramid: about 35 m square at the base and 21.6 m high, glass and
 *    steel, opened 1989 (the Louvre's own and Wikipedia's figures).
 *
 * GUESSES, said plainly. The heights (about 25 m to the cornice, the pavilions
 * higher), the roofs (slate, simple hips), the inner courts and the glass
 * roofs over the Richelieu courts are simplified; the Arc du Carrousel and
 * the small pyramids are left out. The palace shown is today's; it stands on
 * the globe from 1989, the pyramid's year.
 *
 * FRAME. Metres from the pin (48.8606, 2.3376): x = EAST, z = SOUTH (north =
 * −Z), y up. Scaled by U; facing 0.
 */
export function buildLouvreSite(group: THREE.Group): void {
  const U = 0.1;
  const root = new THREE.Group();
  root.scale.setScalar(U);
  group.add(root);

  const mats = new Map<string, THREE.Material>();
  const mat = (c: string, rough = 0.85, extra: THREE.MeshStandardMaterialParameters = {}) => {
    const k = c + rough + JSON.stringify(extra);
    if (!mats.has(k)) mats.set(k, new THREE.MeshStandardMaterial({ color: c, roughness: rough, ...extra }));
    return mats.get(k)!;
  };
  const stone = mat('#e4dccb'), stoneDk = mat('#d4cab4'), slate = new THREE.MeshStandardMaterial({ color: '#5d646c', roughness: 0.7, side: THREE.DoubleSide });
  const glassRoof = mat('#a9c9c6', 0.2, { metalness: 0.3 });
  const court = mat('#cfc3ab', 0.95);

  // The palace frame: local +x along the axis (bearing 102°), local +z across (toward the Seine).
  const P = new THREE.Group();
  const B = (102 * Math.PI) / 180;
  P.position.set(-128, 0, -51); // the pyramid
  P.rotation.y = -Math.atan2(-Math.cos(B), Math.sin(B));
  root.add(P);

  /** A hipped roof L × D at its eaves, `rh` high, the ridge along the longer side. */
  const hipGeo = (L: number, D: number, rh: number) => {
    const alongX = L >= D;
    const a = (alongX ? L : D) / 2, b = (alongX ? D : L) / 2;
    const ridge = Math.max(0.5, a - b * 0.9); // half-length of the ridge
    const top = b * 0.25; // a little flat on the ridge, as mansards have
    const v = [
      [-a, 0, -b], [a, 0, -b], [a, 0, b], [-a, 0, b],
      [-ridge, rh, -top], [ridge, rh, -top], [ridge, rh, top], [-ridge, rh, top],
    ].map(([x, y, z]) => (alongX ? [x, y, z] : [z, y, x]));
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(v.flat(), 3));
    g.setIndex([0, 4, 1, 1, 4, 5, 1, 5, 2, 2, 5, 6, 2, 6, 3, 3, 6, 7, 3, 7, 0, 0, 7, 4, 4, 7, 5, 5, 7, 6]);
    const ng = g.toNonIndexed();
    ng.computeVertexNormals();
    return ng;
  };
  /** A wing block u0..u1 × w0..w1, h to the cornice, with a slate roof. */
  const wing = (u0: number, u1: number, w0: number, w1: number, h = 25, roofH = 8, wall = stone) => {
    const L = u1 - u0, D = w1 - w0;
    const m = new THREE.Mesh(new THREE.BoxGeometry(L, h, D), wall);
    m.position.set((u0 + u1) / 2, h / 2, (w0 + w1) / 2);
    P.add(m);
    // A steep slate hip: four sloping faces up to a ridge along the longer side.
    if (roofH > 0.5) {
      const r = new THREE.Mesh(hipGeo(L, D, roofH), slate);
      r.position.set((u0 + u1) / 2, h, (w0 + w1) / 2);
      P.add(r);
    }
    const cornice = new THREE.Mesh(new THREE.BoxGeometry(L + 0.8, 0.9, D + 0.8), stoneDk);
    cornice.position.set((u0 + u1) / 2, h - 0.45, (w0 + w1) / 2);
    P.add(cornice);
  };
  /** A ring of wings round an open court, `d` deep. */
  const ring = (u0: number, u1: number, w0: number, w1: number, d: number, h = 25) => {
    wing(u0, u1, w0, w0 + d, h);
    wing(u0, u1, w1 - d, w1, h);
    wing(u0, u0 + d, w0 + d, w1 - d, h);
    wing(u1 - d, u1, w0 + d, w1 - d, h);
    const g = new THREE.Mesh(new THREE.BoxGeometry(u1 - u0 - 2 * d, 0.3, w1 - w0 - 2 * d), court);
    g.position.set((u0 + u1) / 2, 0.15, (w0 + w1) / 2);
    P.add(g);
  };
  /** A glass-roofed court inside a block: a low glazed hip just over the cornice. */
  const glassCourt = (u0: number, u1: number, w0: number, w1: number, h = 25) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(u1 - u0, 3, w1 - w0), glassRoof);
    m.position.set((u0 + u1) / 2, h + 1.6, (w0 + w1) / 2);
    P.add(m);
  };

  // ---- The Cour Carrée (east) ----
  const CC = { u0: 140, u1: 318, w0: -55, w1: 135 };
  ring(CC.u0, CC.u1, CC.w0, CC.w1, 26, 26);
  // The Pavillon de l'Horloge in the middle of its west wing, taller, with its dome.
  const wm = (CC.w0 + CC.w1) / 2;
  wing(CC.u0 - 2, CC.u0 + 28, wm - 16, wm + 16, 34, 0.1);
  {
    const dome = new THREE.Mesh(new THREE.CylinderGeometry(8, 15, 13, 4, 1), slate);
    dome.rotation.y = Math.PI / 4;
    dome.position.set(CC.u0 + 13, 34 + 6.5, wm);
    P.add(dome);
  }

  // ---- Round the Cour Napoléon ----
  // North: the Richelieu wing, a block of courts (three glazed over) to the rue de Rivoli.
  wing(-95, CC.u0, -140, -110);
  wing(-95, CC.u0, -66, -36);
  wing(-95, -65, -110, -66);
  wing(20, 50, -110, -66);
  wing(110, CC.u0, -110, -66);
  glassCourt(-65, 20, -110, -66);
  glassCourt(50, 110, -110, -66);
  // South: the Denon wing, its courts open, to the Seine.
  wing(-95, CC.u0, 54, 80);
  wing(-95, CC.u0, 112, 135);
  wing(-95, -65, 80, 112);
  wing(20, 50, 80, 112);
  wing(110, CC.u0, 80, 112);
  for (const [a, b] of [[-65, 20], [50, 110]] as const) {
    const g = new THREE.Mesh(new THREE.BoxGeometry(b - a, 0.3, 32), court);
    g.position.set((a + b) / 2, 0.15, 96);
    P.add(g);
  }
  // The pavilions at the Cour Napoléon's west corners (Rohan / la Trémoille side), taller.
  wing(-110, -80, -145, -36, 31);
  wing(-110, -80, 54, 140, 31);

  // ---- West to the Tuileries ----
  // The Grande Galerie along the Seine, and the Rivoli wing on the north.
  wing(-385, -110, 110, 135, 22);
  wing(-385, -110, -145, -122, 22);
  // The Pavillons de Flore (south) and de Marsan (north), at the far ends.
  wing(-415, -385, 92, 140, 32);
  wing(-415, -385, -150, -104, 32);

  // ---- The Cour Napoléon and Pei's pyramid (1989) ----
  {
    const g = new THREE.Mesh(new THREE.BoxGeometry(190, 0.3, 90), court);
    g.position.set(-80 + 95 + 30, 0.15, 9);
    P.add(g);
    const pyr = new THREE.Mesh(new THREE.ConeGeometry(35.4 / Math.SQRT2, 21.6, 4, 1), mat('#9fc0cf', 0.12, { metalness: 0.45, transparent: true, opacity: 0.85 }));
    pyr.rotation.y = Math.PI / 4;
    pyr.position.set(0, 10.8, 0);
    P.add(pyr);
    // Its steel frame: the four ridges.
    for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]] as const) {
      const a = new THREE.Vector3(sx * 17.7, 0, sz * 17.7), b = new THREE.Vector3(0, 21.6, 0);
      const r = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, a.distanceTo(b), 5), mat('#4a5258', 0.5, { metalness: 0.6 }));
      r.position.copy(a).add(b).multiplyScalar(0.5);
      r.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
      P.add(r);
    }
    // The triangular pools round it.
    for (const [sx, sz] of [[0, -1], [0, 1], [-1, 0]] as const) {
      const pool = new THREE.Mesh(new THREE.BoxGeometry(sx ? 14 : 30, 0.4, sz ? 14 : 30), mat('#3d6273', 0.2));
      pool.position.set(sx * 30, 0.2, sz * 30);
      P.add(pool);
    }
  }
}
