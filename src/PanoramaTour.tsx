import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { VRButton } from "three/addons/webxr/VRButton.js";
import {
  ArrowLeft,
  ArrowUp,
  RotateCcw,
  Maximize,
  Minimize,
} from "lucide-react";
import type { Place, TourScene } from "./data";
import { createDistrictModel } from "./districtModel";

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

type Props = {
  place: Place;
  onCatalogue: () => void;
  districtPlaces?: Place[];
  onSelectPlace?: (id: string) => void;
  selectedPlaceId?: string;
  requestTour?: { id: string; token: number };
};
export default function PanoramaTour({
  place,
  onCatalogue,
  districtPlaces,
  onSelectPlace,
  selectedPlaceId,
  requestTour,
}: Props) {
  const initialPlace = useRef(place).current;
  const [tourPlace, setTourPlace] = useState(initialPlace);
  const scenes = tourPlace.tour!;
  const [mapMode, setMapMode] = useState(Boolean(districtPlaces));
  const [districtSelected, setDistrictSelected] = useState<Place>();
  const pickPlace = useRef<(id: string) => void>(() => {});
  const startPlace = useRef<(place: Place) => void>(() => {});
  const goToMap = useRef<() => void>(() => {});
  const onSelectRef = useRef(onSelectPlace);
  onSelectRef.current = onSelectPlace;
  const tourContainer = useRef<HTMLDivElement>(null);
  const [fullscreen, setFullscreen] = useState(false);
  useEffect(() => {
    const changed = () =>
      setFullscreen(document.fullscreenElement === tourContainer.current);
    document.addEventListener("fullscreenchange", changed);
    return () => document.removeEventListener("fullscreenchange", changed);
  }, []);
  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await tourContainer.current?.requestFullscreen();
    } catch {
      setError("Полноэкранный режим недоступен в этом браузере.");
    }
  }
  function catalogue() {
    if (districtPlaces && !mapMode) {
      goToMap.current();
      return;
    }
    if (document.fullscreenElement) void document.exitFullscreen();
    onCatalogue();
  }
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
    raycaster.camera = camera;
    let activePlace = initialPlace;
    let active: TourScene = initialPlace.tour![0];
    let showingMap = Boolean(districtPlaces);
    world.add(new THREE.HemisphereLight(0xf1e8ff, 0x45314f, 3));
    const model = districtPlaces
      ? createDistrictModel(
          districtPlaces,
          (next) => {
            setDistrictSelected(next);
            onSelectRef.current?.(next.id);
          },
          (next) => {
            startPlace.current(next);
          },
        )
      : undefined;
    if (model) world.add(model.group);
    // This return control lives in the XR scene, so a headset can leave a tour.
    const returnCanvas = document.createElement("canvas");
    returnCanvas.width = 1024;
    returnCanvas.height = 192;
    const returnContext = returnCanvas.getContext("2d")!;
    returnContext.fillStyle = "#783aca";
    returnContext.beginPath();
    returnContext.roundRect(0, 0, 1024, 192, 35);
    returnContext.fill();
    returnContext.fillStyle = "white";
    returnContext.font = "bold 62px sans-serif";
    returnContext.textAlign = "center";
    returnContext.fillText("← К карте клубов", 512, 117);
    const returnTexture = new THREE.CanvasTexture(returnCanvas);
    returnTexture.colorSpace = THREE.SRGBColorSpace;
    const returnButton = new THREE.Mesh(
      new THREE.PlaneGeometry(1.4, 0.265),
      new THREE.MeshBasicMaterial({
        map: returnTexture,
        depthTest: false,
        side: THREE.DoubleSide,
      }),
    );
    returnButton.renderOrder = 1000;
    returnButton.visible = false;
    world.add(returnButton);
    returnButton.userData.activate = () => goToMap.current();
    const viewQuaternion = new THREE.Quaternion();
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
      camera.fov = showingMap ? 55 : 70;
      camera.updateProjectionMatrix();
      if (showingMap) {
        camera.position.set(
          0,
          renderer.xr.isPresenting ? 1.6 : 3.4,
          renderer.xr.isPresenting ? 0 : 1.2,
        );
        camera.lookAt(0, 0.65, -2.8);
        return;
      }
      camera.position.set(0, 1.6, 0);
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
      const scenePool = activePlace.tour!;
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
            const neighbour = scenePool.find((item) => item.id === link.target);
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
      const candidate = activePlace.tour!.find((scene) => scene.id === id);
      if (!candidate) return;
      const destination: TourScene = candidate;
      const request = ++requestId;
      active = destination;
      showingMap = false;
      setMapMode(false);
      if (model) model.group.visible = false;
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
    startPlace.current = (next) => {
      if (!next.tour) return;
      activePlace = next;
      setTourPlace(next);
      setDistrictSelected(next);
      onSelectRef.current?.(next.id);
      load(next.tour[0].id);
    };
    pickPlace.current = (id) => {
      const next = districtPlaces?.find((item) => item.id === id);
      if (next) {
        model?.select(id);
        setDistrictSelected(next);
      }
    };
    goToMap.current = () => {
      ++requestId;
      showingMap = true;
      setMapMode(true);
      setStatus("ready");
      setError("");
      ready = false;
      sphere.visible = false;
      arrow.visible = false;
      returnButton.visible = false;
      if (model) model.group.visible = true;
      if (hotspot.current) hotspot.current.style.visibility = "hidden";
      orient();
    };
    function activateRay() {
      const candidates = showingMap
        ? (model?.targets ?? []).filter(
            (object) => object.visible && object.parent?.visible !== false,
          )
        : [arrow, ...(model ? [returnButton] : [])].filter(
            (object) => object.visible,
          );
      const hit = raycaster.intersectObjects(candidates, false)[0];
      if (!hit) return;
      if (showingMap || hit.object === returnButton)
        hit.object.userData.activate?.();
      else if (ready) load(active.links[0].target);
    }
    let hoveredId = "";
    function hoverRay() {
      if (!showingMap || !model) return;
      const hit = raycaster.intersectObjects(
        model.targets.filter((object) => object.visible),
        false,
      )[0];
      const id = hit?.object.userData.placeId;
      if (id && id !== hoveredId) {
        hoveredId = id;
        model.select(id);
      }
    }
    const controllers: THREE.Group[] = [];
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
      if (renderer.xr.isPresenting) return;
      if (!dragging) {
        if (showingMap) {
          const rect = canvas.getBoundingClientRect();
          raycaster.setFromCamera(
            new THREE.Vector2(
              ((event.clientX - rect.left) / rect.width) * 2 - 1,
              (-(event.clientY - rect.top) / rect.height) * 2 + 1,
            ),
            camera,
          );
          hoverRay();
        }
        return;
      }
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
    function up(event: PointerEvent) {
      dragging = false;
      if (!showingMap || moved || renderer.xr.isPresenting) return;
      const rect = canvas.getBoundingClientRect();
      raycaster.setFromCamera(
        new THREE.Vector2(
          ((event.clientX - rect.left) / rect.width) * 2 - 1,
          (-(event.clientY - rect.top) / rect.height) * 2 + 1,
        ),
        camera,
      );
      activateRay();
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
      controllers.push(controller);
      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(),
          new THREE.Vector3(0, 0, -8),
        ]),
        new THREE.LineBasicMaterial({ color: 0xffffff }),
      );
      controller.add(line);
      controller.addEventListener("select", () => {
        if (!showingMap && !ready) return;
        const rotation = new THREE.Matrix4().extractRotation(
          controller.matrixWorld,
        );
        raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
        raycaster.ray.direction.set(0, 0, -1).applyMatrix4(rotation);
        activateRay();
      });
      world.add(controller);
    }
    function enterVR() {
      if (showingMap) orient();
      else load(active.id);
    }
    renderer.xr.addEventListener("sessionstart", enterVR);
    const endVR = () => orient();
    renderer.xr.addEventListener("sessionend", endVR);
    let vrButton: HTMLElement | null = null;
    if (!navigator.xr && districtPlaces)
      setXrStatus(
        "Макет доступен на экране. Для VR открой сайт в браузере совместимых очков.",
      );
    if (navigator.xr && window.isSecureContext) {
      navigator.xr
        .isSessionSupported("immersive-vr")
        .then((supported) => {
          if (disposed) return;
          if (supported) {
            vrButton = VRButton.createButton(renderer);
            element.appendChild(vrButton);
            vrButton.classList.add("tour-vr-button");
            setXrStatus("В VR выбирай стрелки лучом контроллера.");
          } else if (districtPlaces)
            setXrStatus(
              "Макет доступен на экране. VR можно включить в совместимых очках.",
            );
        })
        .catch(() =>
          setXrStatus("Не удалось проверить VR. Просмотр на экране доступен."),
        );
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
      for (const controller of controllers) {
        controller.visible = renderer.xr.isPresenting;
        if (showingMap && renderer.xr.isPresenting) {
          const rotation = new THREE.Matrix4().extractRotation(
            controller.matrixWorld,
          );
          raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
          raycaster.ray.direction.set(0, 0, -1).applyMatrix4(rotation);
          hoverRay();
        }
      }
      arrow.visible = ready && !showingMap && renderer.xr.isPresenting;
      returnButton.visible =
        Boolean(model) && !showingMap && renderer.xr.isPresenting;
      if (returnButton.visible) {
        const view = renderer.xr.getCamera();
        view.getWorldQuaternion(viewQuaternion);
        view.getWorldPosition(cameraPosition);
        returnButton.position
          .set(0, -0.85, -2)
          .applyQuaternion(viewQuaternion)
          .add(cameraPosition);
        returnButton.quaternion.copy(viewQuaternion);
      }
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
        !showingMap &&
        !renderer.xr.isPresenting &&
        inFront &&
        Math.abs(projected.x) < 0.93 &&
        Math.abs(projected.y) < 0.85;
      button.style.visibility = visible ? "visible" : "hidden";
      button.style.left = `${(projected.x + 1) * 50}%`;
      button.style.top = `${(1 - projected.y) * 50}%`;
    });
    if (model) goToMap.current();
    else load(initialPlace.tour![0].id);
    return () => {
      disposed = true;
      ++requestId;
      ready = false;
      navigate.current = () => {};
      startPlace.current = () => {};
      pickPlace.current = () => {};
      goToMap.current = () => {};
      resetView.current = () => {};
      abort.abort();
      for (const timer of prefetchTimers) window.clearTimeout(timer);
      downloads.clear();
      renderer.xr.removeEventListener("sessionstart", enterVR);
      renderer.xr.removeEventListener("sessionend", endVR);
      observer.disconnect();
      renderer.setAnimationLoop(null);
      const session = renderer.xr.getSession();
      if (session) void session.end().catch(() => {});
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("pointercancel", up);
      canvas.removeEventListener("keydown", key);
      if (model) {
        world.remove(model.group);
        model.dispose();
      }
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
      returnTexture.dispose();
      arrowTexture.dispose();
      arrowMaterial.dispose();
      renderer.dispose();
      canvas.remove();
      vrButton?.remove();
    };
  }, [initialPlace, districtPlaces]);
  useEffect(() => {
    if (selectedPlaceId) pickPlace.current(selectedPlaceId);
  }, [selectedPlaceId]);
  useEffect(() => {
    const next = districtPlaces?.find((item) => item.id === requestTour?.id);
    if (next) startPlace.current(next);
  }, [requestTour, districtPlaces]);

  return (
    <div
      ref={tourContainer}
      className={`vr-content panorama-tour ${mapMode ? "district-view" : ""}`}
    >
      <div className="vr-intro">
        <span>
          {mapMode
            ? "Макет Московского района"
            : `Прогулка по клубу «${tourPlace.name}»`}
        </span>
        <p>
          {mapMode
            ? "Выбирай метки мышью или лучом VR-контроллера. У клубов с панорамами есть отметка 360°."
            : "Осмотрись мышью или пальцем. Нажми на стрелку у двери, чтобы перейти в другое помещение."}
        </p>
      </div>
      {!mapMode && (
        <div className="tour-scene-heading">
          <strong>{current.name}</strong>
          <span>
            {scenes.findIndex((scene) => scene.id === sceneId) + 1} /{" "}
            {scenes.length}
          </span>
        </div>
      )}
      <div
        className="vr-scene"
        ref={host}
        aria-label={
          mapMode ? "Макет района для VR" : `Панорама 360°: ${tourPlace.name}`
        }
        data-district-pins={districtPlaces?.length}
        data-panorama-state={status}
        data-tour-scene={mapMode ? "district" : sceneId}
        data-panorama-detail={detail}
        aria-busy={status === "loading"}
      >
        <button
          hidden={mapMode}
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
        {!mapMode && status === "loading" && (
          <div className="tour-loading" role="status">
            Загружаем панораму…
          </div>
        )}
      </div>
      {!mapMode && (
        <p className="tour-detail-status" role="status">
          {status === "ready" && detail === "preview" && !error
            ? "Повышаем чёткость… Можно осматриваться и переходить дальше."
            : "\u00a0"}
        </p>
      )}
      {mapMode && (
        <div className="district-summary">
          {districtSelected ? (
            <>
              <strong>{districtSelected.name}</strong>
              <span>{districtSelected.address}</span>
              {districtSelected.tour ? (
                <button
                  className="explore-enter"
                  onClick={() => startPlace.current(districtSelected)}
                >
                  Заглянуть внутрь в VR <ArrowUp size={16} />
                </button>
              ) : (
                <span>Съёмка интерьера пока не добавлена</span>
              )}
            </>
          ) : (
            <span>
              {districtPlaces?.length} пространства на одной карте. Нажми на
              метку, чтобы выбрать клуб.
            </span>
          )}
          <a
            href="https://www.openstreetmap.org/copyright"
            target="_blank"
            rel="noreferrer"
          >
            Карта © OpenStreetMap contributors
          </a>
        </div>
      )}
      {error && (
        <div role="status" className="tour-error">
          <p>{error}</p>
          <button onClick={() => navigate.current(sceneId)}>
            Попробовать снова
          </button>
        </div>
      )}
      {!mapMode && (
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
      )}
      <div className="tour-tools">
        <button onClick={() => resetView.current()}>
          <RotateCcw size={15} />
          Исходный ракурс
        </button>
        <button onClick={toggleFullscreen} aria-pressed={fullscreen}>
          {fullscreen ? <Minimize size={15} /> : <Maximize size={15} />}{" "}
          {fullscreen ? "Свернуть" : "На весь экран"}
        </button>
        <button onClick={catalogue}>
          <ArrowLeft size={15} />
          {mapMode ? "Открыть обычную карту" : "Выбрать другой клуб"}
        </button>
      </div>
      {xrStatus && <p className="vr-status">{xrStatus}</p>}
    </div>
  );
}
