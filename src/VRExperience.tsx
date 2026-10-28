import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { VRButton } from "three/addons/webxr/VRButton.js";
import { ArrowLeft, ArrowRight, MapPin } from "lucide-react";
import type { Place } from "./data";
import VRHeadsetIcon from "./VRHeadsetIcon";

type Props = {
  places: Place[];
  selected?: Place;
  onSelect: (id: string) => void;
};

export default function VRExperience({ places, selected, onSelect }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const selectRef = useRef(onSelect);
  selectRef.current = onSelect;
  const [page, setPage] = useState(0);
  const [error, setError] = useState("");
  const [xrStatus, setXrStatus] = useState("Проверяем поддержку VR…");
  const pageCount = Math.ceil(places.length / 6);

  useEffect(() => {
    const element = host.current!;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true });
    } catch {
      setError(
        "В этом браузере недоступен WebGL. Каталог мест остаётся доступен ниже.",
      );
      return;
    }
    setError("");
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.xr.enabled = true;
    element.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#161426");
    scene.fog = new THREE.Fog("#161426", 6, 24);
    const camera = new THREE.PerspectiveCamera(65, 1, 0.1, 40);
    camera.position.set(0, 1.6, 0);
    scene.add(new THREE.HemisphereLight("#ded8ff", "#352c5b", 3));
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(18, 64),
      new THREE.MeshStandardMaterial({ color: "#242034", roughness: 0.8 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.1;
    scene.add(floor);
    const grid = new THREE.GridHelper(28, 28, "#6d508b", "#363047");
    grid.position.y = -0.09;
    scene.add(grid);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(2.6, 0.015, 8, 100),
      new THREE.MeshBasicMaterial({ color: "#cfb5fc" }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = -0.05;
    scene.add(ring);

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const targets: THREE.Mesh[] = [];
    const textures = new Set<THREE.Texture>();
    const group = new THREE.Group();
    scene.add(group);
    const infoPanel = new THREE.Mesh(
      new THREE.PlaneGeometry(2.9, 0.55),
      new THREE.MeshBasicMaterial({
        transparent: true,
        side: THREE.DoubleSide,
      }),
    );
    infoPanel.position.set(0, 0.35, -2.8);
    infoPanel.visible = false;
    scene.add(infoPanel);

    function texture(lines: string[], color = "#eee7fa", subtitle = "") {
      const canvas = document.createElement("canvas");
      canvas.width = 1024;
      canvas.height = 512;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(0, 0, 1024, 512, 42);
      ctx.fill();
      ctx.fillStyle = "#783aca";
      ctx.font = "24px sans-serif";
      ctx.fillText("МОСКОВСКИЙ РАЙОН / МЕСТА ДЛЯ ТЕБЯ", 56, 68);
      ctx.fillStyle = "#231c35";
      ctx.font = "bold 54px sans-serif";
      lines
        .slice(0, 3)
        .forEach((line, index) =>
          ctx.fillText(line, 56, 158 + index * 65, 910),
        );
      ctx.fillStyle = "#61576e";
      ctx.font = "27px sans-serif";
      ctx.fillText(subtitle, 56, 415, 910);
      const result = new THREE.CanvasTexture(canvas);
      result.colorSpace = THREE.SRGBColorSpace;
      textures.add(result);
      return result;
    }
    function wrap(text: string, length = 24) {
      const output: string[] = [];
      let line = "";
      for (const word of text.split(" ")) {
        if ((line + word).length > length && line) {
          output.push(line);
          line = "";
        }
        line += `${word} `;
      }
      if (line) output.push(line.trim());
      return output;
    }
    function info(place: Place) {
      infoPanel.visible = true;
      const material = infoPanel.material as THREE.MeshBasicMaterial;
      if (material.map) {
        material.map.dispose();
        textures.delete(material.map);
      }
      material.map = texture(
        [
          place.name,
          ...wrap(place.activities.slice(0, 3).join(" · "), 45),
        ].slice(0, 3),
        "#dfedb5",
        place.address,
      );
      material.needsUpdate = true;
    }
    function buildCards(pageIndex: number) {
      for (const mesh of [...group.children]) {
        group.remove(mesh);
        if (mesh instanceof THREE.Mesh) {
          mesh.geometry.dispose();
          const material = mesh.material as THREE.MeshBasicMaterial;
          if (material.map) {
            material.map.dispose();
            textures.delete(material.map);
          }
          material.dispose();
        }
      }
      targets.length = 0;
      places.slice(pageIndex * 6, pageIndex * 6 + 6).forEach((place, index) => {
        const angle = ((index % 3) - 1) * 0.52;
        const card = new THREE.Mesh(
          new THREE.PlaneGeometry(1.4, 0.7),
          new THREE.MeshBasicMaterial({
            map: texture(
              wrap(place.name),
              index % 2 ? "#e8dcf8" : "#f6e8f2",
              place.kind,
            ),
            side: THREE.DoubleSide,
          }),
        );
        card.position.set(
          Math.sin(angle) * 3.4,
          index < 3 ? 2.25 : 1.38,
          -Math.cos(angle) * 3.4,
        );
        card.lookAt(0, card.position.y, 0);
        card.userData = { placeId: place.id };
        group.add(card);
        targets.push(card);
      });
      for (const direction of [-1, 1]) {
        const button = new THREE.Mesh(
          new THREE.PlaneGeometry(0.8, 0.35),
          new THREE.MeshBasicMaterial({
            map: texture(
              [direction === -1 ? "← Назад" : "Дальше →"],
              "#d7f1ab",
              `${pageIndex + 1} / ${pageCount}`,
            ),
            side: THREE.DoubleSide,
          }),
        );
        button.position.set(direction * 1.2, 0.6, -3.3);
        button.userData = { direction };
        group.add(button);
        targets.push(button);
      }
    }
    let currentPage = Math.min(page, pageCount - 1);
    buildCards(currentPage);
    if (selected) info(selected);
    function activate(target: THREE.Object3D) {
      if (typeof target.userData.direction === "number") {
        currentPage =
          (currentPage + target.userData.direction + pageCount) % pageCount;
        buildCards(currentPage);
      } else {
        const place = places.find(
          (item) => item.id === target.userData.placeId,
        );
        if (place) {
          selectRef.current(place.id);
          info(place);
        }
      }
    }
    let dragging = false,
      moved = false,
      previousX = 0,
      previousY = 0;
    camera.rotation.order = "YXZ";
    function onDown(event: PointerEvent) {
      dragging = true;
      moved = false;
      previousX = event.clientX;
      previousY = event.clientY;
      renderer.domElement.setPointerCapture(event.pointerId);
    }
    function onMove(event: PointerEvent) {
      if (!dragging || renderer.xr.isPresenting) return;
      const dx = event.clientX - previousX,
        dy = event.clientY - previousY;
      if (Math.abs(dx) + Math.abs(dy) > 3) moved = true;
      if (moved) {
        camera.rotation.y -= dx * 0.004;
        camera.rotation.x = THREE.MathUtils.clamp(
          camera.rotation.x - dy * 0.004,
          -1.15,
          1.15,
        );
      }
      previousX = event.clientX;
      previousY = event.clientY;
    }
    function onCancel() {
      dragging = false;
    }
    function onClick(event: PointerEvent) {
      dragging = false;
      if (renderer.xr.isPresenting || moved) return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        (-(event.clientY - rect.top) / rect.height) * 2 + 1,
      );
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(targets)[0];
      if (hit) activate(hit.object);
    }
    renderer.domElement.style.touchAction = "none";
    renderer.domElement.addEventListener("pointerdown", onDown);
    renderer.domElement.addEventListener("pointermove", onMove);
    renderer.domElement.addEventListener("pointercancel", onCancel);
    renderer.domElement.addEventListener("pointerup", onClick);
    for (let i = 0; i < 2; i++) {
      const controller = renderer.xr.getController(i);
      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(0, 0, 0),
          new THREE.Vector3(0, 0, -5),
        ]),
        new THREE.LineBasicMaterial({ color: "#d7f1ab" }),
      );
      controller.add(line);
      controller.addEventListener("select", () => {
        const rotation = new THREE.Matrix4().extractRotation(
          controller.matrixWorld,
        );
        raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
        raycaster.ray.direction.set(0, 0, -1).applyMatrix4(rotation);
        const hit = raycaster.intersectObjects(targets)[0];
        if (hit) activate(hit.object);
      });
      scene.add(controller);
    }

    let disposed = false;
    let vrButton: HTMLElement | null = null;
    if (!window.isSecureContext)
      setXrStatus("Для VR-очков открой сайт по HTTPS.");
    else if (!navigator.xr)
      setXrStatus(
        "VR-очки не обнаружены. Карточки можно нажимать мышью или касанием.",
      );
    else
      navigator.xr
        .isSessionSupported("immersive-vr")
        .then((supported) => {
          if (disposed) return;
          setXrStatus(
            supported
              ? "VR доступен. Надень очки и нажми ENTER VR. Выбирай карточки лучом контроллера."
              : "Используй браузер VR-очков с поддержкой WebXR. Здесь работает просмотр на экране.",
          );
          if (supported) {
            vrButton = VRButton.createButton(renderer);
            element.appendChild(vrButton);
          }
        })
        .catch(() => {
          if (!disposed)
            setXrStatus(
              "Браузер не разрешил проверку WebXR. Каталог доступен на экране.",
            );
        });

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
    renderer.setAnimationLoop(() => renderer.render(scene, camera));

    // Future same-origin equirectangular photos are rendered inside an immersive sphere.
    if (selected?.panorama) {
      new THREE.TextureLoader().load(
        selected.panorama,
        (panorama) => {
          if (disposed) {
            panorama.dispose();
            return;
          }
          textures.add(panorama);
          panorama.colorSpace = THREE.SRGBColorSpace;
          const sphere = new THREE.Mesh(
            new THREE.SphereGeometry(15, 64, 40),
            new THREE.MeshBasicMaterial({
              map: panorama,
              side: THREE.BackSide,
            }),
          );
          sphere.position.y = 1.6;
          scene.add(sphere);
          group.visible = false;
          floor.visible = false;
          grid.visible = false;
          ring.visible = false;
          infoPanel.visible = false;
        },
        undefined,
        () => {
          if (!disposed)
            setError(
              "Не удалось загрузить панораму. Проверь путь к фотографии.",
            );
        },
      );
    }

    return () => {
      disposed = true;
      observer.disconnect();
      renderer.setAnimationLoop(null);
      const session = renderer.xr.getSession();
      if (session) void session.end().catch(() => {});
      renderer.domElement.removeEventListener("pointerup", onClick);
      renderer.domElement.removeEventListener("pointerdown", onDown);
      renderer.domElement.removeEventListener("pointermove", onMove);
      renderer.domElement.removeEventListener("pointercancel", onCancel);
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Line) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material)
            ? object.material
            : [object.material];
          materials.forEach((material) => material.dispose());
        }
      });
      textures.forEach((item) => item.dispose());
      renderer.dispose();
      renderer.domElement.remove();
      vrButton?.remove();
    };
    // Selection updates the HTML summary; card clicks also update the scene without recreating the XR session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [places, page, pageCount]);

  return (
    <div className="vr-content">
      <div className="vr-intro">
        <span>
          <VRHeadsetIcon size={17} />
          Виртуальный каталог
        </span>
        <p>
          Реальные места — в новом формате. Панорамы интерьеров появятся после
          съёмки 360°.
        </p>
      </div>
      <div
        className="vr-scene"
        ref={host}
        aria-label="Интерактивный трёхмерный каталог"
      />
      {error && (
        <p className="vr-status" role="status">
          {error}
        </p>
      )}
      <p className="vr-status">{xrStatus}</p>
      <div className="vr-pagination">
        <button
          className="icon-button"
          onClick={() =>
            setPage((value) => (value - 1 + pageCount) % pageCount)
          }
          aria-label="Предыдущие места в VR"
        >
          <ArrowLeft size={18} />
        </button>
        <span>
          {page + 1} / {pageCount}
        </span>
        <button
          className="icon-button"
          onClick={() => setPage((value) => (value + 1) % pageCount)}
          aria-label="Следующие места в VR"
        >
          <ArrowRight size={18} />
        </button>
      </div>
      {selected && (
        <div className="vr-selected">
          <strong>{selected.name}</strong>
          <span>
            <MapPin size={14} />
            {selected.address}
          </span>
          <p>
            {selected.activities.length
              ? selected.activities.slice(0, 5).join(" · ")
              : "Направления уточняются"}
          </p>
        </div>
      )}
      <div
        className="vr-accessible-list"
        aria-label="Места в виртуальном каталоге"
      >
        {places.slice(page * 6, page * 6 + 6).map((place) => (
          <button key={place.id} onClick={() => onSelect(place.id)}>
            {place.name}
            <ArrowRight size={14} />
          </button>
        ))}
      </div>
    </div>
  );
}
