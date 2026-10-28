import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Compass, Layers, LocateFixed, Minus, Plus } from "lucide-react";
import { categories, type Place } from "./data";

type Props = {
  places: Place[];
  selected: string | null;
  onSelect: (id: string) => void;
};

export default function MapView({ places, selected, onSelect }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const markers = useRef<L.LayerGroup | null>(null);
  const tiles = useRef<L.TileLayer | null>(null);
  const [geographic, setGeographic] = useState(false);
  const [tileError, setTileError] = useState(false);

  useEffect(() => {
    if (!container.current) return;
    const instance = L.map(container.current, {
      zoomControl: false,
      attributionControl: false,
      minZoom: 10,
      maxZoom: 18,
      scrollWheelZoom: true,
    }).setView([59.8565, 30.329], 13);
    L.imageOverlay(
      `${import.meta.env.BASE_URL}district-map.svg`,
      [
        [59.79, 30.21],
        [59.925, 30.44],
      ],
      { interactive: false },
    ).addTo(instance);
    map.current = instance;
    markers.current = L.layerGroup().addTo(instance);
    const observer = new ResizeObserver(() => instance.invalidateSize());
    observer.observe(container.current);
    return () => {
      observer.disconnect();
      instance.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    if (!map.current || !markers.current) return;
    markers.current.clearLayers();
    places.forEach((place) => {
      const active = selected === place.id;
      const color = place.council
        ? "#813ed4"
        : categories.find((c) => c.id === place.categories[0])?.color ||
          "#ab79cf";
      const icon = L.divIcon({
        className: "place-pin-wrapper",
        html: `<span class="place-pin ${active ? "is-active" : ""} ${place.council ? "is-council" : ""}" style="--pin-color:${color}"><span>${place.council ? "м" : place.kind === "Дом молодёжи" ? "★" : "✦"}</span></span>`,
        iconSize: active ? [48, 56] : [36, 44],
        iconAnchor: active ? [24, 52] : [18, 40],
      });
      L.marker(place.coordinates, {
        icon,
        title: place.name,
        alt: `Открыть ${place.name}`,
        zIndexOffset: active ? 1000 : place.council ? 500 : 0,
      })
        .bindTooltip(place.name, {
          direction: "top",
          offset: [0, -40],
          className: "place-tooltip",
        })
        .on("click", () => onSelect(place.id))
        .addTo(markers.current!);
    });
    const current = places.find((place) => place.id === selected);
    if (current) map.current.panTo(current.coordinates, { animate: true });
  }, [places, selected, onSelect]);

  useEffect(() => {
    if (!map.current) return;
    if (geographic) {
      setTileError(false);
      const layer = L.tileLayer(
        "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
        { maxZoom: 19, crossOrigin: true },
      );
      let failures = 0;
      layer.on("tileerror", () => {
        if (++failures >= 3) setTileError(true);
      });
      layer.on("tileload", () => setTileError(false));
      layer.addTo(map.current);
      tiles.current = layer;
    } else {
      tiles.current?.remove();
      tiles.current = null;
    }
    return () => {
      tiles.current?.remove();
      tiles.current = null;
    };
  }, [geographic]);

  function fitAll() {
    if (!places.length) return;
    map.current?.fitBounds(
      L.latLngBounds(places.map((place) => place.coordinates)),
      { padding: [55, 55], maxZoom: 14 },
    );
  }

  return (
    <div className="map-shell">
      <div
        className="map-canvas"
        ref={container}
        aria-label="Карта молодёжных пространств Московского района"
      />
      <div className="map-heading">
        <span className="live-dot" />
        <span>Московский район</span>
        <small>Санкт-Петербург</small>
      </div>
      <button
        className={`map-layer ${geographic ? "active" : ""}`}
        onClick={() => setGeographic((value) => !value)}
        aria-label="Переключить схему и карту OpenStreetMap"
      >
        <Layers size={17} />
        {geographic ? "Карта OSM" : "Схема района"}
      </button>
      {tileError && geographic && (
        <div className="map-warning" role="status">
          Картографический сервис недоступен.{" "}
          <button onClick={() => setGeographic(false)}>Открыть схему</button>
        </div>
      )}
      <div className="map-tools">
        <button
          onClick={() => map.current?.zoomIn()}
          aria-label="Приблизить карту"
        >
          <Plus size={21} />
        </button>
        <button
          onClick={() => map.current?.zoomOut()}
          aria-label="Отдалить карту"
        >
          <Minus size={21} />
        </button>
        <span />
        <button
          onClick={fitAll}
          aria-label="Показать все найденные места"
          title="Показать все найденные места"
        >
          <LocateFixed size={20} />
        </button>
      </div>
      <div className="map-compass">
        <Compass size={26} strokeWidth={1.2} />
        <small>С</small>
      </div>
      <div className="map-note">
        {geographic ? (
          <a
            href="https://www.openstreetmap.org/copyright"
            target="_blank"
            rel="noreferrer"
          >
            © OpenStreetMap
          </a>
        ) : (
          "Обзорная схема"
        )}
        <span>·</span>Метки предварительные
      </div>
    </div>
  );
}
