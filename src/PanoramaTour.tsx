import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { VRButton } from "three/addons/webxr/VRButton.js";
import { ArrowLeft, ArrowUp, RotateCcw } from "lucide-react";
import type { Place, TourScene } from "./data";

// UV coordinates refer directly to the original equirectangular photograph.
function direction(u: number, v: number) {
  const longitude = u * Math.PI * 2;
  const latitude = (0.5 - v) * Math.PI;
  return new THREE.Vector3(
    Math.cos(longitude) * Math.cos(latitude),
    Math.sin(latitude),
    Math.sin(longitude) * Math.cos(latitude),
  );
}

type Props = { place: Place; onCatalogue: () => void };
export default function PanoramaTour({ place, onCatalogue }: Props) {
  const scenes = place.tour!;
  const host = useRef<HTMLDivElement>(null);
  const hotspot = useRef<HTMLButtonElement>(null);
  const navigate = useRef<(id: string) => void>(() => {});
  const resetView = useRef<() => void>(() => {});
  const [sceneId, setSceneId] = useState(scenes[0].id);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [detail, setDetail] = useState<"preview" | "full">("preview");
  const [error, setError] = useState("");
  const [xrStatus, setXrStatus] = useState("");
  const current = scenes.find((scene) => scene.id === sceneId)!;

  useEffect(() => {
    const element = host.current!;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true });
    } catch {
      setStatus("error");
      setError(
        "В этом браузере недоступен WebGL. Открой тур в другом браузере.",
      );
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.xr.enabled = true;
    const canvas = renderer.domElement;
    canvas.tabIndex = 0;
    canvas.setAttribute(
      "aria-label",
      "Обзор: перетаскивай изображение или используй стрелки",
    );
    canvas.style.touchAction = "none";
    element.prepend(canvas);
    const world = new THREE.Scene();
    world.background = new THREE.Color("#161426");
    const camera = new THREE.PerspectiveCamera(70, 1, 0.1, 40);
    camera.position.y = 1.6;
    camera.rotation.order = "YXZ";
    const geometry = new THREE.SphereGeometry(15, 64, 40);
    geometry.scale(-1, 1, 1);
    const material = new THREE.MeshBasicMaterial();
    const sphere = new THREE.Mesh(geometry, material);
    sphere.position.y = 1.6;
    sphere.visible = false;
    world.add(sphere);

    // The same doorway target is clickable in the browser and with a VR controller.
    const arrowCanvas = document.createElement("canvas");
    arrowCanvas.width = 256;
    arrowCanvas.height = 256;
    const ctx = arrowCanvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(128, 128, 100, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#783aca";
    ctx.lineWidth = 18;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(76, 136);
    ctx.lineTo(128, 84);
    ctx.lineTo(180, 136);
    ctx.moveTo(128, 84);
    ctx.lineTo(128, 181);
    ctx.stroke();
    const arrowTexture = new THREE.CanvasTexture(arrowCanvas);
    const arrowMaterial = new THREE.SpriteMaterial({
      map: arrowTexture,
      depthTest: false,
    });
    const arrow = new THREE.Sprite(arrowMaterial);
    arrow.scale.set(0.9, 0.9, 1);
    arrow.visible = false;
    world.add(arrow);
    const raycaster = new THREE.Raycaster();
    let active: TourScene = scenes[0];
    let ready = false,
      disposed = false,
      requestId = 0;
    let loadedTexture: THREE.Texture | null = null;
    const anchor = new THREE.Vector3();
    const projected = new THREE.Vector3();
    const cameraDirection = new THREE.Vector3();
    const cameraPosition = new THREE.Vector3();
    const loader = new THREE.TextureLoader();
    function orient() {
      const facing = direction(active.initialU, 0.5);
      camera.rotation.set(-0.04, Math.atan2(-facing.x, -facing.z), 0, "YXZ");
    }
    // Cache downloaded blobs, not GPU textures: revisits avoid another network
    // transfer while inactive 8K textures can be released from graphics memory.
    const downloads = new Map<string, Promise<Blob>>();
    const abort = new AbortController();
    const prefetchTimers = new Set<number>();
    function download(url: string) {
      let pending = downloads.get(url);
      if (!pending) {
        pending = fetch(url, { signal: abort.signal, cache: "force-cache" })
          .then((response) => {
            if (!response.ok)
              throw new Error(`Panorama HTTP ${response.status}`);
            return response.blob();
          })
          .catch((error) => {
            downloads.delete(url);
            throw error;
          });
        downloads.set(url, pending);
      }
      return pending;
    }
    async function textureFor(url: string) {
      const blob = await download(url);
      if (disposed) throw new Error("Tour closed");
      const objectUrl = URL.createObjectURL(blob);
      try {
        return await loader.loadAsync(objectUrl);
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    }
    function fullImage(scene: TourScene) {
      const pixels = element.clientWidth * Math.min(window.devicePixelRatio, 2);
      const use8K =
        renderer.capabilities.maxTextureSize >= 8192 &&
        (renderer.xr.isPresenting || pixels > 900);
      return !use8K && scene.imageMobile ? scene.imageMobile : scene.image;
    }
    function prefetchNeighbours(scene: TourScene, full: boolean) {
      const network = (
        navigator as Navigator & {
          connection?: { saveData?: boolean; effectiveType?: string };
        }
      ).connection;
      if (
        network?.saveData ||
        (full && /^(slow-2g|2g|3g)$/.test(network?.effectiveType ?? ""))
      )
        return;
      const timer = window.setTimeout(
        () => {
          prefetchTimers.delete(timer);
          if (disposed) return;
          for (const link of scene.links) {
            const neighbour = scenes.find((item) => item.id === link.target);
            if (!neighbour) continue;
            const url = full ? fullImage(neighbour) : neighbour.preview;
            if (url) void download(url).catch(() => {});
          }
        },
        full ? 600 : 0,
      );
      prefetchTimers.add(timer);
    }
    function load(id: string) {
      const candidate = scenes.find((scene) => scene.id === id);
      if (!candidate) return;
      const destination: TourScene = candidate;
      const request = ++requestId;
      active = destination;
      ready = false;
      sphere.visible = false;
      setSceneId(id);
      setStatus("loading");
      setDetail("preview");
      setError("");
      if (hotspot.current) hotspot.current.style.visibility = "hidden";
      arrow.visible = false;
      orient();
      function show(texture: THREE.Texture, quality: "preview" | "full") {
        if (disposed || request !== requestId) {
          texture.dispose();
          return false;
        }
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.generateMipmaps = false;
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.anisotropy = Math.min(
          4,
          renderer.capabilities.getMaxAnisotropy(),
        );
        material.map = texture;
        material.needsUpdate = true;
        loadedTexture?.dispose();
        loadedTexture = texture;
        sphere.visible = true;
        const link = destination.links[0];
        anchor.copy(direction(link.u, link.v)).multiplyScalar(8);
        anchor.y += 1.6;
        arrow.position.copy(anchor);
        ready = true;
        setDetail(quality);
        setStatus("ready");
        return true;
      }
      void (async () => {
        let hasPreview = false;
        if (destination.preview) {
          try {
            hasPreview = show(await textureFor(destination.preview), "preview");
          } catch {
            /* The detailed image can still recover a failed preview. */
          }
        }
        if (disposed || request !== requestId) return;
        // Preview is interactive already. Upgrade without resetting the camera.
        prefetchNeighbours(destination, false);
        try {
          if (show(await textureFor(fullImage(destination)), "full"))
            prefetchNeighbours(destination, true);
        } catch {
          if (disposed || request !== requestId) return;
          if (hasPreview) {
            setError(
              "Пока доступно быстрое превью. Повторить загрузку чёткого изображения?",
            );
          } else {
            setStatus("error");
            setError(
              "Не удалось загрузить панораму. Проверь подключение и попробуй ещё раз.",
            );
          }
        }
      })();
    }
    navigate.current = load;
    resetView.current = orient;
    let dragging = false,
      moved = false,
      previousX = 0,
      previousY = 0,
      startX = 0,
      startY = 0;
    function down(event: PointerEvent) {
      dragging = true;
      moved = false;
      previousX = startX = event.clientX;
      previousY = startY = event.clientY;
      canvas.setPointerCapture(event.pointerId);
      canvas.focus({ preventScroll: true });
    }
    function move(event: PointerEvent) {
      if (!dragging || renderer.xr.isPresenting) return;
      if (Math.hypot(event.clientX - startX, event.clientY - startY) > 4)
        moved = true;
      if (moved) {
        camera.rotation.y -= (event.clientX - previousX) * 0.004;
        camera.rotation.x = THREE.MathUtils.clamp(
          camera.rotation.x - (event.clientY - previousY) * 0.004,
          -1.45,
          1.45,
        );
      }
      previousX = event.clientX;
      previousY = event.clientY;
    }
    function up() {
      dragging = false;
    }
    function key(event: KeyboardEvent) {
      if (
        renderer.xr.isPresenting ||
        !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)
      )
        return;
      event.preventDefault();
      if (event.key === "ArrowLeft") camera.rotation.y += 0.12;
      if (event.key === "ArrowRight") camera.rotation.y -= 0.12;
      if (event.key === "ArrowUp") camera.rotation.x += 0.12;
      if (event.key === "ArrowDown") camera.rotation.x -= 0.12;
      camera.rotation.x = THREE.MathUtils.clamp(camera.rotation.x, -1.45, 1.45);
    }
    canvas.addEventListener("pointerdown", down);
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", up);
    canvas.addEventListener("keydown", key);
    for (let index = 0; index < 2; index++) {
      const controller = renderer.xr.getController(index);
      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(),
          new THREE.Vector3(0, 0, -8),
        ]),
        new THREE.LineBasicMaterial({ color: 0xffffff }),
      );
      controller.add(line);
      controller.addEventListener("select", () => {
        if (!ready) return;
        const rotation = new THREE.Matrix4().extractRotation(
          controller.matrixWorld,
        );
        raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
        raycaster.ray.direction.set(0, 0, -1).applyMatrix4(rotation);
        if (raycaster.intersectObject(arrow).length)
          load(active.links[0].target);
      });
      world.add(controller);
    }
    function enterVR() {
      load(active.id);
    }
    renderer.xr.addEventListener("sessionstart", enterVR);
    let vrButton: HTMLElement | null = null;
    if (navigator.xr && window.isSecureContext) {
      navigator.xr
        .isSessionSupported("immersive-vr")
        .then((supported) => {
          if (disposed) return;
          if (supported) {
            vrButton = VRButton.createButton(renderer);
            element.appendChild(vrButton);
            setXrStatus("В VR выбирай стрелки лучом контроллера.");
          }
        })
        .catch(() => {});
    }
    function resize() {
      const width = element.clientWidth,
        height = element.clientHeight;
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    }
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    resize();
    renderer.setAnimationLoop(() => {
      arrow.visible = ready && renderer.xr.isPresenting;
      renderer.render(world, camera);
      const button = hotspot.current;
      if (!button) return;
      camera.getWorldDirection(cameraDirection);
      camera.getWorldPosition(cameraPosition);
      const inFront =
        projected.copy(anchor).sub(cameraPosition).dot(cameraDirection) > 0;
      projected.copy(anchor).project(camera);
      const visible =
        ready &&
        !renderer.xr.isPresenting &&
        inFront &&
        Math.abs(projected.x) < 0.93 &&
        Math.abs(projected.y) < 0.85;
      button.style.visibility = visible ? "visible" : "hidden";
      button.style.left = `${(projected.x + 1) * 50}%`;
      button.style.top = `${(1 - projected.y) * 50}%`;
    });
    load(scenes[0].id);
    return () => {
      disposed = true;
      ++requestId;
      ready = false;
      navigate.current = () => {};
      resetView.current = () => {};
      abort.abort();
      for (const timer of prefetchTimers) window.clearTimeout(timer);
      downloads.clear();
      renderer.xr.removeEventListener("sessionstart", enterVR);
      observer.disconnect();
      renderer.setAnimationLoop(null);
      const session = renderer.xr.getSession();
      if (session) void session.end().catch(() => {});
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("pointercancel", up);
      canvas.removeEventListener("keydown", key);
      world.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Line) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material)
            ? object.material
            : [object.material];
          materials.forEach((item) => item.dispose());
        }
      });
      loadedTexture?.dispose();
      arrowTexture.dispose();
      arrowMaterial.dispose();
      renderer.dispose();
      canvas.remove();
      vrButton?.remove();
    };
  }, [scenes]);

  return (
    <div className="vr-content panorama-tour">
      <div className="vr-intro">
        <span>Прогулка по клубу «{place.name}»</span>
        <p>
          Осмотрись мышью или пальцем. Нажми на стрелку у двери, чтобы перейти в
          другое помещение.
        </p>
      </div>
      <div className="tour-scene-heading">
        <strong>{current.name}</strong>
        <span>
          {scenes.findIndex((scene) => scene.id === sceneId) + 1} /{" "}
          {scenes.length}
        </span>
      </div>
      <div
        className="vr-scene"
        ref={host}
        aria-label={`Панорама 360°: ${place.name}`}
        data-panorama-state={status}
        data-tour-scene={sceneId}
        data-panorama-detail={detail}
        aria-busy={status === "loading"}
      >
        <button
          ref={hotspot}
          className="tour-hotspot"
          style={{ visibility: "hidden" }}
          onClick={() => navigate.current(current.links[0].target)}
          aria-label={current.links[0].label}
          disabled={status !== "ready"}
        >
          <span className="tour-hotspot-arrow">
            <ArrowUp size={26} />
          </span>
          <span className="tour-hotspot-label">{current.links[0].label}</span>
        </button>
        {status === "loading" && (
          <div className="tour-loading" role="status">
            Загружаем панораму…
          </div>
        )}
      </div>
      <p className="tour-detail-status" role="status">
        {status === "ready" && detail === "preview" && !error
          ? "Повышаем чёткость… Можно осматриваться и переходить дальше."
          : "\u00a0"}
      </p>
      {error && (
        <div role="status" className="tour-error">
          <p>{error}</p>
          <button onClick={() => navigate.current(sceneId)}>
            Попробовать снова
          </button>
        </div>
      )}
      <nav className="tour-room-nav" aria-label="Помещения клуба">
        {scenes.map((scene) => (
          <button
            key={scene.id}
            aria-current={scene.id === sceneId ? "step" : undefined}
            onClick={() => navigate.current(scene.id)}
            disabled={scene.id === sceneId && status !== "error"}
          >
            {scene.name}
          </button>
        ))}
      </nav>
      <div className="tour-tools">
        <button onClick={() => resetView.current()}>
          <RotateCcw size={15} />
          Исходный ракурс
        </button>
        <button onClick={onCatalogue}>
          <ArrowLeft size={15} />К каталогу пространств
        </button>
      </div>
      {xrStatus && <p className="vr-status">{xrStatus}</p>}
    </div>
  );
}
