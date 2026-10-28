import { lazy, Suspense, useState } from "react";
import OSMMapView from "./OSMMapView";
import type { Place } from "./data";

const YandexMapView = lazy(() => import("./YandexMapView"));
type Props = {
  places: Place[];
  selected: string | null;
  onSelect: (id: string) => void;
  theme: "light" | "dark";
};

export default function MapView(props: Props) {
  const key = import.meta.env.VITE_YANDEX_MAPS_API_KEY?.trim();
  const [useOSM, setUseOSM] = useState(!key);
  if (useOSM || !key)
    return (
      <OSMMapView
        places={props.places}
        selected={props.selected}
        onSelect={props.onSelect}
      />
    );
  return (
    <Suspense
      fallback={
        <div className="map-shell">
          <div className="map-loading" role="status">
            Загружаем Яндекс Карты…
          </div>
        </div>
      }
    >
      <YandexMapView
        {...props}
        apiKey={key}
        onFallback={() => setUseOSM(true)}
      />
    </Suspense>
  );
}
