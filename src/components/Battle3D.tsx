import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { BattleUnit, BattleView } from '../lib/types';
import { loadSatellitePatch } from '../lib/satPatch';
import { figureCount, keepFraction } from '../lib/battleMath';

/** A box positioned by its centre, ready to merge into a unit model. */
function box(w: number, h: number, d: number, x: number, y: number, z: number): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(x, y, z);
  return g;
}

/**
 * Build the little 3D model that represents one figure in a unit, depending on
 * whether the unit is infantry, cavalry, a ship or a vehicle. Foot soldiers are
 * simple blocks; cavalry get a horse; ships and vehicles get a distinct hull.
 */
function unitFigureGeometry(shape: BattleUnit['shape']): THREE.BufferGeometry {
  if (shape === 'cavalry') {
    return mergeGeometries([
      box(0.55, 0.65, 1.5, 0, 0.55, 0), // horse body
      box(0.5, 0.5, 0.4, 0, 0.95, 0.75), // horse neck/head
      box(0.18, 0.6, 0.18, 0.18, 0.45, -0.6), // legs
      box(0.18, 0.6, 0.18, -0.18, 0.45, -0.6),
      box(0.18, 0.6, 0.18, 0.18, 0.45, 0.55),
      box(0.18, 0.6, 0.18, -0.18, 0.45, 0.55),
      box(0.45, 0.7, 0.4, 0, 1.2, 0), // rider torso
      box(0.26, 0.26, 0.26, 0, 1.68, 0), // rider head
    ])!;
  }
  if (shape === 'ship') {
    return mergeGeometries([
      box(1.5, 0.6, 3.6, 0, 0.5, 0), // hull
      box(1.0, 0.4, 0.9, 0, 0.95, -1.5), // stern castle
      box(0.9, 0.35, 0.7, 0, 0.9, 1.55), // bow
      box(0.12, 1.9, 0.12, 0, 1.5, 0.6), // main mast
      box(0.08, 1.3, 0.08, 0, 1.25, -1.0), // mizzen mast
      box(1.5, 1.0, 0.06, 0, 1.6, 0.6), // main sail
      box(1.0, 0.7, 0.05, 0, 1.3, -1.0), // mizzen sail
    ])!;
  }
  if (shape === 'vehicle') {
    return mergeGeometries([
      box(1.1, 0.42, 2.2, 0, 0.62, 0), // hull
      box(0.42, 0.5, 2.5, 0.72, 0.42, 0), // left track
      box(0.42, 0.5, 2.5, -0.72, 0.42, 0), // right track
      box(0.85, 0.42, 1.05, 0, 1.05, -0.18), // turret
      box(0.11, 0.11, 1.6, 0, 1.1, 1.0), // barrel
      box(0.3, 0.16, 0.3, 0.18, 1.34, -0.3), // cupola
    ])!;
  }
  if (shape === 'plane') {
    return mergeGeometries([
      box(0.5, 0.45, 2.6, 0, 0, 0.1), // fuselage
      box(3.0, 0.1, 0.7, 0, 0.02, 0.3), // wings
      box(1.2, 0.1, 0.4, 0, 0.3, -1.15), // tailplane
      box(0.08, 0.6, 0.5, 0, 0.4, -1.15), // fin
      box(0.4, 0.35, 0.5, 0, 0.28, 0.5), // canopy
    ])!;
  }
  // Infantry: torso + head + legs.
  return mergeGeometries([
    box(0.55, 0.8, 0.4, 0, 0.95, 0), // torso
    box(0.3, 0.3, 0.3, 0, 1.52, 0), // head
    box(0.5, 0.55, 0.35, 0, 0.28, 0), // legs
  ])!;
}

interface Battle3DProps {
  view: BattleView;
  /** Current phase index — units march toward their position for this phase. */
  phase: number;
  /** A historical map image to drape over the battlefield ground. */
  mapUrl?: string;
  /** Whether the historical map is currently shown. */
  showMap?: boolean;
  /** Whether the satellite ground drape is shown (stylised positions don't
   * always agree with real rivers). */
  showGround?: boolean;
  /** Real-world battle coordinates — used to drape satellite imagery of the
   * actual battlefield onto the ground. */
  lat?: number;
  lon?: number;
}

/** Cruising altitude for plane formations — they fly, everything else walks. */
const PLANE_ALT = 7;

