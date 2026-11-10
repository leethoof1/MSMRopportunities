import * as THREE from "three";
import { categories, locationFor, type Place } from "./data";

function mercator(latitude: number, longitude: number, zoom: number) {
  const sine = Math.sin((latitude * Math.PI) / 180);
  return new THREE.Vector2(
    ((longitude + 180) / 360) * 2 ** zoom * 256,
    (0.5 - Math.log((1 + sine) / (1 - sine)) / (4 * Math.PI)) * 2 ** zoom * 256,
  );
}

/** An eye-level curved map; all pins follow the same projection as its tiles. */
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

  const top = Math.floor((Math.min(...pixels.map((p) => p.y)) - 70) / 256);

  const bottom = Math.floor((Math.max(...pixels.map((p) => p.y)) + 70) / 256);
  // Expand the visible extent horizontally, preserving the map's scale.
  const rows = bottom - top + 1,
    columns = rows * 2;
  const middleX =
    (Math.min(...pixels.map((p) => p.x)) +
      Math.max(...pixels.map((p) => p.x))) /
    2;
  const left = Math.floor(middleX / 256 - columns / 2),
    right = left + columns - 1;
  const pixelWidth = columns * 256,
    pixelHeight = rows * 256;
  const width = 5.8,
    height = 2.9,
    radius = 3.4,
    centerY = 1.65;
  function onMap(u: number, v: number, lift = 0) {
    const angle = ((u - 0.5) * width) / radius;
    return new THREE.Vector3(
      Math.sin(angle) * (radius - lift),
      centerY + (0.5 - v) * height,
      -Math.cos(angle) * (radius - lift),
    );
  }
  function curvedGeometry(w: number, h: number, r: number) {
    const geometry = new THREE.PlaneGeometry(w, h, 96, 32);
    const positions = geometry.getAttribute("position");
    for (let index = 0; index < positions.count; index++) {
      const x = positions.getX(index),
        y = positions.getY(index),
        angle = x / r;
      positions.setXYZ(
        index,
        Math.sin(angle) * r,
        centerY + y,
        -Math.cos(angle) * r,
      );
    }
    geometry.computeVertexNormals();
    return geometry;
  }
  const board = new THREE.Group();
  group.add(board);
  const frame = new THREE.Mesh(
    curvedGeometry(width + 0.08, height + 0.08, radius + 0.04),
    new THREE.MeshBasicMaterial({ color: 0x8c71a9, side: THREE.DoubleSide }),
  );
  board.add(frame);
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
    curvedGeometry(width, height, radius),
    new THREE.MeshBasicMaterial({ map: mapTexture }),
  );
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
    transparent: true,
    depthTest: false,
  });
  const info = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 0.625), infoMaterial);
  info.position.set(-0.5, 0.1, -3.1);
  info.renderOrder = 10;
  group.add(info);
  const enterMaterial = new THREE.MeshBasicMaterial({
    map: label("Заглянуть внутрь →", "Открыть панораму 360°", true),
    side: THREE.DoubleSide,
    transparent: true,
    depthTest: false,
  });
  const enter = new THREE.Mesh(
    new THREE.PlaneGeometry(1.2, 0.3),
    enterMaterial,
  );
  enter.position.set(1.85, 0.22, -2.65);
  enter.renderOrder = 10;
  enter.lookAt(0, 1.65, 0);
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
      ((point.y - top * 256) / pixelHeight - 0.5) * height,
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
          onMap(actual.x / width + 0.5, actual.y / height + 0.5, 0.012),
          onMap(offset.x / width + 0.5, offset.y / height + 0.5, 0.012),
        ]),
        new THREE.LineBasicMaterial({ color: 0x746283 }),
      );
      board.add(line);
    }
    const pin = new THREE.Group();
    pin.position.copy(
      onMap(offset.x / width + 0.5, offset.y / height + 0.5, 0.06),
    );
    board.add(pin);
    pins.set(place.id, pin);
    const color = place.tour
      ? "#783aca"
      : (categories.find((category) => category.id === place.categories[0])
          ?.color ?? "#ab79cf");
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
    halfWidth: Math.sin(width / (2 * radius)) * radius,
    edgeZ: -Math.cos(width / (2 * radius)) * radius,
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
