import * as THREE from 'three';
import {
  orbitAngle,
  orbitCenterX,
  orbitSlot,
  rotationToFront,
  wrapIndex,
  type HeroSceneItem,
  type OrbitOptions,
} from './hero-3d-utils';

// Vanilla three.js (no React): Hero3D receives this module through a dynamic
// import() only on devices that get the 3D hero, so three.js stays out of
// every other bundle.

export type HeroSceneOptions = {
  /** The card shown at the front first. */
  initialIndex: number;
  /** Element whose pointer movement drives the parallax (the hero region). */
  pointerTarget: HTMLElement;
  /** A card was clicked on the canvas. */
  onPick: (index: number) => void;
  /** Every poster texture has loaded or failed: the scene looks final. */
  onReady?: () => void;
  /** Called once when the scene cannot continue (e.g. WebGL context lost). */
  onError?: (error: Error) => void;
};

export type HeroScene = {
  /** Turns the orbit so `index` comes to the front. */
  select: (index: number) => void;
  /** How far the hero has scrolled out of view (0..1). */
  setScrollProgress: (progress: number) => void;
  dispose: () => void;
};

const POSTER_BASE_URL = 'https://image.tmdb.org/t/p/w342';
const CARD_WIDTH = 1.6;
const CARD_HEIGHT = 2.4;
const ORBIT: OrbitOptions = {
  radiusX: 1.9,
  radiusZ: 2.2,
  lift: 0.9,
  yawFactor: 0.45,
};
const CAMERA_Z = 7.5;
const FOV = 40;
/** The orbit centre: a little above the middle, clear of the text below. */
const CENTER_Y = 0.15;
const CENTER_Z = -1;
const MAX_PIXEL_RATIO = 1.75;
const PLACEHOLDER = 0x3a3a44;
/** Brand orange (--primary). */
const ACCENT = 0xf78c1f;
const FOCUS_SCALE = 0.16;
const FOCUS_PULL = 0.5;
const HOVER_SCALE = 0.05;
const BACK_OPACITY = 0.45;
const PARALLAX_X = 0.6;
const PARALLAX_Y = 0.35;
const SCROLL_DOLLY = 3;
const SCROLL_TILT = 0.35;
const SCROLL_SPIN = 0.6;
const PARTICLE_COUNT = 180;

/**
 * The same image under a separate HTTP cache entry, used for every texture.
 * image.tmdb.org sends `Access-Control-Allow-Origin` only to requests with an
 * Origin header, and no `Vary: Origin`. The site's plain <img>s (no
 * crossOrigin) therefore cache a CORS-less copy of a URL for about a year,
 * and a CORS texture request for that same URL is served the copy and fails.
 * A distinct query is a distinct cache entry, so the texture request never
 * meets the poisoned one.
 */
function withCacheKey(url: string): string {
  return `${url}${url.includes('?') ? '&' : '?'}cors=1`;
}

/** A 2D canvas, or null where there is none (jsdom, blocked canvas). */
function canvas2d(
  width: number,
  height: number
): CanvasRenderingContext2D | null {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  try {
    return canvas.getContext('2d');
  } catch {
    return null;
  }
}

/** White rounded rectangle on black: an alpha map for rounded cards. */
function roundedCornerMap(): THREE.CanvasTexture | null {
  const ctx = canvas2d(64, 96);
  if (!ctx) return null;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, 64, 96);
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.roundRect(0, 0, 64, 96, 4);
  ctx.fill();
  return new THREE.CanvasTexture(ctx.canvas);
}

