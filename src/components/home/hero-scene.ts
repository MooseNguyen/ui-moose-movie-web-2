import * as THREE from 'three';
import {
  edgeFade,
  loopOffset,
  nearestFocus,
  type HeroSceneItem,
} from './hero-scene-layout';

// Vanilla three.js (no React): HeroStage loads this module with import() only
// when the 3D hero will actually be shown, so three.js stays out of every
// other bundle.

export type HeroSceneOptions = {
  /** Index of the slide selected when the scene starts. */
  initialIndex: number;
  /** A poster was clicked (the caller decides: select it or open it). */
  onPick: (index: number) => void;
  /** Called once when the scene cannot continue (e.g. WebGL context lost). */
  onError: (error: Error) => void;
};

export type HeroScene = {
  /** Turns the arc so this poster faces the camera. */
  select: (index: number) => void;
  /** How far the hero has scrolled out of view (0..1). */
  setScrollProgress: (progress: number) => void;
  dispose: () => void;
};

const POSTER_BASE_URL = 'https://image.tmdb.org/t/p/w342';
const POSTER_WIDTH = 1.6;
const POSTER_HEIGHT = 2.4;
const POSTER_RADIUS = 0.08;
const PLACEHOLDER = 0x3f3f46;
/** Brand amber (#f59e0b), the site's accent. */
const GLOW = 0xf59e0b;
const GLOW_OPACITY = 0.3;
const MAX_PIXEL_RATIO = 1.5;
const FOV = 38;
const CAMERA = new THREE.Vector3(-0.5, 0.5, 7.4);
// Looking left of the arc centre puts the selected poster right of the
// middle, away from the slide text.
const LOOK_AT = new THREE.Vector3(-0.5, 0.1, -1);

// The arc: posters on a cylinder whose axis is behind the selected one, so
// the neighbours recede and turn away on both sides.
const ARC_RADIUS = 6;
/** Angle between neighbouring posters on the arc. */
const ARC_STEP = 0.33;
/** Posters fade out this many slots away from the selected one. */
const ARC_VISIBLE = 3.6;
const ARC_TURN = 0.8;
const SELECT_SCALE = 0.22;
const SELECT_PUSH = 0.9;
const HOVER_SCALE = 0.06;
const HOVER_PUSH = 0.3;

// The drift layer: smaller copies of the same posters (no extra download)
// floating far behind the arc, for depth.
const DRIFT_COUNT = 14;
const DRIFT_SCALE = 0.55;
const DRIFT_OPACITY = 0.28;

const PARALLAX_X = 1.1;
const PARALLAX_Y = 0.5;
/** Arc slots turned while the hero scrolls out of view. */
const SCROLL_TURN = 1.5;
const SCROLL_PULL_BACK = 2.5;
const SCROLL_FADE = 0.75;

/**
 * The same image under a separate HTTP cache entry, used for every texture.
 * image.tmdb.org sends `Access-Control-Allow-Origin` only to requests with an
 * Origin header, and no `Vary: Origin`. The site's plain <img>s (no
 * crossOrigin) therefore cache a CORS-less copy of a URL for about a year,
 * and a CORS texture request for that same URL is served the copy and fails.
 * A distinct query is a distinct cache entry, so the texture request never
 * meets the poisoned one. Cost: a poster the slider also shows at w342
 * downloads twice, on desktop with 3D only.
 */
function withCacheKey(url: string): string {
  return `${url}${url.includes('?') ? '&' : '?'}cors=1`;
}

/** A poster plane with rounded corners and 0..1 UVs over the whole card. */
function createPosterGeometry(): THREE.ShapeGeometry {
  const w = POSTER_WIDTH;
  const h = POSTER_HEIGHT;
  const r = POSTER_RADIUS;
  const x = -w / 2;
  const y = -h / 2;
  const shape = new THREE.Shape()
    .moveTo(x + r, y)
    .lineTo(x + w - r, y)
    .quadraticCurveTo(x + w, y, x + w, y + r)
    .lineTo(x + w, y + h - r)
    .quadraticCurveTo(x + w, y + h, x + w - r, y + h)
    .lineTo(x + r, y + h)
    .quadraticCurveTo(x, y + h, x, y + h - r)
    .lineTo(x, y + r)
    .quadraticCurveTo(x, y, x + r, y);
  const geometry = new THREE.ShapeGeometry(shape, 4);
  // ShapeGeometry's UVs are the raw shape coordinates; map them to 0..1.
  const position = geometry.getAttribute('position');
  const uv = geometry.getAttribute('uv');
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, (position.getX(i) - x) / w, (position.getY(i) - y) / h);
  }
  uv.needsUpdate = true;
  return geometry;
}

