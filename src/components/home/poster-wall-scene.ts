import * as THREE from 'three';
import { wallLayout, type WallItem } from './poster-wall-utils';

// Vanilla three.js (no React): the enhancer loads this module with import()
// only when the 3D wall will actually be shown, so three.js stays out of
// every other bundle.

export type PosterWallOptions = {
  onSelect: (item: WallItem) => void;
  /** Called once when the scene cannot continue (e.g. WebGL context lost). */
  onError?: (error: Error) => void;
  reducedMotion: boolean;
  /** Stage and fog colour: the page background (any CSS colour). */
  background: string;
};

export type PosterWall = {
  /** Scroll progress (0..1) through the sticky track. */
  setProgress: (progress: number) => void;
  /** Follows a theme change without re-creating the scene. */
  setBackground: (cssColor: string) => void;
  dispose: () => void;
};

const POSTER_BASE_URL = 'https://image.tmdb.org/t/p/w342';
const CARD_WIDTH = 1.6;
const CARD_HEIGHT = 2.4;
const FALLBACK_BACKGROUND = 0x0b0b0f;
const PLACEHOLDER = 0x1c1c24;
const GLOW = 0xf97316;
const GLOW_OPACITY = 0.07;
const GLOW_OPACITY_GAIN = 0.08;
const HOVER_PULL = 0.12;
const HOVER_SCALE = 0.18;
const DIM = 0.45;
const CAMERA_Z_END = -5.5;
const FOV_START = 55;
const FOV_END = 43;
const LOOK_YAW = 0.25;
const LOOK_PITCH = 0.12;
/** Camera travel (as progress) after which the hovered card is re-picked. */
const REPICK_PROGRESS = 0.01;

let colorProbe: CanvasRenderingContext2D | null | undefined;

/**
 * Reads any CSS colour into `target`. Theme tokens are oklch(), which
 * THREE.Color cannot parse, so the browser converts it: paint one pixel and
 * read it back as sRGB. Returns false (target unchanged) when unreadable.
 */
function readCssColor(css: string, target: THREE.Color): boolean {
  if (typeof CSS !== 'undefined' && !CSS.supports('color', css)) return false;
  if (colorProbe === undefined) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    try {
      colorProbe = canvas.getContext('2d', { willReadFrequently: true });
    } catch {
      colorProbe = null;
    }
  }
  if (!colorProbe) {
    // No 2D canvas (jsdom): THREE parses rgb()/hex/names itself and leaves
    // the colour unchanged for anything else. "Changed" is all callers need.
    const before = target.getHex();
    target.setStyle(css);
    return target.getHex() !== before;
  }
  colorProbe.clearRect(0, 0, 1, 1);
  colorProbe.fillStyle = css;
  colorProbe.fillRect(0, 0, 1, 1);
  const [r, g, b] = colorProbe.getImageData(0, 0, 1, 1).data;
  target.setRGB(r / 255, g / 255, b / 255, THREE.SRGBColorSpace);
  return true;
}

