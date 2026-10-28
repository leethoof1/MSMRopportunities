import { useState } from "react";
import RasterMapView from "./RasterMapView";
import type { Place } from "./data";

type Props = {
  places: Place[];
  selected: string | null;
  onSelect: (id: string) => void;
  theme: "light" | "dark";
};

export default function MapView(props: Props) {
  const apiKey = import.meta.env.VITE_YANDEX_TILES_API_KEY?.trim();
  const [fallback, setFallback] = useState(false);
  const [failed, setFailed] = useState(false);
  const provider = apiKey && !fallback ? "yandex-tiles" : "openstreetmap";
  return (
    <>
      <RasterMapView
        {...props}
        apiKey={apiKey}
        provider={provider}
        onUnavailable={() => {
          setFailed(true);
          setFallback(true);
        }}
      />
      {failed && (
        <div className="map-provider-fallback" role="status">
          <span>Тайлы Яндекса не загрузились. Открыта резервная карта.</span>
          <button
            onClick={() => {
              setFailed(false);
              setFallback(false);
            }}
          >
            Повторить Яндекс
          </button>
        </div>
      )}
    </>
  );
}