/** A soft radial amber glow behind the selected poster (no texture needed). */
function createGlowMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(GLOW) },
      uOpacity: { value: GLOW_OPACITY },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uOpacity;
      varying vec2 vUv;
      void main() {
        float falloff = smoothstep(0.5, 0.0, distance(vUv, vec2(0.5)));
        gl_FragColor = vec4(uColor, falloff * falloff * uOpacity);
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    depthWrite: false,
  });
}

/** Deterministic pseudo-random 0..1 (same layout on every visit). */
const hash = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};

type PosterMesh = THREE.Mesh<THREE.ShapeGeometry, THREE.MeshBasicMaterial>;

export function createHeroScene(
  container: HTMLElement,
  items: HeroSceneItem[],
  { initialIndex, onPick, onError }: HeroSceneOptions
): HeroScene {
  // Throws when WebGL2 is unavailable; nothing is attached yet, so the caller
  // only has to fall back. Transparent: the hero backdrop shows through.
  // Default power preference: a decorative scene should not wake the
  // discrete GPU on dual-GPU laptops.
  const renderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: window.devicePixelRatio < 2,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));
  renderer.setClearColor(0x000000, 0);
  const canvas = renderer.domElement;
  // Decorative: the slider's HTML is the accessible content.
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.display = 'block';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  // Vertical page scrolling must keep working over the canvas. No wheel or
  // touch listener is registered at all.
  canvas.style.touchAction = 'pan-y';
  container.append(canvas);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 60);
  camera.position.copy(CAMERA);
  camera.lookAt(LOOK_AT);

  const glowGeometry = new THREE.PlaneGeometry(7, 7);
  const glowMaterial = createGlowMaterial();
  const glow = new THREE.Mesh(glowGeometry, glowMaterial);
  glow.position.set(0, 0.1, -1.4);
  glow.renderOrder = -1;
  scene.add(glow);

  const count = items.length;
  // One geometry shared by every poster; one material each, because the
  // opacity (fades, load fade-in) is per poster. Copies share the texture.
  const posterGeometry = createPosterGeometry();
  const posters: PosterMesh[] = [];
  const drifters: PosterMesh[] = [];
  /** Materials that show poster i: its arc poster plus its drift copies. */
  const materialsOf: THREE.MeshBasicMaterial[][] = [];
  // Per-poster animation state, allocated once (never per frame).
  const reveal = new Float32Array(count);
  const revealTarget = new Float32Array(count);
  const selection = new Float32Array(count);
  const hover = new Float32Array(count);

  const createMaterial = () =>
    new THREE.MeshBasicMaterial({
      color: PLACEHOLDER,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });

  items.forEach((item, i) => {
    const material = createMaterial();
    const mesh = new THREE.Mesh(posterGeometry, material);
    mesh.userData.index = i;
    posters.push(mesh);
    materialsOf.push([material]);
    scene.add(mesh);
    // A title without a poster keeps a placeholder card at once.
    if (!item.posterPath) revealTarget[i] = 1;
  });

  // Copies only of titles that have a poster: a grey card adds no depth.
  const withPoster = items.flatMap((item, i) => (item.posterPath ? [i] : []));
  if (withPoster.length > 0) {
    for (let j = 0; j < DRIFT_COUNT; j++) {
      const source = withPoster[j % withPoster.length];
      const material = createMaterial();
      const mesh = new THREE.Mesh(posterGeometry, material);
      mesh.userData.source = source;
      // Spread over a wide, deep box behind the arc, left and right of it.
      const side = j % 2 === 0 ? -1 : 1;
      mesh.position.set(
        side * (2.5 + hash(j) * 6),
        (hash(j + 50) - 0.5) * 6,
        -5 - hash(j + 100) * 7
      );
      mesh.rotation.set(0, side * -0.3, (hash(j + 150) - 0.5) * 0.3);
      mesh.userData.baseY = mesh.position.y;
      mesh.userData.baseYaw = mesh.rotation.y;
      mesh.scale.setScalar(DRIFT_SCALE);
      mesh.renderOrder = -2;
      drifters.push(mesh);
      materialsOf[source].push(material);
      scene.add(mesh);
    }
  }

  const textures = new Set<THREE.Texture>();
  const loader = new THREE.TextureLoader();
  // TMDB images send `Access-Control-Allow-Origin: *` to CORS requests.
  loader.setCrossOrigin('anonymous');
  const maxAnisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
  let disposed = false;
  let loggedTextureError = false;
  // Invisible progress signals (read by the e2e tests).
  canvas.dataset.texturesTotal = String(withPoster.length);
  canvas.dataset.texturesLoaded = '0';

  function loadPoster(i: number, url: string, retried: boolean) {
    loader.load(
      url,
      (texture) => {
        // The view may be gone by the time a poster arrives.
        if (disposed) {
          texture.dispose();
          return;
        }
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = maxAnisotropy;
        textures.add(texture);
        for (const material of materialsOf[i]) {
          material.map = texture;
          material.color.setHex(0xffffff);
          material.needsUpdate = true;
        }
        revealTarget[i] = 1;
        canvas.dataset.texturesLoaded = String(textures.size);
      },
      undefined,
      () => {
        if (disposed) return;
        // One retry for transient network errors.
        if (!retried) {
          loadPoster(i, url, true);
          return;
        }
        // A missing poster becomes a placeholder card; not worth failing the
        // scene for. Logged once per scene, not once per poster.
        revealTarget[i] = 1;
        if (!loggedTextureError) {
          loggedTextureError = true;
          console.error(
            '[home]',
            'Some hero posters could not be loaded as textures; they stay placeholders.'
          );
        }
      }
    );
  }

  // The selected poster and its neighbours first: they are the ones in view.
  const distanceFromStart = (i: number) =>
    Math.abs(loopOffset(i - initialIndex, count));
  [...withPoster]
    .sort((a, b) => distanceFromStart(a) - distanceFromStart(b))
    .forEach((i) =>
      loadPoster(
        i,
        withCacheKey(`${POSTER_BASE_URL}${items[i].posterPath}`),
        false
      )
    );

  // Interaction state.
  const raycaster = new THREE.Raycaster();
  const hits: THREE.Intersection[] = [];
  const pointer = new THREE.Vector2();
  const look = new THREE.Vector2();
  const lookTarget = new THREE.Vector2();
  let pointerInside = false;
  let hovered = -1;
  let selected = Math.min(Math.max(initialIndex, 0), Math.max(count - 1, 0));
  let focusTarget = selected;
  let focus = selected;
  let scrollTarget = 0;
  let scroll = 0;
  canvas.dataset.selected = String(selected);

  function updatePointer(event: MouseEvent): boolean {
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
    raycaster.intersectObjects(posters, false, hits);
    // Faded posters (towards the arc's ends) are not clickable.
    const hit = hits.find(
      (h) => (h.object as PosterMesh).material.opacity > 0.3
    );
    return hit ? (hit.object.userData.index as number) : -1;
  }

  function setHovered(index: number) {
    if (index === hovered) return;
    hovered = index;
    canvas.style.cursor = index >= 0 ? 'pointer' : '';
  }

  // Parallax follows the pointer anywhere on the page, not only the canvas.
  const onWindowPointerMove = (event: PointerEvent) => {
    lookTarget.set(
      (event.clientX / window.innerWidth) * 2 - 1,
      -(event.clientY / window.innerHeight) * 2 + 1
    );
  };
  const onPointerMove = (event: MouseEvent) => {
    pointerInside = updatePointer(event);
  };
  const onPointerLeave = () => {
    pointerInside = false;
    setHovered(-1);
  };
  const onClick = (event: MouseEvent) => {
    if (!updatePointer(event)) return;
    const index = pick();
    if (index >= 0) onPick(index);
  };
  const onContextLost = () => {
    stop();
    onError(new Error('WebGL context lost'));
  };
  window.addEventListener('pointermove', onWindowPointerMove, {
    passive: true,
  });
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
    const dt = Math.min(Math.max(timer.getDelta(), 0), 0.1);
    const time = timer.getElapsed();
    // Exponential smoothing that is independent of the frame rate.
    const k = 1 - Math.pow(0.03, dt);
    const kFast = 1 - Math.pow(0.0005, dt);

    focus += (focusTarget - focus) * k;
    scroll += (scrollTarget - scroll) * kFast;
    look.x += (lookTarget.x - look.x) * k;
    look.y += (lookTarget.y - look.y) * k;

    camera.position.set(
      CAMERA.x + look.x * PARALLAX_X,
      CAMERA.y + look.y * PARALLAX_Y,
      CAMERA.z + scroll * SCROLL_PULL_BACK
    );
    camera.lookAt(LOOK_AT);
    const sceneOpacity = 1 - scroll * SCROLL_FADE;
    glowMaterial.uniforms.uOpacity.value = GLOW_OPACITY * sceneOpacity;

    if (pointerInside) setHovered(pick());

    const arcFocus = focus + scroll * SCROLL_TURN;
    for (let i = 0; i < count; i++) {
      reveal[i] += (revealTarget[i] - reveal[i]) * k;
      selection[i] += ((i === selected ? 1 : 0) - selection[i]) * k;
      hover[i] += ((i === hovered ? 1 : 0) - hover[i]) * kFast;

      const offset = loopOffset(i - arcFocus, count);
      const angle = offset * ARC_STEP;
      const out = SELECT_PUSH * selection[i] + HOVER_PUSH * hover[i];
      const mesh = posters[i];
      mesh.position.set(
        Math.sin(angle) * ARC_RADIUS,
        Math.sin(time * 0.8 + i * 1.37) * 0.07,
        (Math.cos(angle) - 1) * ARC_RADIUS + out
      );
      mesh.rotation.set(0, angle * ARC_TURN, Math.sin(time * 0.6 + i) * 0.012);
      mesh.scale.setScalar(
        1 + SELECT_SCALE * selection[i] + HOVER_SCALE * hover[i]
      );
      const fade = edgeFade(offset, count, ARC_VISIBLE);
      mesh.material.opacity = reveal[i] * fade * sceneOpacity;
      // Render the nearest posters last so transparency blends correctly.
      mesh.renderOrder = 100 - Math.round(Math.abs(offset) * 10);
    }

    for (let j = 0; j < drifters.length; j++) {
      const mesh = drifters[j];
      const { source, baseY, baseYaw } = mesh.userData as {
        source: number;
        baseY: number;
        baseYaw: number;
      };
      mesh.position.y = baseY + Math.sin(time * 0.3 + j) * 0.25;
      mesh.rotation.y = baseYaw + Math.sin(time * 0.2 + j * 2) * 0.08;
      mesh.material.opacity = reveal[source] * DRIFT_OPACITY * sceneOpacity;
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
      if (disposed || index < 0 || index >= count || index === selected) {
        return;
      }
      selected = index;
      focusTarget = nearestFocus(focus, index, count);
      canvas.dataset.selected = String(index);
    },
    setScrollProgress(progress) {
      scrollTarget = Math.min(1, Math.max(0, progress));
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      stop();
      intersectionObserver.disconnect();
      resizeObserver.disconnect();
      document.removeEventListener('visibilitychange', sync);
      window.removeEventListener('pointermove', onWindowPointerMove);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerleave', onPointerLeave);
      canvas.removeEventListener('click', onClick);
      canvas.removeEventListener('webglcontextlost', onContextLost);
      timer.dispose();

      for (const mesh of [...posters, ...drifters]) mesh.material.dispose();
      textures.forEach((texture) => texture.dispose());
      textures.clear();
      posterGeometry.dispose();
      glowGeometry.dispose();
      glowMaterial.dispose();
      scene.clear();

      renderer.dispose();
      // Frees the context now instead of when GC runs: browsers cap live
      // WebGL contexts, and every Home visit creates a new one.
      renderer.forceContextLoss();
      canvas.remove();
    },
  };
}