export function createPosterWall(
  container: HTMLElement,
  items: WallItem[],
  { onSelect, onError, reducedMotion, background }: PosterWallOptions
): PosterWall {
  // Throws when WebGL2 is unavailable; nothing is attached yet, so the caller
  // only has to fall back.
  // Default power preference: a decorative scene should not wake the
  // discrete GPU on dual-GPU laptops.
  const renderer = new THREE.WebGLRenderer({
    antialias: window.devicePixelRatio < 2,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  const canvas = renderer.domElement;
  // Decorative: the HTML grid next to it is the accessible content.
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.display = 'block';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  // Vertical page scrolling must keep working over the canvas. No wheel or
  // touch listener is registered at all.
  canvas.style.touchAction = 'pan-y';
  container.append(canvas);

  const scene = new THREE.Scene();
  // One colour for the clear colour and the fog, so posters fade into the
  // page background in either theme. The glow stays brand orange.
  const fog = new THREE.Fog(FALLBACK_BACKGROUND, 6, 16);
  scene.fog = fog;
  readCssColor(background, fog.color);
  renderer.setClearColor(fog.color, 1);
  const camera = new THREE.PerspectiveCamera(FOV_START, 1, 0.1, 40);
  camera.rotation.order = 'YXZ';

  const group = new THREE.Group();
  scene.add(group);

  // One geometry shared by every poster; one material each, because hover
  // dims the others individually.
  const posterGeometry = new THREE.PlaneGeometry(CARD_WIDTH, CARD_HEIGHT);
  const slots = wallLayout(items.length, {
    cardWidth: CARD_WIDTH,
    cardHeight: CARD_HEIGHT,
  });
  const meshes: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>[] = [];
  const basePositions: THREE.Vector3[] = [];
  const textures = new Set<THREE.Texture>();
  const loader = new THREE.TextureLoader();
  // TMDB images send `Access-Control-Allow-Origin: *`.
  loader.setCrossOrigin('anonymous');
  let disposed = false;

  items.forEach((item, i) => {
    const material = new THREE.MeshBasicMaterial({ color: PLACEHOLDER });
    const mesh = new THREE.Mesh(posterGeometry, material);
    const slot = slots[i];
    mesh.position.set(slot.x, slot.y, slot.z);
    mesh.rotation.y = slot.rotationY;
    mesh.userData.index = i;
    basePositions.push(mesh.position.clone());
    meshes.push(mesh);
    group.add(mesh);

    loader.load(
      `${POSTER_BASE_URL}${item.posterPath}`,
      (texture) => {
        // The view may be gone by the time a poster arrives.
        if (disposed) {
          texture.dispose();
          return;
        }
        texture.colorSpace = THREE.SRGBColorSpace;
        textures.add(texture);
        material.map = texture;
        material.color.setHex(0xffffff);
        material.needsUpdate = true;
      },
      undefined,
      // A missing poster keeps its placeholder colour; not worth failing for.
      () => {}
    );
  });

  const glowGeometry = new THREE.PlaneGeometry(26, 12);
  const glowMaterial = new THREE.MeshBasicMaterial({
    color: GLOW,
    transparent: true,
    opacity: GLOW_OPACITY,
    depthWrite: false,
    fog: false,
  });
  const glow = new THREE.Mesh(glowGeometry, glowMaterial);
  glow.position.set(0, 0, -12);
  scene.add(glow);

  // Interaction state. Everything the loop touches is allocated here, never
  // per frame.
  const raycaster = new THREE.Raycaster();
  const hits: THREE.Intersection[] = [];
  const pointer = new THREE.Vector2();
  const look = new THREE.Vector2();
  const hover = new Float32Array(items.length);
  const dim = new Float32Array(items.length);
  let hovered = -1;
  let pointerInside = false;
  let progress = 0;
  let shownProgress = 0;
  let pickedAtProgress = 0;

  function updatePointer(event: MouseEvent) {
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return false;
    pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );
    return true;
  }

  function pick(): number {
    // The camera is not part of the scene graph, so update it separately.
    camera.updateMatrixWorld();
    scene.updateMatrixWorld();
    raycaster.setFromCamera(pointer, camera);
    hits.length = 0;
    raycaster.intersectObjects(meshes, false, hits);
    return hits.length > 0 ? (hits[0].object.userData.index as number) : -1;
  }

  function setHovered(index: number) {
    hovered = index;
    canvas.style.cursor = index >= 0 ? 'pointer' : '';
  }

  // Picking runs on pointer events, not every frame.
  const onPointerMove = (event: MouseEvent) => {
    if (!updatePointer(event)) return;
    pointerInside = true;
    pickedAtProgress = shownProgress;
    setHovered(pick());
  };
  const onPointerLeave = () => {
    pointerInside = false;
    setHovered(-1);
  };
  const onClick = (event: MouseEvent) => {
    if (!updatePointer(event)) return;
    const index = pick();
    if (index >= 0) onSelect(items[index]);
  };
  const onContextLost = () => {
    stop();
    onError?.(new Error('WebGL context lost'));
  };
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerleave', onPointerLeave);
  canvas.addEventListener('click', onClick);
  canvas.addEventListener('webglcontextlost', onContextLost);

  const resize = () => {
    const { clientWidth: width, clientHeight: height } = container;
    if (width === 0 || height === 0) return;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
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
    const k = 1 - Math.pow(0.001, dt);

    shownProgress += (progress - shownProgress) * k;
    camera.position.z = CAMERA_Z_END * shownProgress;
    const fov = FOV_START + (FOV_END - FOV_START) * shownProgress;
    if (Math.abs(camera.fov - fov) > 1e-3) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
    glowMaterial.opacity = GLOW_OPACITY + GLOW_OPACITY_GAIN * shownProgress;

    // Scrolling moves the camera under a still pointer: re-pick so the hover
    // (and the cursor) never refers to a card that is no longer under it.
    if (
      pointerInside &&
      Math.abs(shownProgress - pickedAtProgress) > REPICK_PROGRESS
    ) {
      pickedAtProgress = shownProgress;
      setHovered(pick());
    }

    // The camera turns towards the pointer (parallax).
    const targetX = pointerInside ? pointer.x : 0;
    const targetY = pointerInside ? pointer.y : 0;
    look.x += (targetX - look.x) * k;
    look.y += (targetY - look.y) * k;
    camera.rotation.y = -look.x * LOOK_YAW;
    camera.rotation.x = look.y * LOOK_PITCH;

    if (!reducedMotion) {
      group.rotation.y = Math.sin(time * 0.15) * 0.04;
      group.position.y = Math.sin(time * 0.4) * 0.08;
    }

    for (let i = 0; i < meshes.length; i++) {
      hover[i] += ((i === hovered ? 1 : 0) - hover[i]) * k;
      dim[i] += ((hovered >= 0 && i !== hovered ? 1 : 0) - dim[i]) * k;
      const mesh = meshes[i];
      // Move towards the axis (the camera) and grow.
      mesh.position.copy(basePositions[i]);
      mesh.position.x *= 1 - HOVER_PULL * hover[i];
      mesh.position.z *= 1 - HOVER_PULL * hover[i];
      mesh.scale.setScalar(1 + HOVER_SCALE * hover[i]);
      const brightness = 1 - DIM * dim[i];
      if (mesh.material.map) mesh.material.color.setScalar(brightness);
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
    setBackground(cssColor) {
      if (disposed || !readCssColor(cssColor, fog.color)) return;
      renderer.setClearColor(fog.color, 1);
    },
    setProgress(value) {
      progress = Math.min(1, Math.max(0, value));
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      stop();
      intersectionObserver.disconnect();
      resizeObserver.disconnect();
      document.removeEventListener('visibilitychange', sync);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerleave', onPointerLeave);
      canvas.removeEventListener('click', onClick);
      canvas.removeEventListener('webglcontextlost', onContextLost);
      timer.dispose();

      for (const mesh of meshes) {
        mesh.material.dispose();
        mesh.dispose();
      }
      textures.forEach((texture) => texture.dispose());
      textures.clear();
      posterGeometry.dispose();
      glowGeometry.dispose();
      glowMaterial.dispose();
      glow.dispose();
      group.clear();
      scene.clear();

      renderer.dispose();
      // Frees the context now instead of when GC runs: browsers cap live
      // WebGL contexts, and every Home visit creates a new one.
      renderer.forceContextLoss();
      canvas.remove();
    },
  };
}