/** Soft radial light in the brand colour, fading to transparent. */
function glowMap(): THREE.CanvasTexture | null {
  const ctx = canvas2d(128, 128);
  if (!ctx) return null;
  const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);
  const texture = new THREE.CanvasTexture(ctx.canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createHeroScene(
  container: HTMLElement,
  items: HeroSceneItem[],
  { initialIndex, pointerTarget, onPick, onReady, onError }: HeroSceneOptions
): HeroScene {
  const count = items.length;
  // Throws when WebGL2 is unavailable; nothing is attached yet, so the caller
  // only has to fall back. Default power preference: a decorative scene
  // should not wake the discrete GPU on dual-GPU laptops. Transparent, so
  // the HTML backdrop and the theme background show through.
  const renderer = new THREE.WebGLRenderer({
    antialias: window.devicePixelRatio < 2,
    alpha: true,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));
  renderer.setClearColor(0x000000, 0);
  const canvas = renderer.domElement;
  // Decorative: the HTML overlay and buttons are the accessible content.
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.display = 'block';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  // Vertical page scrolling must keep working over the canvas. No wheel or
  // touch listener is registered at all.
  canvas.style.touchAction = 'pan-y';
  container.append(canvas);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 40);
  camera.position.set(0, 0, CAMERA_Z);
  const lookTarget = new THREE.Vector3(0, CENTER_Y, CENTER_Z);

  // Everything that moves together with the orbit (cards, glow, particles).
  const stage = new THREE.Group();
  stage.position.set(0, CENTER_Y, CENTER_Z);
  scene.add(stage);

  const cornerMap = roundedCornerMap();
  const cardGeometry = new THREE.PlaneGeometry(CARD_WIDTH, CARD_HEIGHT);
  const meshes: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>[] = [];
  const textures = new Set<THREE.Texture>();
  const loader = new THREE.TextureLoader();
  // TMDB images send `Access-Control-Allow-Origin: *` to CORS requests.
  loader.setCrossOrigin('anonymous');
  let disposed = false;
  let settled = 0;
  let loggedTextureError = false;
  // Invisible progress signal (read by the e2e tests).
  canvas.dataset.texturesTotal = String(count);
  canvas.dataset.texturesLoaded = '0';

  const settle = () => {
    settled += 1;
    if (settled === count) onReady?.();
  };

  items.forEach((item, i) => {
    const material = new THREE.MeshBasicMaterial({
      color: PLACEHOLDER,
      alphaMap: cornerMap,
      transparent: true,
    });
    const mesh = new THREE.Mesh(cardGeometry, material);
    mesh.userData.index = i;
    meshes.push(mesh);
    stage.add(mesh);

    if (!item.posterPath) {
      settle();
      return;
    }
    const load = (url: string, retried: boolean) =>
      loader.load(
        url,
        (texture) => {
          // The scene may be gone by the time a poster arrives.
          if (disposed) {
            texture.dispose();
            return;
          }
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
          textures.add(texture);
          material.map = texture;
          material.color.setHex(0xffffff);
          material.needsUpdate = true;
          canvas.dataset.texturesLoaded = String(textures.size);
          settle();
        },
        undefined,
        () => {
          if (disposed) return;
          // One retry for transient network errors.
          if (!retried) {
            load(url, true);
            return;
          }
          // A missing poster keeps its placeholder colour; not worth failing
          // the scene for. Logged once per scene, not once per poster.
          if (!loggedTextureError) {
            loggedTextureError = true;
            console.error(
              '[hero-3d]',
              'Some posters could not be loaded as textures; they stay placeholders.'
            );
          }
          settle();
        }
      );
    load(withCacheKey(`${POSTER_BASE_URL}${item.posterPath}`), false);
  });
  if (count === 0) onReady?.();

  // A soft brand-coloured light behind the front card.
  const glowTexture = glowMap();
  const glowGeometry = new THREE.PlaneGeometry(7, 7);
  const glowMaterial = new THREE.MeshBasicMaterial({
    color: ACCENT,
    map: glowTexture,
    transparent: true,
    opacity: glowTexture ? 0.35 : 0,
    depthWrite: false,
  });
  const glow = new THREE.Mesh(glowGeometry, glowMaterial);
  glow.position.set(0, 0.2, -ORBIT.radiusZ);
  glow.renderOrder = -1;
  stage.add(glow);

  // Drifting specks give the empty space depth when the pointer moves.
  const particlePositions = new Float32Array(PARTICLE_COUNT * 3);
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    particlePositions[i * 3] = (Math.random() - 0.5) * 16;
    particlePositions[i * 3 + 1] = (Math.random() - 0.5) * 8;
    particlePositions[i * 3 + 2] = (Math.random() - 0.5) * 10;
  }
  const particleGeometry = new THREE.BufferGeometry();
  particleGeometry.setAttribute(
    'position',
    new THREE.BufferAttribute(particlePositions, 3)
  );
  const particleMaterial = new THREE.PointsMaterial({
    color: ACCENT,
    size: 0.035,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
  });
  const particles = new THREE.Points(particleGeometry, particleMaterial);
  stage.add(particles);

  // Interaction state. Everything the loop touches is allocated here, never
  // per frame.
  const raycaster = new THREE.Raycaster();
  const hits: THREE.Intersection[] = [];
  const ndc = new THREE.Vector2();
  const parallax = new THREE.Vector2();
  const parallaxTarget = new THREE.Vector2();
  const focus = new Float32Array(count);
  const hover = new Float32Array(count);
  let selected = wrapIndex(initialIndex, count);
  let rotation = rotationToFront(selected, count, 0);
  let targetRotation = rotation;
  let hovered = -1;
  let scrollProgress = 0;
  let shownScroll = 0;
  let centerX = 0;

  function pick(event: MouseEvent): number {
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return -1;
    ndc.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );
    // The camera is not part of the scene graph, so update it separately.
    camera.updateMatrixWorld();
    scene.updateMatrixWorld();
    raycaster.setFromCamera(ndc, camera);
    hits.length = 0;
    raycaster.intersectObjects(meshes, false, hits);
    return hits.length > 0 ? (hits[0].object.userData.index as number) : -1;
  }

  const onPointerMove = (event: PointerEvent) => {
    if (event.pointerType === 'touch') return;
    const rect = pointerTarget.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    parallaxTarget.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );
  };
  const onPointerLeave = () => {
    parallaxTarget.set(0, 0);
    hovered = -1;
    canvas.style.cursor = '';
  };
  // Picking runs on pointer events over the canvas, not every frame.
  const onCanvasMove = (event: PointerEvent) => {
    hovered = pick(event);
    canvas.style.cursor = hovered >= 0 ? 'pointer' : '';
  };
  const onCanvasLeave = () => {
    hovered = -1;
    canvas.style.cursor = '';
  };
  const onClick = (event: MouseEvent) => {
    const index = pick(event);
    if (index >= 0) onPick(index);
  };
  const onContextLost = () => {
    stop();
    onError?.(new Error('WebGL context lost'));
  };
  pointerTarget.addEventListener('pointermove', onPointerMove);
  pointerTarget.addEventListener('pointerleave', onPointerLeave);
  canvas.addEventListener('pointermove', onCanvasMove);
  canvas.addEventListener('pointerleave', onCanvasLeave);
  canvas.addEventListener('click', onClick);
  canvas.addEventListener('webglcontextlost', onContextLost);

  const resize = () => {
    const { clientWidth: width, clientHeight: height } = container;
    if (width === 0 || height === 0) return;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    centerX = orbitCenterX(
      camera.aspect,
      FOV,
      CAMERA_Z - (CENTER_Z + ORBIT.radiusZ)
    );
  };
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(container);
  resize();

  const timer = new THREE.Timer();
  timer.connect(document); // no huge delta after the tab was hidden

  const tick = (timestamp: number) => {
    timer.update(timestamp);
    const dt = Math.min(timer.getDelta(), 0.1);
    const time = timer.getElapsed();
    // Exponential smoothing that is independent of the frame rate.
    const k = 1 - Math.pow(0.002, dt);
    const slow = 1 - Math.pow(0.05, dt);

    rotation += (targetRotation - rotation) * k;
    shownScroll += (scrollProgress - shownScroll) * k;
    parallax.x += (parallaxTarget.x - parallax.x) * slow;
    parallax.y += (parallaxTarget.y - parallax.y) * slow;

    // The camera moves (not just turns) with the pointer: near cards shift
    // more than far ones, which is what reads as depth.
    camera.position.set(
      parallax.x * PARALLAX_X,
      parallax.y * PARALLAX_Y,
      CAMERA_Z + shownScroll * SCROLL_DOLLY
    );
    lookTarget.set(centerX * 0.35, CENTER_Y, CENTER_Z);
    camera.lookAt(lookTarget);

    stage.position.x = centerX;
    stage.rotation.x = shownScroll * SCROLL_TILT;
    stage.rotation.y = Math.sin(time * 0.2) * 0.04;
    particles.rotation.y = time * 0.02;

    const spin = rotation + shownScroll * SCROLL_SPIN;
    for (let i = 0; i < count; i++) {
      focus[i] += ((i === selected ? 1 : 0) - focus[i]) * k;
      hover[i] += ((i === hovered ? 1 : 0) - hover[i]) * k;
      const slot = orbitSlot(orbitAngle(i, count) + spin, ORBIT);
      const mesh = meshes[i];
      // Each card floats on its own phase.
      const bob = Math.sin(time * 0.8 + i * 1.7) * 0.06;
      mesh.position.set(slot.x, slot.y + bob, slot.z + focus[i] * FOCUS_PULL);
      mesh.rotation.set(Math.sin(time * 0.6 + i) * 0.03, slot.yaw, 0);
      mesh.scale.setScalar(1 + FOCUS_SCALE * focus[i] + HOVER_SCALE * hover[i]);
      mesh.material.opacity =
        1 - (1 - BACK_OPACITY) * slot.depth * (1 - focus[i]);
    }

    renderer.render(scene, camera);
  };

  // Pause while off screen or in a hidden tab.
  let onScreen = false;
  let running = false;
  function stop() {
    if (!running) return;
    running = false;
    renderer.setAnimationLoop(null);
  }
  function sync() {
    const shouldRun = onScreen && !document.hidden && !disposed;
    if (shouldRun === running) return;
    if (shouldRun) {
      running = true;
      renderer.setAnimationLoop(tick);
    } else {
      stop();
    }
  }
  const intersectionObserver = new IntersectionObserver(([entry]) => {
    onScreen = entry.isIntersecting;
    sync();
  });
  intersectionObserver.observe(container);
  document.addEventListener('visibilitychange', sync);

  return {
    select(index) {
      if (disposed || count === 0) return;
      selected = wrapIndex(index, count);
      targetRotation = rotationToFront(selected, count, targetRotation);
    },
    setScrollProgress(value) {
      scrollProgress = Math.min(1, Math.max(0, value));
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      stop();
      intersectionObserver.disconnect();
      resizeObserver.disconnect();
      document.removeEventListener('visibilitychange', sync);
      pointerTarget.removeEventListener('pointermove', onPointerMove);
      pointerTarget.removeEventListener('pointerleave', onPointerLeave);
      canvas.removeEventListener('pointermove', onCanvasMove);
      canvas.removeEventListener('pointerleave', onCanvasLeave);
      canvas.removeEventListener('click', onClick);
      canvas.removeEventListener('webglcontextlost', onContextLost);
      timer.dispose();

      for (const mesh of meshes) mesh.material.dispose();
      textures.forEach((texture) => texture.dispose());
      textures.clear();
      cornerMap?.dispose();
      cardGeometry.dispose();
      glowTexture?.dispose();
      glowGeometry.dispose();
      glowMaterial.dispose();
      particleGeometry.dispose();
      particleMaterial.dispose();
      stage.clear();
      scene.clear();

      renderer.dispose();
      // Frees the context now instead of when GC runs: browsers cap live
      // WebGL contexts, and every Home visit creates a new one.
      renderer.forceContextLoss();
      canvas.remove();
    },
  };
}
