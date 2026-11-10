import { lazy, Suspense, useCallback, useMemo, useState } from "react";
import { ArrowLeft, ArrowUpRight, Map, MapPin, Search } from "lucide-react";
import MapView from "./MapView";
import VRHeadsetIcon from "./VRHeadsetIcon";
import { normalize, vkLinkFor, type Place } from "./data";
const PanoramaTour = lazy(() => import("./PanoramaTour"));

type Props = {
  places: Place[];
  selected?: Place;
  onSelect: (id: string) => void;
  theme: "light" | "dark";
  initialTour?: boolean;
};

export default function VRExperience({
  places,
  selected,
  onSelect,
  theme,
  initialTour,
}: Props) {
  const [tourId, setTourId] = useState<string | null>(
    initialTour && selected?.tour ? selected.id : null,
  );
  const [mode, setMode] = useState<"map" | "vr">("map");
  const [query, setQuery] = useState("");
  const [vrTourRequest, setVrTourRequest] = useState<{
    id: string;
    token: number;
  }>();
  const [onlyTours, setOnlyTours] = useState(false);
  const activeTour = places.find((place) => place.id === tourId);
  const firstTour = places.find((place) => place.tour);
  const tours = places.filter((place) => place.tour).length;
  const visible = useMemo(
    () =>
      places.filter(
        (place) =>
          (!onlyTours || place.tour) &&
          normalize(`${place.name} ${place.address}`).includes(
            normalize(query),
          ),
      ),
    [places, query, onlyTours],
  );
  const select = useCallback(
    (id: string) => {
      onSelect(id);
    },
    [onSelect],
  );
  function returnToMap() {
    setTourId(null);
    setMode("map");
  }
  function choose(id: string) {
    select(id);
    if (tourId)
      setTourId(places.find((place) => place.id === id)?.tour ? id : null);
  }
  return (
    <div className="explore-content">
      <div className="explore-toolbar">
        <div
          className="explore-modes"
          role="group"
          aria-label="Способ просмотра пространств"
        >
          <button
            aria-pressed={mode === "map" && !tourId}
            onClick={returnToMap}
          >
            <Map size={17} />
            Карта и клубы
          </button>
          <button
            aria-pressed={mode === "vr"}
            onClick={() => {
              setMode("vr");
              setTourId(null);
            }}
          >
            <VRHeadsetIcon size={18} />
            Макет района · VR
          </button>
        </div>
        <span>
          {places.length} пространства · туры 360°: {tours}
        </span>
      </div>
      <div
        className={`explore-layout ${tourId ? "is-tour" : ""} ${mode === "vr" ? "is-vr" : ""}`}
      >
        <div className="explore-stage">
          <div
            className="explore-map"
            hidden={Boolean(tourId) || mode === "vr"}
            aria-label="Карта каталога пространств"
          >
            <MapView
              places={visible}
              selected={selected?.id ?? null}
              onSelect={select}
              theme={theme}
            />
            {!selected && (
              <div className="explore-map-hint">
                Выбери клуб на карте или в списке
              </div>
            )}
          </div>
          <Suspense
            fallback={<div className="vr-loading">Открываем пространство…</div>}
          >
            {mode === "map" && activeTour?.tour && (
              <PanoramaTour
                key={activeTour.id}
                place={activeTour}
                onCatalogue={returnToMap}
              />
            )}
            {mode === "vr" && firstTour && (
              <PanoramaTour
                place={firstTour}
                districtPlaces={places}
                selectedPlaceId={selected?.id}
                requestTour={vrTourRequest}
                onSelectPlace={select}
                onCatalogue={returnToMap}
              />
            )}
          </Suspense>
        </div>
        <aside className="explore-sidebar" aria-label="Выбор пространства">
          {selected && (
            <section
              className="explore-selected"
              aria-label={`Выбрано: ${selected.name}`}
            >
              <div className="explore-selection-heading">
                <span>{selected.kind}</span>
                {selected.tour && (
                  <span className="explore-tour-badge">Есть тур 360°</span>
                )}
              </div>
              <h3>{selected.name}</h3>
              <p>
                <MapPin size={14} />
                {selected.address}
              </p>
              <p className="explore-activities">
                {selected.activities.slice(0, 3).join(" · ")}
              </p>
              {selected.tour ? (
                <button
                  className="explore-enter"
                  onClick={() => {
                    if (mode === "vr")
                      setVrTourRequest({ id: selected.id, token: Date.now() });
                    else setTourId(selected.id);
                  }}
                >
                  Заглянуть внутрь <ArrowUpRight size={17} />
                </button>
              ) : (
                <p className="explore-no-tour">
                  Съёмка интерьера пока не добавлена
                </p>
              )}
              <a
                href={vkLinkFor(selected).url}
                target="_blank"
                rel="noreferrer"
              >
                Группа клуба ВКонтакте <ArrowUpRight size={13} />
              </a>
            </section>
          )}
          <div className="explore-search">
            <label>
              <Search size={16} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Название или адрес"
                aria-label="Найти пространство в каталоге"
              />
            </label>
            <button
              aria-pressed={onlyTours}
              onClick={() => setOnlyTours((value) => !value)}
            >
              Только с туром 360°
            </button>
            <span>
              Пространства <strong>{visible.length}</strong>
            </span>
          </div>
          <div
            className="explore-place-list"
            aria-label="Все пространства района"
          >
            {visible.map((place, index) => (
              <button
                key={place.id}
                className={selected?.id === place.id ? "is-selected" : ""}
                aria-pressed={selected?.id === place.id}
                aria-label={`Выбрать клуб: ${place.name}`}
                onClick={() => choose(place.id)}
              >
                <span className="explore-place-number">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span>
                  <strong>{place.name}</strong>
                  <small>{place.address}</small>
                </span>
                {place.tour && <span className="explore-tour-badge">360°</span>}
              </button>
            ))}
            {!visible.length && (
              <p className="explore-empty">
                Ничего не найдено. Попробуй другое название или адрес.
              </p>
            )}
          </div>
          {tourId && (
            <button className="explore-map-return" onClick={returnToMap}>
              <ArrowLeft size={16} />
              Вернуться на карту
            </button>
          )}
        </aside>
      </div>
    </div>
  );
}
