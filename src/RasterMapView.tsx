import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  ExternalLink,
  LocateFixed,
  Minus,
  Plus,
  RefreshCw,
} from "lucide-react";
import { yandexTileTemplate, type TileProvider } from "./mapTiles";
import {
  categories,
  locationFor,
  places as allPlaces,
  routeUrl,
  type Place,
} from "./data";

type Props = {
  places: Place[];
  selected: string | null;
  onSelect: (id: string) => void;
  provider: TileProvider;
  apiKey?: string;
  theme: "light" | "dark";
  onUnavailable: () => void;
};
type MapStatus = "loading" | "ready" | "error";

export default function RasterMapView({
  places,
  selected,
  onSelect,
  provider,
  apiKey,
  theme,
  onUnavailable,
}: Props) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const markers = useRef<L.LayerGroup | null>(null);
  const tiles = useRef<L.TileLayer | null>(null);
  const [status, setStatus] = useState<MapStatus>("loading");
  const [reload, setReload] = useState(0);
  const unavailable = useRef(onUnavailable);
  unavailable.current = onUnavailable;
  const [mapHref, setMapHref] = useState(
    "https://yandex.ru/maps/2/saint-petersburg/",
  );
  const current = places.find((place) => place.id === selected);

  useEffect(() => {
    if (!container.current) return;
    const instance = L.map(container.current, {
      zoomControl: false,
      attributionControl: false,
      minZoom: 10,
      maxZoom: 20,
      scrollWheelZoom: true,
    });
    instance.fitBounds(
      L.latLngBounds(allPlaces.map((place) => locationFor(place).coordinates)),
      { padding: [55, 55], maxZoom: 13 },
    );
    L.control
      .attribution({ prefix: false, position: "bottomright" })
      .addTo(instance);
    map.current = instance;
    markers.current = L.layerGroup().addTo(instance);
    const updateMapLink = () => {
      const center = instance.getCenter();
      setMapHref(
        `https://yandex.ru/maps/?ll=${center.lng.toFixed(6)}%2C${center.lat.toFixed(6)}&z=${instance.getZoom()}`,
      );
    };
    instance.on("moveend zoomend", updateMapLink);
    updateMapLink();
    const observer = new ResizeObserver(() => instance.invalidateSize());
    observer.observe(container.current);
    return () => {
      observer.disconnect();
      instance.remove();
      map.current = null;
      tiles.current = null;
    };
  }, []);

  useEffect(() => {
    const instance = map.current;
    if (!instance) return;
    setStatus("loading");
    const yandex = provider === "yandex-tiles";
    instance.setMaxZoom(yandex ? 20 : 19);
    const layer = L.tileLayer(
      yandex
        ? yandexTileTemplate(apiKey || "", "map")
        : "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      {
        maxZoom: yandex ? 20 : 19,
        tileSize: 256,
        attribution: yandex
          ? '&copy; <a href="https://yandex.ru/maps/" target="_blank" rel="noreferrer">Яндекс</a>'
          : '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>',
      },
    );
    let loaded = 0;
    let failures = 0;
    let disposed = false;
    let reported = false;
    const failed = () => {
      if (disposed || reported) return;
      reported = true;
      setStatus("error");
      if (yandex) unavailable.current();
    };
    let timer: ReturnType<typeof setTimeout> | undefined;
    const clearTimer = () => {
      if (timer) clearTimeout(timer);
    };
    layer.on("loading", () => {
      if (disposed) return;
      clearTimer();
      loaded = 0;
      failures = 0;
      setStatus((previous) => (previous === "ready" ? "ready" : "loading"));
      timer = setTimeout(() => {
        if (!loaded) failed();
      }, 15000);
    });
    layer.on("tileload", () => {
      if (disposed) return;
      loaded++;
      clearTimer();
      setStatus("ready");
    });
    layer.on("tileerror", () => {
      if (disposed) return;
      failures++;
      if (failures >= 3 && !loaded) {
        clearTimer();
        failed();
      }
    });
    layer.on("load", () => {
      if (disposed) return;
      if (loaded) setStatus("ready");
      else if (failures) failed();
    });
    layer.addTo(instance);
    tiles.current = layer;
    return () => {
      disposed = true;
      clearTimer();
      layer.remove();
      if (tiles.current === layer) tiles.current = null;
    };
  }, [provider, apiKey, reload]);

  useEffect(() => {
    if (!map.current || !markers.current) return;
    markers.current.clearLayers();
    places.forEach((place) => {
      const active = selected === place.id;
      const location = locationFor(place);
      const color = place.council
        ? "#813ed4"
        : categories.find((c) => c.id === place.categories[0])?.color ||
          "#ab79cf";
      const icon = L.divIcon({
        className: "place-pin-wrapper",
        html: `<span class="place-pin ${active ? "is-active" : ""} ${place.council ? "is-council" : ""} ${location.resolved ? "" : "is-approximate"}" style="--pin-color:${color}"><span>${place.council ? "м" : place.kind === "Дом молодёжи" ? "★" : "✦"}</span></span>`,
        iconSize: active ? [48, 56] : [36, 44],
        iconAnchor: active ? [24, 52] : [18, 40],
      });
      const marker = L.marker(location.coordinates, {
        icon,
        title: place.name,
        zIndexOffset: active ? 1000 : place.council ? 500 : 0,
      })
        .bindTooltip(place.name, {
          direction: "top",
          offset: [0, -40],
          className: "place-tooltip",
          permanent: active || place.council,
        })
        .on("click", () => onSelect(place.id))
        .addTo(markers.current!);
      marker
        .getElement()
        ?.setAttribute(
          "aria-label",
          `Открыть ${place.name}${location.resolved ? "" : " · положение уточняется"}`,
        );
    });
    if (current) {
      const location = locationFor(current);
      map.current.setView(
        location.coordinates,
        Math.max(map.current.getZoom(), 15),
        { animate: true },
      );
    }
  }, [places, selected, onSelect, current]);

  function fitAll() {
    if (places.length)
      map.current?.fitBounds(
        L.latLngBounds(places.map((place) => locationFor(place).coordinates)),
        { padding: [55, 55], maxZoom: 14 },
      );
  }
  function retry() {
    setReload((value) => value + 1);
  }

  return (
    <div
      className="map-shell"
      data-map-provider={provider}
      data-map-theme={theme}
    >
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
      {provider !== "yandex-tiles" && (
        <a
          className="map-layer"
          href={
            current
              ? routeUrl(current)
              : "https://yandex.ru/maps/2/saint-petersburg/?ll=30.329%2C59.8565&z=12"
          }
          target="_blank"
          rel="noreferrer"
        >
          Яндекс Карты <ExternalLink size={14} />
        </a>
      )}
      {provider === "yandex-tiles" && (
        <a
          className="yandex-tiles-brand"
          href={mapHref}
          target="_blank"
          rel="noreferrer"
          aria-label="Яндекс Карты — открыть текущий участок"
        >
          <img
            src={`${import.meta.env.BASE_URL}yandex/logo.svg`}
            alt="Яндекс"
          />
        </a>
      )}
      {status === "loading" && (
        <div className="map-loading" role="status">
          Загружаем карту…
        </div>
      )}
      {status === "error" && (
        <div className="map-unavailable" role="status">
          <strong>Карта не загрузилась</strong>
          <p>
            Проверь подключение к интернету. Список клубов и адреса доступны
            ниже или слева.
          </p>
          <div>
            <button onClick={retry}>
              <RefreshCw size={14} />
              Повторить загрузку
            </button>
            <a
              href={
                current
                  ? routeUrl(current)
                  : "https://yandex.ru/maps/?text=Московский%20район%20Санкт-Петербург"
              }
              target="_blank"
              rel="noreferrer"
            >
              Открыть в Яндексе <ExternalLink size={13} />
            </a>
          </div>
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
    </div>
  );
}
