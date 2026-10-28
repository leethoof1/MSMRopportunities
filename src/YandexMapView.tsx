import { useEffect, useRef, useState } from "react";
import {
  ExternalLink,
  Layers,
  LocateFixed,
  Minus,
  Plus,
  RefreshCw,
} from "lucide-react";
import type { LngLat, YMap, YMapMarker } from "@yandex/ymaps3-types";
import {
  categories,
  locationFor,
  places as allPlaces,
  routeUrl,
  type Place,
} from "./data";
import { loadYandexMaps, type YandexSDK } from "./yandexMaps";

type Props = {
  places: Place[];
  selected: string | null;
  onSelect: (id: string) => void;
  theme: "light" | "dark";
  apiKey: string;
  onFallback: () => void;
};
const coordinate = (place: Place): LngLat => {
  const [lat, lon] = locationFor(place).coordinates;
  return [lon, lat];
};
function boundsFor(places: Place[]): [LngLat, LngLat] {
  const positions = places.map(coordinate);
  const xs = positions.map((p) => p[0]),
    ys = positions.map((p) => p[1]);
  return [
    [Math.min(...xs) - 0.006, Math.min(...ys) - 0.006],
    [Math.max(...xs) + 0.006, Math.max(...ys) + 0.006],
  ];
}

export default function YandexMapView({
  places,
  selected,
  onSelect,
  theme,
  apiKey,
  onFallback,
}: Props) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<YMap | null>(null);
  const sdk = useRef<YandexSDK | null>(null);
  const markers = useRef<YMapMarker[]>([]);
  const latestTheme = useRef(theme);
  latestTheme.current = theme;
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const current = places.find((place) => place.id === selected);
  const approximateCount = places.filter(
    (place) => !locationFor(place).resolved,
  ).length;

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    setFailed(false);
    void loadYandexMaps(apiKey)
      .then((api) => {
        if (cancelled || !container.current) return;
        const instance = new api.YMap(container.current, {
          location: { bounds: boundsFor(allPlaces) },
          theme: latestTheme.current,
          mode: "vector",
          zoomRange: { min: 10, max: 19 },
        });
        instance.addChild(new api.YMapDefaultSchemeLayer({}));
        instance.addChild(new api.YMapDefaultFeaturesLayer({}));
        sdk.current = api;
        map.current = instance;
        setReady(true);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      markers.current = [];
      map.current?.destroy();
      map.current = null;
      sdk.current = null;
    };
  }, [apiKey, attempt]);

  useEffect(() => {
    map.current?.update({ theme });
  }, [theme, ready]);
  useEffect(() => {
    const instance = map.current,
      api = sdk.current;
    if (!instance || !api || !ready) return;
    for (const marker of markers.current) instance.removeChild(marker);
    markers.current = places.map((place) => {
      const active = selected === place.id;
      const location = locationFor(place);
      const content = document.createElement("button");
      content.type = "button";
      content.className = "yandex-place-marker";
      content.setAttribute(
        "aria-label",
        `Открыть ${place.name}${location.resolved ? "" : " · положение уточняется"}`,
      );
      content.title = place.name;
      const pin = document.createElement("span");
      pin.className = `place-pin ${active ? "is-active" : ""} ${location.resolved ? "" : "is-approximate"}`;
      pin.style.setProperty(
        "--pin-color",
        categories.find((category) => category.id === place.categories[0])
          ?.color || "#ab79cf",
      );
      const symbol = document.createElement("span");
      symbol.textContent = place.kind === "Дом молодёжи" ? "★" : "✦";
      pin.appendChild(symbol);
      content.appendChild(pin);
      content.addEventListener("click", (event) => {
        event.stopPropagation();
        onSelect(place.id);
      });
      const marker = new api.YMapMarker(
        { coordinates: coordinate(place), zIndex: active ? 1000 : 1 },
        content,
      );
      instance.addChild(marker);
      return marker;
    });
    if (current)
      instance.setLocation({
        center: coordinate(current),
        zoom: Math.max(instance.zoom, 15),
        duration: 300,
      });
  }, [places, selected, onSelect, current, ready]);

  return (
    <div
      className="map-shell"
      data-map-provider="yandex"
      data-map-theme={theme}
    >
      <div
        className="map-canvas yandex-map-canvas"
        ref={container}
        aria-label="Карта молодёжных пространств Московского района"
      />
      <div className="map-heading">
        <span className="live-dot" />
        <span>Московский район</span>
        <small>Санкт-Петербург</small>
      </div>
      <div className="yandex-scheme-label">
        <Layers size={15} />
        Схема Яндекса<span>{theme === "dark" ? "Тёмная" : "Светлая"}</span>
      </div>
      {!ready && !failed && (
        <div className="map-loading" role="status">
          Загружаем Яндекс Карты…
        </div>
      )}
      {failed && (
        <div className="map-unavailable" role="status">
          <strong>Яндекс Карты не загрузились</strong>
          <p>
            Можно повторить загрузку или открыть другую карту. Каталог клубов
            остаётся доступен.
          </p>
          <div>
            <button onClick={() => setAttempt((value) => value + 1)}>
              <RefreshCw size={14} />
              Повторить загрузку
            </button>
            <button onClick={onFallback}>Открыть OpenStreetMap</button>
            <a
              href={
                current
                  ? routeUrl(current)
                  : "https://yandex.ru/maps/2/saint-petersburg/"
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
          disabled={!ready}
          onClick={() =>
            map.current?.setLocation({
              zoom: Math.min(map.current.zoom + 1, 19),
              duration: 200,
            })
          }
          aria-label="Приблизить карту"
        >
          <Plus size={21} />
        </button>
        <button
          disabled={!ready}
          onClick={() =>
            map.current?.setLocation({
              zoom: Math.max(map.current.zoom - 1, 10),
              duration: 200,
            })
          }
          aria-label="Отдалить карту"
        >
          <Minus size={21} />
        </button>
        <span />
        <button
          disabled={!ready || !places.length}
          onClick={() =>
            map.current?.setLocation({
              bounds: boundsFor(places),
              duration: 300,
            })
          }
          aria-label="Показать все найденные места"
        >
          <LocateFixed size={20} />
        </button>
      </div>
      <div className="map-coordinate-note">
        {approximateCount
          ? `Положение ${approximateCount} мест уточняется`
          : "Метки по адресам"}
      </div>
    </div>
  );
}
