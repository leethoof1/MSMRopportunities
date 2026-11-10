import * as THREE from "three";
import { categories, locationFor, type Place } from "./data";

function mercator(latitude: number, longitude: number, zoom: number) {
  const sine = Math.sin((latitude * Math.PI) / 180);
  return new THREE.Vector2(
    ((longitude + 180) / 360) * 2 ** zoom * 256,
    (0.5 - Math.log((1 + sine) / (1 - sine)) / (4 * Math.PI)) * 2 ** zoom * 256,
  );
}

/** A geographic tabletop; markers use the same sourced coordinates as Leaflet. */
export function createDistrictModel(
  places: Place[],
  onPick: (place: Place) => void,
  onEnter: (place: Place) => void,
) {
  const group = new THREE.Group();
  const targets: THREE.Object3D[] = [];
  const textures = new Set<THREE.Texture>();
  let disposed = false;
  let selected: Place | undefined;
  const zoom = 12;
  const pixels = places.map((place) =>
    mercator(...locationFor(place).coordinates, zoom),
  );
  const left = Math.floor((Math.min(...pixels.map((p) => p.x)) - 70) / 256);
  const top = Math.floor((Math.min(...pixels.map((p) => p.y)) - 70) / 256);
  const right = Math.floor((Math.max(...pixels.map((p) => p.x)) + 70) / 256);
  const bottom = Math.floor((Math.max(...pixels.map((p) => p.y)) + 70) / 256);
  const pixelWidth = (right - left + 1) * 256,
    pixelHeight = (bottom - top + 1) * 256;
  const width = 3.3,
    depth = (width * pixelHeight) / pixelWidth;
  const board = new THREE.Group();
  board.position.set(0, 0.65, -2.8);
  group.add(board);
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(width + 0.08, 0.1, depth + 0.08),
    new THREE.MeshStandardMaterial({ color: 0x685780, roughness: 0.8 }),
  );
  base.position.y = -0.06;
  board.add(base);
  const mapCanvas = document.createElement("canvas");
  mapCanvas.width = pixelWidth;
  mapCanvas.height = pixelHeight;
  const mapContext = mapCanvas.getContext("2d")!;
  mapContext.fillStyle = "#e6ece4";
  mapContext.fillRect(0, 0, pixelWidth, pixelHeight);
  mapContext.strokeStyle = "#c7d4c7";
  mapContext.lineWidth = 2;
  for (let x = 0; x < pixelWidth; x += 64) {
    mapContext.beginPath();
    mapContext.moveTo(x, 0);
    mapContext.lineTo(x, pixelHeight);
    mapContext.stroke();
  }
  for (let y = 0; y < pixelHeight; y += 64) {
    mapContext.beginPath();
    mapContext.moveTo(0, y);
    mapContext.lineTo(pixelWidth, y);
    mapContext.stroke();
  }
  const mapTexture = new THREE.CanvasTexture(mapCanvas);
  mapTexture.colorSpace = THREE.SRGBColorSpace;
  textures.add(mapTexture);
  const surface = new THREE.Mesh(
    new THREE.PlaneGeometry(width, depth),
    new THREE.MeshBasicMaterial({ map: mapTexture }),
  );
  surface.rotation.x = -Math.PI / 2;
  board.add(surface);
  // Only tiles visible on this small board are fetched. No background region download.
  for (let x = left; x <= right; x++)
    for (let y = top; y <= bottom; y++) {
      const image = new Image();
      image.crossOrigin = "anonymous";
      image.onload = () => {
        if (disposed) return;
        mapContext.drawImage(
          image,
          (x - left) * 256,
          (y - top) * 256,
          256,
          256,
        );
        mapTexture.needsUpdate = true;
      };
      image.src = `https://tile.openstreetmap.org/${zoom}/${x}/${y}.png`;
    }
  function label(text: string, subtitle = "", accent = false) {
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 256;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = accent ? "#783aca" : "#ffffff";
    ctx.beginPath();
    ctx.roundRect(0, 0, 1024, 256, 28);
    ctx.fill();
    ctx.fillStyle = accent ? "#ffffff" : "#271e36";
    ctx.font = "bold 55px sans-serif";
    ctx.fillText(text, 38, 96, 945);
    ctx.font = "30px sans-serif";
    ctx.fillText(subtitle, 38, 180, 945);
    if (!accent) {
      ctx.fillStyle = "#71677d";
      ctx.font = "22px sans-serif";
      ctx.fillText("Карта © OpenStreetMap contributors", 38, 234, 945);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    textures.add(texture);
    return texture;
  }
  const infoMaterial = new THREE.MeshBasicMaterial({
    map: label(
      "Московский район",
      "Выбери метку клуба · все пространства на одной карте",
    ),
    side: THREE.DoubleSide,
  });
  const info = new THREE.Mesh(
    new THREE.PlaneGeometry(2.7, 0.675),
    infoMaterial,
  );
  info.position.set(0, 1.85, -3);
  group.add(info);
  const enterMaterial = new THREE.MeshBasicMaterial({
    map: label("Заглянуть внутрь →", "Открыть панораму 360°", true),
    side: THREE.DoubleSide,
  });
  const enter = new THREE.Mesh(
    new THREE.PlaneGeometry(1.2, 0.3),
    enterMaterial,
  );
  enter.position.set(0, 1.12, -1.4);
  enter.visible = false;
  enter.userData.activate = () => {
    if (selected?.tour) onEnter(selected);
  };
  group.add(enter);
  targets.push(enter);
  const pins = new Map<string, THREE.Group>();
  const positions: THREE.Vector2[] = [];
  places.forEach((place, index) => {
    const point = pixels[index];
    const actual = new THREE.Vector2(
      ((point.x - left * 256) / pixelWidth - 0.5) * width,
      ((point.y - top * 256) / pixelHeight - 0.5) * depth,
    );
    let offset = actual.clone();
    for (
      let attempt = 0;
      attempt < 20 &&
      positions.some((previous) => previous.distanceTo(offset) < 0.13);
      attempt++
    ) {
      const angle = attempt * 2.4;
      offset = actual
        .clone()
        .add(
          new THREE.Vector2(Math.cos(angle), Math.sin(angle)).multiplyScalar(
            0.1 + attempt * 0.018,
          ),
        );
    }
    positions.push(offset);
    if (offset.distanceTo(actual) > 0.01) {
      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(actual.x, 0.01, actual.y),
          new THREE.Vector3(offset.x, 0.01, offset.y),
        ]),
        new THREE.LineBasicMaterial({ color: 0x746283 }),
      );
      board.add(line);
    }
    const pin = new THREE.Group();
    pin.position.set(offset.x, 0, offset.y);
    board.add(pin);
    pins.set(place.id, pin);
    const color = place.tour
      ? "#783aca"
      : (categories.find((category) => category.id === place.categories[0])
          ?.color ?? "#ab79cf");
    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.04, place.tour ? 0.22 : 0.12, 12),
      new THREE.MeshStandardMaterial({ color }),
    );
    stem.position.y = place.tour ? 0.11 : 0.06;
    pin.add(stem);
    const badgeCanvas = document.createElement("canvas");
    badgeCanvas.width = 256;
    badgeCanvas.height = 256;
    const ctx = badgeCanvas.getContext("2d")!;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(128, 128, 115, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "white";
    ctx.lineWidth = 12;
    ctx.stroke();
    ctx.fillStyle = "white";
    ctx.font = "bold 108px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(String(index + 1), 128, place.tour ? 133 : 165);
    if (place.tour) {
      ctx.font = "bold 48px sans-serif";
      ctx.fillText("360°", 128, 199);
    }
    const texture = new THREE.CanvasTexture(badgeCanvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    textures.add(texture);
    const badge = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: texture, depthTest: false }),
    );
    badge.scale.set(0.21, 0.21, 1);
    badge.position.y = place.tour ? 0.32 : 0.22;
    badge.userData.placeId = place.id;
    badge.userData.activate = () => {
      select(place.id);
      onPick(place);
    };
    pin.add(badge);
    targets.push(badge);
  });
  function select(id: string) {
    selected = places.find((place) => place.id === id);
    for (const [key, pin] of pins) pin.scale.setScalar(key === id ? 1.35 : 1);
    if (!selected) return;
    const previous = infoMaterial.map;
    infoMaterial.map = label(
      selected.name,
      `${selected.address} · ${selected.tour ? "Есть тур 360°" : "Съёмка интерьера пока не добавлена"}`,
    );
    infoMaterial.needsUpdate = true;
    if (previous) {
      textures.delete(previous);
      previous.dispose();
    }
    enter.visible = Boolean(selected.tour);
  }
  return {
    group,
    targets,
    select,
    dispose() {
      disposed = true;
      const geometries = new Set<THREE.BufferGeometry>(),
        materials = new Set<THREE.Material>();
      group.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Line) {
          geometries.add(object.geometry);
          for (const material of Array.isArray(object.material)
            ? object.material
            : [object.material])
            materials.add(material);
        } else if (object instanceof THREE.Sprite)
          materials.add(object.material);
      });
      geometries.forEach((geometry) => geometry.dispose());
      materials.forEach((material) => material.dispose());
      textures.forEach((texture) => texture.dispose());
    },
  };
}