/** Map battle-map coordinates (0..100, 0..70) into centred 3D world space. */
function toWorldX(x: number): number {
  return x - 50;
}
function toWorldZ(y: number): number {
  return y - 35;
}

/**
 * Build a smooth height function from the battle's terrain features: hills and
 * ridges rise out of the plain, seas sink below it. Used both to displace the
 * ground mesh and to keep units standing on the surface as they march.
 */
function makeHeightFn(terrain: BattleView['terrain']): (x: number, z: number) => number {
  const hills: Array<{ x: number; z: number; r: number; h: number }> = [];
  const ridges: Array<{ x: number; z: number; w: number; d: number }> = [];
  const seas: Array<{ x: number; z: number; w: number; d: number }> = [];
  for (const t of terrain ?? []) {
    const x = toWorldX(t.x ?? 50);
    const z = toWorldZ(t.y ?? 35);
    if (t.type === 'hill') hills.push({ x, z, r: t.r ?? 8, h: Math.min(3.6, (t.r ?? 8) * 0.38) });
    else if (t.type === 'ridge') ridges.push({ x, z, w: t.w ?? 40, d: t.h ?? 5 });
    else if (t.type === 'sea') seas.push({ x, z, w: t.w ?? 100, d: t.h ?? 20 });
  }
  return (x: number, z: number): number => {
    let y = 0;
    for (const h of hills) {
      const q = ((x - h.x) ** 2 + (z - h.z) ** 2) / (h.r * 0.75) ** 2;
      y += h.h * Math.exp(-q);
    }
    for (const r of ridges) {
      const q = ((x - r.x) / (r.w * 0.45)) ** 2 + ((z - r.z) / (r.d * 1.1)) ** 2;
      y += 2.4 * Math.exp(-q);
    }
    for (const s of seas) {
      // Smooth basin: fully sunken inside the rect, easing out at the edge.
      const ex = Math.max(0, Math.abs(x - s.x) - s.w / 2);
      const ez = Math.max(0, Math.abs(z - s.z) - s.d / 2);
      const edge = Math.max(0, 1 - (ex + ez) / 5);
      y -= 1.6 * edge;
    }
    return y;
  };
}

/**
 * Battle3D
 * --------
 * A Three.js scene for the flagship battles. Each unit is rendered as a block of
 * low-poly "soldiers" (an InstancedMesh formation) that smoothly marches to its
 * position for the current phase. The camera is a free orbit camera.
 */
