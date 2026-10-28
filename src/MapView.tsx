import { lazy, Suspense, useCallback, useState } from "react";
import OSMMapView from "./OSMMapView";
import type { Place } from "./data";
import type { YandexFailureCode } from "./yandexMaps";

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
  const [networkFailure, setNetworkFailure] =
    useState<YandexFailureCode | null>(null);
  const handleNetworkFailure = useCallback((code: YandexFailureCode) => {
    setNetworkFailure(code);
    setUseOSM(true);
  }, []);
  if (useOSM || !key)
    return (
      <>
        <OSMMapView
          places={props.places}
          selected={props.selected}
          onSelect={props.onSelect}
        />
        {networkFailure && (
          <div className="map-provider-fallback" role="status">
            <span>Яндекс Карты недоступны. Открыта резервная карта.</span>
            <button
              onClick={() => {
                setNetworkFailure(null);
                setUseOSM(false);
              }}
            >
              Повторить Яндекс
            </button>
            <small>{networkFailure}</small>
          </div>
        )}
      </>
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
        onNetworkFailure={handleNetworkFailure}
      />
    </Suspense>
  );
}
