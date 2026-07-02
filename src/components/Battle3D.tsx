import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { BattleUnit, BattleView } from '../lib/types';

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
}

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
export default function Battle3D({ view, phase, mapUrl, showMap = false }: Battle3DProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const showMapRef = useRef(showMap);
  showMapRef.current = showMap;
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
    applyMapRef.current = (on: boolean) => {
      if (on && mapTexture) {
        groundMat.map = mapTexture;
        groundMat.color.set('#e8e8e8'); // slightly dimmed so unit colors pop
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
    }
    const unitMeshes: UnitMesh[] = [];
    const ownedGeometries: THREE.BufferGeometry[] = [];
    const dummy = new THREE.Object3D();

    for (const unit of view.units) {
      const size = unit.size ?? 1;
      const shape = unit.shape;
      // Bigger figures (horses/ships/tanks) come in smaller, wider-spaced groups.
      const big = shape === 'ship' || shape === 'vehicle';
      const count = big ? Math.max(3, Math.round(5 * size)) : Math.max(9, Math.round(20 * size));
      const cols = Math.ceil(Math.sqrt(count * 1.6));
      const rows = Math.ceil(count / cols);
      const spacing = shape === 'ship' ? 2.6 : shape === 'vehicle' ? 2.2 : shape === 'cavalry' ? 1.4 : 0.95;

      const geo = unitFigureGeometry(shape);
      ownedGeometries.push(geo);
      const color = new THREE.Color(unit.side === 'a' ? view.sides.a.color : view.sides.b.color);
      const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.8 });
      const mesh = new THREE.InstancedMesh(geo, mat, count);
      mesh.castShadow = true;
      mesh.receiveShadow = true;

      for (let i = 0; i < count; i++) {
        const col = i % cols;
        const row = Math.floor(i / cols);
        dummy.position.set((col - cols / 2) * spacing, 0, (row - rows / 2) * spacing);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;

      const start = unit.pos[0];
      const floats = shape === 'ship';
      const sx = toWorldX(start[0]);
      const sz = toWorldZ(start[1]);
      mesh.position.set(sx, floats ? 0 : heightAt(sx, sz), sz);
      scene.add(mesh);
      unitMeshes.push({
        mesh,
        target: mesh.position.clone(),
        posList: unit.pos,
        floats,
      });
    }

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
    const animate = () => {
      // When the phase changes, retarget every unit.
      if (phaseRef.current !== lastPhase) {
        lastPhase = phaseRef.current;
        for (const u of unitMeshes) {
          const p = u.posList[Math.min(lastPhase, u.posList.length - 1)] ?? u.posList[0];
          u.target.set(toWorldX(p[0]), 0, toWorldZ(p[1]));
        }
      }
      for (const u of unitMeshes) {
        u.mesh.position.lerp(u.target, 0.05);
        // Keep formations standing on the terrain (ships stay on the water).
        u.mesh.position.y = u.floats ? 0 : heightAt(u.mesh.position.x, u.mesh.position.z);
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
      applyMapRef.current = () => {};
      for (const g of ownedGeometries) g.dispose();
      for (const u of unitMeshes) (u.mesh.material as THREE.Material).dispose();
      if (renderer.domElement.parentNode === container) container.removeChild(renderer.domElement);
    };
  }, [view, mapUrl]);

  // Flip the ground texture when the user toggles the map button.
  useEffect(() => {
    applyMapRef.current(showMap);
  }, [showMap]);

  return <div className="battle3d" ref={containerRef} />;
}