export default function Battle3D({ view, phase, mapUrl, showMap = false, showGround = true, lat, lon }: Battle3DProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const showMapRef = useRef(showMap);
  showMapRef.current = showMap;
  const showGroundRef = useRef(showGround);
  showGroundRef.current = showGround;
  // Set by the scene effect; lets the toggle effect swap the ground texture
  // without rebuilding the whole scene.
  const applyMapRef = useRef<(on: boolean) => void>(() => {});

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#1a2230');
    scene.fog = new THREE.Fog('#1a2230', 80, 200);

    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
    camera.position.set(0, 55, 78);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.target.set(0, 0, 0);
    controls.maxPolarAngle = Math.PI / 2.1;
    controls.minDistance = 25;
    controls.maxDistance = 160;

    // --- Lighting --- (intensities tuned for ACES filmic tone mapping)
    scene.add(new THREE.HemisphereLight(0xcfe3ff, 0x40502f, 1.15));
    const sun = new THREE.DirectionalLight(0xffffff, 2.2);
    sun.position.set(40, 70, 30);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    // Shadow box must cover the whole 120x90 battlefield.
    sun.shadow.camera.left = -78;
    sun.shadow.camera.right = 78;
    sun.shadow.camera.top = 72;
    sun.shadow.camera.bottom = -72;
    sun.shadow.camera.near = 10;
    sun.shadow.camera.far = 250;
    sun.shadow.camera.updateProjectionMatrix();
    sun.shadow.bias = -0.0002;
    sun.shadow.normalBias = 0.5;
    scene.add(sun);

    // --- Weather and hour, seeded per battle so each field keeps its sky:
    // dawn light for some, dusk for others; rain in the temperate mud,
    // snow only where the latitude earns it (Stalingrad, take a bow). ---
    let wh = 7;
    for (const ch of view.id) wh = (wh * 31 + ch.charCodeAt(0)) | 0;
    const wRoll = ((wh >>> 8) & 255) / 255;
    const hRoll = ((wh >>> 16) & 255) / 255;
    const cold = lat !== undefined && Math.abs(lat) > 47;
    const weather: 'clear' | 'rain' | 'snow' =
      wRoll < 0.26 ? (cold && wRoll < 0.13 ? 'snow' : 'rain') : 'clear';
    if (hRoll < 0.22) {
      sun.position.set(80, 22, 10); // dawn attack — long light from the east
      sun.color.set('#ffc08a');
      sun.intensity = 1.7;
    } else if (hRoll > 0.8) {
      sun.position.set(-70, 18, 30); // dusk — the day is nearly spent
      sun.color.set('#ff9f6e');
      sun.intensity = 1.5;
    }
    let precip: THREE.Points | null = null;
    if (weather !== 'clear') {
      scene.fog = new THREE.Fog(weather === 'rain' ? 0x77828e : 0xbfc7d1, 70, 240);
      sun.intensity *= 0.55;
      const N = 900;
      const ppos = new Float32Array(N * 3);
      for (let i = 0; i < N; i++) {
        ppos[i * 3] = (Math.random() - 0.5) * 130;
        ppos[i * 3 + 1] = Math.random() * 42;
        ppos[i * 3 + 2] = (Math.random() - 0.5) * 100;
      }
      const pgeo = new THREE.BufferGeometry();
      pgeo.setAttribute('position', new THREE.BufferAttribute(ppos, 3));
      precip = new THREE.Points(
        pgeo,
        new THREE.PointsMaterial({
          color: weather === 'rain' ? '#9fb4c8' : '#ffffff',
          size: weather === 'rain' ? 0.28 : 0.5,
          transparent: true,
          opacity: weather === 'rain' ? 0.55 : 0.85,
          depthWrite: false,
        }),
      );
      scene.add(precip); // geometry + material disposed in the cleanup below
    }

    // --- Ground: a real 3D heightfield shaped by the battle's terrain. ---
    const heightAt = makeHeightFn(view.terrain);
    const groundMat = new THREE.MeshStandardMaterial({ color: '#46562f', roughness: 1 });
    const groundGeo = new THREE.PlaneGeometry(120, 90, 96, 72);
    {
      // Displace vertices: local (x, y) becomes world (x, -z), local z is up.
      const pos = groundGeo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        pos.setZ(i, heightAt(pos.getX(i), -pos.getY(i)));
      }
      groundGeo.computeVertexNormals();
    }
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // --- Historical map drape ---
    // When toggled on, the period map is textured onto the ground plane so the
    // soldier formations march across the real battle map.
    let mapTexture: THREE.Texture | null = null;
    let satTexture: THREE.Texture | null = null;
    applyMapRef.current = (on: boolean) => {
      if (on && mapTexture) {
        groundMat.map = mapTexture;
        groundMat.color.set('#e8e8e8'); // slightly dimmed so unit colors pop
      } else if (satTexture && showGroundRef.current) {
        // The REAL battlefield from above — satellite imagery of the site.
        groundMat.map = satTexture;
        groundMat.color.set('#cfcfcf');
      } else {
        groundMat.map = null;
        groundMat.color.set('#46562f');
      }
      groundMat.needsUpdate = true;
    };
    if (mapUrl) {
      new THREE.TextureLoader().load(mapUrl, (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
        mapTexture = tex;
        applyMapRef.current(showMapRef.current);
      });
    }
    // Coastal sites: the whole battle slides toward dry land (or toward open
    // water for fleets) so the formations stop wading. Applied once the
    // satellite patch has been read; the retarget loop adds it ever after.
    const landShift = new THREE.Vector3();
    if (lat !== undefined && lon !== undefined) {
      loadSatellitePatch(lat, lon, (patch, water) => {
        const tex = new THREE.CanvasTexture(patch);
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
        satTexture = tex;
        const naval = view.units.some((u) => u.shape === 'ship');
        const wrongFrac = naval ? 1 - water.frac : water.frac;
        if (wrongFrac > 0.12 && wrongFrac < 0.98) {
          const [cx, cz] = naval ? water.waterC : water.landC;
          landShift.set(
            THREE.MathUtils.clamp(cx, -26, 26),
            0,
            THREE.MathUtils.clamp(cz, -20, 20),
          );
          for (const u of unitMeshes) {
            u.mesh.position.x += landShift.x;
            u.mesh.position.z += landShift.z;
            if (!u.floats) u.mesh.position.y = heightAt(u.mesh.position.x, u.mesh.position.z);
            u.target.x += landShift.x;
            u.target.z += landShift.z;
          }
        }
        applyMapRef.current(showMapRef.current);
      });
    }

    // --- Terrain features (hills/ridges/seas are shaped into the ground
    // heightfield above; here we add the standing scenery). ---
    for (const t of view.terrain ?? []) {
      const wx = toWorldX(t.x ?? 50);
      const wz = toWorldZ(t.y ?? 35);
      if (t.type === 'forest') {
        // A grove of little conifers scattered over the forest rectangle.
        const w = t.w ?? 10;
        const d = t.h ?? 6;
        const count = Math.min(60, Math.max(14, Math.round((w * d) / 4)));
        const tree = new THREE.ConeGeometry(0.9, 2.6, 6);
        tree.translate(0, 1.3, 0);
        const trees = new THREE.InstancedMesh(
          tree,
          new THREE.MeshStandardMaterial({ color: '#2c5232', roughness: 1 }),
          count,
        );
        const d3 = new THREE.Object3D();
        for (let i = 0; i < count; i++) {
          const tx = wx + (Math.random() - 0.5) * w;
          const tz = wz + (Math.random() - 0.5) * d;
          d3.position.set(tx, heightAt(tx, tz), tz);
          const s = 0.7 + Math.random() * 0.7;
          d3.scale.set(s, s, s);
          d3.updateMatrix();
          trees.setMatrixAt(i, d3.matrix);
        }
        trees.castShadow = true;
        trees.receiveShadow = true;
        scene.add(trees);
      } else if (t.type === 'town') {
        // A cluster of houses with simple roofs.
        const r = t.r ?? 3;
        for (let i = 0; i < Math.max(4, Math.round(r * 2.2)); i++) {
          const hx = wx + (Math.random() - 0.5) * r * 1.8;
          const hz = wz + (Math.random() - 0.5) * r * 1.8;
          const hy = heightAt(hx, hz);
          const house = new THREE.Mesh(
            new THREE.BoxGeometry(1.5, 1.1, 1.2),
            new THREE.MeshStandardMaterial({ color: '#8a7a55', roughness: 1 }),
          );
          house.position.set(hx, hy + 0.55, hz);
          house.rotation.y = Math.random() * Math.PI;
          const roof = new THREE.Mesh(
            new THREE.ConeGeometry(1.15, 0.8, 4),
            new THREE.MeshStandardMaterial({ color: '#6b4a32', roughness: 1 }),
          );
          roof.position.set(hx, hy + 1.5, hz);
          roof.rotation.y = house.rotation.y + Math.PI / 4;
          house.castShadow = house.receiveShadow = true;
          roof.castShadow = true;
          scene.add(house, roof);
        }
      } else if (t.type === 'sea') {
        const m = new THREE.Mesh(
          new THREE.PlaneGeometry(t.w ?? 100, t.h ?? 20),
          new THREE.MeshStandardMaterial({
            color: '#1d3b54',
            roughness: 0.35,
            metalness: 0.1,
            transparent: true,
            opacity: 0.92,
          }),
        );
        m.rotation.x = -Math.PI / 2;
        m.position.set(wx, 0.02, toWorldZ(t.y ?? 10));
        m.receiveShadow = true;
        scene.add(m);
      }
    }

    // --- Units: each is a formation of small figures (foot/horse/ship/tank) ---
    interface UnitMesh {
      mesh: THREE.InstancedMesh;
      target: THREE.Vector3;
      posList: Array<[number, number]>;
      /** Ships ride the water surface instead of following the seabed. */
      floats: boolean;
      side: BattleUnit['side'];
      shape: BattleUnit['shape'];
      /** Formation-local (x, z) of each figure, for the marching bob. */
      base: Array<[number, number]>;
      /** Full-strength figure count — later phases show fewer (casualties). */
      fullCount: number;
      /** Per-figure gait offset so the formation doesn't bounce in unison. */
      phases: Float32Array;
      wasMoving: boolean;
    }
    const unitMeshes: UnitMesh[] = [];
    const ownedGeometries: THREE.BufferGeometry[] = [];
    const dummy = new THREE.Object3D();

    for (const unit of view.units) {
      const size = unit.size ?? 1;
      const shape = unit.shape;
      // Bigger figures (horses/ships/tanks/planes) come in smaller, wider-spaced groups.
      const count = figureCount(shape, size);
      const cols = Math.ceil(Math.sqrt(count * 1.6));
      const rows = Math.ceil(count / cols);
      const spacing =
        shape === 'ship' ? 2.6 : shape === 'plane' ? 3.4 : shape === 'vehicle' ? 2.2 : shape === 'cavalry' ? 1.4 : 0.95;

      const geo = unitFigureGeometry(shape);
      ownedGeometries.push(geo);
      const color = new THREE.Color(unit.side === 'a' ? view.sides.a.color : view.sides.b.color);
      const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.8 });
      const mesh = new THREE.InstancedMesh(geo, mat, count);
      mesh.castShadow = true;
      mesh.receiveShadow = true;

      const base: Array<[number, number]> = [];
      const phases = new Float32Array(count);
      for (let i = 0; i < count; i++) {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const bx = (col - cols / 2) * spacing;
        const bz = (row - rows / 2) * spacing;
        base.push([bx, bz]);
        phases[i] = Math.random() * Math.PI * 2;
        dummy.position.set(bx, 0, bz);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;

      const start = unit.pos[0];
      const floats = shape === 'ship';
      const flies = shape === 'plane';
      const sx = toWorldX(start[0]);
      const sz = toWorldZ(start[1]);
      mesh.position.set(sx, floats ? 0 : flies ? PLANE_ALT : heightAt(sx, sz), sz);
      scene.add(mesh);
      unitMeshes.push({
        mesh,
        target: mesh.position.clone(),
        posList: unit.pos,
        floats,
        side: unit.side,
        shape,
        base,
        phases,
        fullCount: count,
        wasMoving: false,
      });
    }

    // --- The fallen: casualties don't vanish, they stay on the field where
    // their formation stood — rebuilt each phase from the depletion math. ---
    const guns = view.units.some(
      (x) => x.shape === 'vehicle' || x.shape === 'plane' || x.shape === 'ship',
    );
    const fallenGeo = box(0.8, 0.1, 0.34, 0, 0.05, 0);
    ownedGeometries.push(fallenGeo);
    const mkFallen = (side: 'a' | 'b') => {
      const c = new THREE.Color(view.sides[side].color).multiplyScalar(0.5);
      const m = new THREE.InstancedMesh(
        fallenGeo,
        new THREE.MeshStandardMaterial({ color: c, roughness: 1 }),
        400,
      );
      m.count = 0;
      m.receiveShadow = true;
      scene.add(m);
      return m;
    };
    const fallen = { a: mkFallen('a'), b: mkFallen('b') };
    const rebuildFallen = () => {
      const counts = { a: 0, b: 0 };
      for (const u of unitMeshes) {
        if (u.floats) continue; // the sea keeps its dead
        const lost = u.fullCount - u.mesh.count;
        const m = fallen[u.side];
        for (let i = 0; i < lost; i++) {
          const idx = counts[u.side]++;
          if (idx >= 400) break;
          // Stable scatter around where the formation now stands.
          const ang = u.phases[i % u.phases.length] * 2;
          const rad = 1.5 + ((i * 37) % 100) / 16;
          const x = u.target.x + Math.cos(ang) * rad;
          const z = u.target.z + Math.sin(ang) * rad * 0.7;
          dummy.position.set(x, heightAt(x, z) + 0.06, z);
          dummy.rotation.set(0, ang * 3, 0);
          dummy.updateMatrix();
          m.setMatrixAt(idx, dummy.matrix);
        }
      }
      fallen.a.count = Math.min(counts.a, 400);
      fallen.b.count = Math.min(counts.b, 400);
      fallen.a.instanceMatrix.needsUpdate = true;
      fallen.b.instanceMatrix.needsUpdate = true;
    };

    // --- Life pass: dust of the march. A small recycled pool of soft sprites
    // puffed up behind formations while they move. ---
    const dustTex = (() => {
      const c = document.createElement('canvas');
      c.width = c.height = 64;
      const g = c.getContext('2d')!;
      const grad = g.createRadialGradient(32, 32, 2, 32, 32, 30);
      grad.addColorStop(0, 'rgba(255,255,255,0.85)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grad;
      g.fillRect(0, 0, 64, 64);
      const tex = new THREE.CanvasTexture(c);
      return tex;
    })();
    interface Puff {
      s: THREE.Sprite;
      life: number;
      max: number;
      vx: number;
      vy: number;
      vz: number;
      /** Peak opacity and scale growth — dust billows, smoke drifts, muzzle
       * flashes snap bright and die fast. */
      baseO: number;
      grow: number;
      startScale: number;
    }
    const puffs: Puff[] = [];
    for (let i = 0; i < 96; i++) {
      const m = new THREE.SpriteMaterial({
        map: dustTex,
        color: '#c6b489',
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      const s = new THREE.Sprite(m);
      s.visible = false;
      scene.add(s);
      puffs.push({ s, life: 0, max: 0, vx: 0, vy: 0, vz: 0, baseO: 0.34, grow: 3.2, startScale: 1.4 });
    }
    let puffCursor = 0;
    interface PuffOpts {
      color?: string;
      life?: number;
      vx?: number;
      vy?: number;
      vz?: number;
      baseO?: number;
      grow?: number;
      scale?: number;
      additive?: boolean;
    }
    const emitPuff = (x: number, y: number, z: number, o: PuffOpts) => {
      const p = puffs[puffCursor++ % puffs.length];
      const m = p.s.material as THREE.SpriteMaterial;
      m.color.set(o.color ?? '#c6b489');
      m.blending = o.additive ? THREE.AdditiveBlending : THREE.NormalBlending;
      p.life = 0;
      p.max = o.life ?? 0.9 + Math.random() * 0.6;
      p.vx = o.vx ?? (Math.random() - 0.5) * 0.6;
      p.vy = o.vy ?? 0.5 + Math.random() * 0.4;
      p.vz = o.vz ?? (Math.random() - 0.5) * 0.6;
      p.baseO = o.baseO ?? 0.34;
      p.grow = o.grow ?? 3.2;
      p.startScale = o.scale ?? 1.4;
      p.s.position.set(x, y, z);
      p.s.scale.setScalar(p.startScale);
      p.s.visible = true;
    };
    const emitDust = (x: number, y: number, z: number, spread: number) => {
      emitPuff(
        x + (Math.random() - 0.5) * spread,
        y + 0.3,
        z + (Math.random() - 0.5) * spread,
        {},
      );
    };

    // --- Life pass: a waving banner follows each side's lead formation. ---
    const bannerParts: Array<{
      group: THREE.Group;
      flagGeo: THREE.PlaneGeometry;
      follow: UnitMesh | undefined;
      phase: number;
    }> = [];
    const ownedBannerResources: Array<{ dispose: () => void }> = [];
    (['a', 'b'] as const).forEach((sideKey, sideIdx) => {
      const follow = unitMeshes.find((u) => u.side === sideKey && !u.floats);
      if (!follow) return;
      const sideInfo = view.sides[sideKey];
      const c = document.createElement('canvas');
      c.width = 128;
      c.height = 80;
      const g = c.getContext('2d')!;
      g.fillStyle = sideInfo.color;
      g.fillRect(0, 0, 128, 80);
      g.strokeStyle = 'rgba(0,0,0,0.4)';
      g.lineWidth = 8;
      g.strokeRect(0, 0, 128, 80);
      g.fillStyle = 'rgba(255,255,255,0.92)';
      g.font = 'bold 46px "Segoe UI", sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(sideInfo.name.charAt(0).toUpperCase(), 64, 42);
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      const flagGeo = new THREE.PlaneGeometry(2.1, 1.25, 12, 6);
      flagGeo.translate(1.05, 0, 0); // hoist at the pole
      const flagMat = new THREE.MeshStandardMaterial({
        map: tex,
        side: THREE.DoubleSide,
        roughness: 0.9,
      });
      const flag = new THREE.Mesh(flagGeo, flagMat);
      flag.position.set(0, 4.0, 0);
      flag.castShadow = true;
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.06, 4.8, 6),
        new THREE.MeshStandardMaterial({ color: '#5a4632', roughness: 1 }),
      );
      pole.position.y = 2.4;
      pole.castShadow = true;
      const group = new THREE.Group();
      group.add(pole, flag);
      scene.add(group);
      bannerParts.push({ group, flagGeo, follow, phase: sideIdx * 1.7 });
      ownedBannerResources.push({ dispose: () => { tex.dispose(); flagGeo.dispose(); flagMat.dispose(); pole.geometry.dispose(); (pole.material as THREE.Material).dispose(); } });
    });

    // --- Resize handling ---
    const resize = () => {
      const w = container.clientWidth || 1;
      const h = container.clientHeight || 1;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);

    if (import.meta.env.DEV) {
      (window as unknown as { __b3d?: object }).__b3d = { renderer, scene, camera };
    }

    // --- Animation loop ---
    let raf = 0;
    let lastPhase = -1;
    const clock = new THREE.Clock();
    const animate = () => {
      const dt = Math.min(0.05, clock.getDelta());
      const t = clock.elapsedTime;

      // When the phase changes, retarget every unit — and thin the ranks:
      // battles cost soldiers, so later phases show visibly fewer figures
      // (the beaten side loses more when the outcome names one).
      if (phaseRef.current !== lastPhase) {
        lastPhase = phaseRef.current;
        const span = Math.max(1, view.phases.length - 1);
        const frac = Math.min(1, lastPhase / span);
        for (const u of unitMeshes) {
          const p = u.posList[Math.min(lastPhase, u.posList.length - 1)] ?? u.posList[0];
          u.target.set(toWorldX(p[0]) + landShift.x, 0, toWorldZ(p[1]) + landShift.z);
          u.mesh.count = Math.max(
            2,
            Math.round(u.fullCount * keepFraction(frac, view.loser === u.side, view.severity)),
          );
        }
        rebuildFallen();
      }
      for (const u of unitMeshes) {
        const dx = u.target.x - u.mesh.position.x;
        const dz = u.target.z - u.mesh.position.z;
        const moving = dx * dx + dz * dz > 0.05;

        u.mesh.position.lerp(u.target, 0.05);
        // Keep formations standing on the terrain (ships stay on the water,
        // squadrons hold their altitude).
        u.mesh.position.y = u.floats
          ? 0
          : u.shape === 'plane'
            ? PLANE_ALT + Math.sin(t * 1.3 + u.phases[0]) * 0.5
            : heightAt(u.mesh.position.x, u.mesh.position.z);

        // Face the direction of travel (smoothly, shortest way round).
        if (moving) {
          const want = Math.atan2(dx, dz);
          let delta = want - u.mesh.rotation.y;
          delta = Math.atan2(Math.sin(delta), Math.cos(delta));
          u.mesh.rotation.y += delta * 0.06;
        }

        // Marching bob for feet and hooves (ships glide, tanks rumble flat,
        // planes hold formation).
        if ((moving || u.wasMoving) && !u.floats && u.shape !== 'vehicle' && u.shape !== 'plane') {
          const gait = u.shape === 'cavalry' ? 11 : 7.5;
          const lift = u.shape === 'cavalry' ? 0.11 : 0.07;
          for (let i = 0; i < u.base.length; i++) {
            const [bx, bz] = u.base[i];
            const bob = moving ? Math.abs(Math.sin(t * gait + u.phases[i])) * lift : 0;
            dummy.position.set(bx, bob, bz);
            dummy.rotation.set(0, 0, 0);
            dummy.updateMatrix();
            u.mesh.setMatrixAt(i, dummy.matrix);
          }
          u.mesh.instanceMatrix.needsUpdate = true;
        }

        // Marching feet kick up dust behind the formation (not at altitude).
        if (moving && !u.floats && u.shape !== 'plane' && Math.random() < (u.shape === 'cavalry' ? 0.5 : 0.3)) {
          emitDust(u.mesh.position.x, u.mesh.position.y, u.mesh.position.z, u.base.length > 24 ? 5 : 3);
        }
        u.wasMoving = moving;
      }

      // Drift, swell and fade the dust.
      for (const p of puffs) {
        if (!p.s.visible) continue;
        p.life += dt;
        if (p.life >= p.max) {
          p.s.visible = false;
          continue;
        }
        const k = p.life / p.max;
        p.s.position.x += p.vx * dt;
        p.s.position.y += p.vy * dt;
        p.s.position.z += p.vz * dt;
        (p.s.material as THREE.SpriteMaterial).opacity = p.baseO * (1 - k);
        p.s.scale.setScalar(p.startScale + k * p.grow);
      }

      // --- The exchange: once the clash begins, engaged formations trade
      // fire — muzzle flashes and rolling smoke for the gunpowder ages,
      // boiling dust where lines meet steel-to-steel before that. ---
      if (lastPhase >= 1) {
        for (const u of unitMeshes) {
          if (Math.random() > 0.035) continue;
          let best: (typeof unitMeshes)[number] | null = null;
          let bd = Infinity;
          for (const e of unitMeshes) {
            if (e.side === u.side) continue;
            const d =
              (e.mesh.position.x - u.mesh.position.x) ** 2 +
              (e.mesh.position.z - u.mesh.position.z) ** 2;
            if (d < bd) {
              bd = d;
              best = e;
            }
          }
          if (!best || bd > 55 ** 2) continue;
          const dx = best.mesh.position.x - u.mesh.position.x;
          const dz = best.mesh.position.z - u.mesh.position.z;
          const len = Math.max(0.001, Math.hypot(dx, dz));
          const nx = dx / len;
          const nz = dz / len;
          if (guns) {
            const px = u.mesh.position.x + nx * 2.4;
            const py = u.mesh.position.y + (u.shape === 'plane' ? 0 : 1.0);
            const pz = u.mesh.position.z + nz * 2.4;
            emitPuff(px, py, pz, {
              color: '#ffd27a',
              additive: true,
              life: 0.14,
              baseO: 0.95,
              grow: 1.6,
              scale: 1.1,
              vx: nx * 2,
              vy: 0.4,
              vz: nz * 2,
            });
            emitPuff(px, py + 0.3, pz, {
              color: '#cdd2d6',
              life: 1.9,
              baseO: 0.3,
              grow: 4.2,
              scale: 1.2,
              vx: nx * 1.2 + (Math.random() - 0.5) * 0.4,
              vy: 0.7,
              vz: nz * 1.2 + (Math.random() - 0.5) * 0.4,
            });
          } else {
            emitDust(
              (u.mesh.position.x + best.mesh.position.x) / 2,
              Math.min(u.mesh.position.y, best.mesh.position.y) + 0.3,
              (u.mesh.position.z + best.mesh.position.z) / 2,
              4,
            );
          }
        }
      }

      // Rain falls hard, snow drifts sideways; both recycle at the top.
      if (precip) {
        const pp = precip.geometry.attributes.position as THREE.BufferAttribute;
        const fall = weather === 'rain' ? 34 : 5.5;
        for (let i = 0; i < pp.count; i++) {
          let y = pp.getY(i) - fall * dt;
          if (weather === 'snow') pp.setX(i, pp.getX(i) + Math.sin(t * 1.1 + i) * 0.02);
          if (y < 0) y = 42;
          pp.setY(i, y);
        }
        pp.needsUpdate = true;
      }

      // Banners follow their side's lead formation; cloth ripples in the wind.
      for (const b of bannerParts) {
        if (b.follow) {
          b.group.position.set(
            b.follow.mesh.position.x - 2.2,
            b.follow.mesh.position.y,
            b.follow.mesh.position.z - 2.2,
          );
        }
        const pos = b.flagGeo.attributes.position;
        for (let i = 0; i < pos.count; i++) {
          const x = pos.getX(i);
          const sway = Math.sin(x * 2.4 + t * 4.2 + b.phase) * 0.14 * (x / 2.1);
          pos.setZ(i, sway);
        }
        pos.needsUpdate = true;
        b.flagGeo.computeVertexNormals();
      }

      controls.update();
      renderer.render(scene, camera);
      raf = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      controls.dispose();
      renderer.dispose();
      mapTexture?.dispose();
      satTexture?.dispose();
      applyMapRef.current = () => {};
      for (const g of ownedGeometries) g.dispose();
      for (const u of unitMeshes) (u.mesh.material as THREE.Material).dispose();
      for (const p of puffs) (p.s.material as THREE.Material).dispose();
      dustTex.dispose();
      for (const r of ownedBannerResources) r.dispose();
      if (precip) {
        precip.geometry.dispose();
        (precip.material as THREE.Material).dispose();
      }
      (fallen.a.material as THREE.Material).dispose();
      (fallen.b.material as THREE.Material).dispose();
      if (renderer.domElement.parentNode === container) container.removeChild(renderer.domElement);
    };
  }, [view, mapUrl]);

  // Flip the ground texture when the user toggles the map or ground buttons.
  useEffect(() => {
    applyMapRef.current(showMap);
  }, [showMap, showGround]);

  return <div className="battle3d" ref={containerRef} />;
}
