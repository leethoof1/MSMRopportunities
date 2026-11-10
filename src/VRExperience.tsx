import { lazy, Suspense, useCallback, useMemo, useState } from "react";
import { ArrowUpRight, MapPin, Search } from "lucide-react";
import VRHeadsetIcon from "./VRHeadsetIcon";
import { normalize, vkLinkFor, type Place } from "./data";
const PanoramaTour = lazy(() => import("./PanoramaTour"));

type Props = {
  places: Place[];
  selected?: Place;
  onSelect: (id: string) => void;
  initialTour?: boolean;
};

export default function VRExperience({
  places,
  selected,
  onSelect,
  initialTour,
}: Props) {
  const [query, setQuery] = useState("");
  const [vrTourRequest, setVrTourRequest] = useState<
    | {
        id: string;
        token: number;
      }
    | undefined
  >(() =>
    initialTour && selected?.tour ? { id: selected.id, token: 0 } : undefined,
  );
  const [onlyTours, setOnlyTours] = useState(false);
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
  return (
    <div className="explore-content">
      <div className="explore-toolbar">
        <span className="explore-vr-title">
          <VRHeadsetIcon size={18} />
          Карта района · VR
        </span>
        <span>
          {places.length} пространства · туры 360°: {tours}
        </span>
      </div>
      <div className="explore-layout is-vr">
        <div className="explore-stage">
          <Suspense
            fallback={<div className="vr-loading">Открываем пространство…</div>}
          >
            {firstTour && (
              <PanoramaTour
                place={firstTour}
                districtPlaces={places}
                selectedPlaceId={selected?.id}
                requestTour={vrTourRequest}
                onSelectPlace={select}
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
                  onClick={() =>
                    setVrTourRequest({ id: selected.id, token: Date.now() })
                  }
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
                onClick={() => select(place.id)}
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
        </aside>
      </div>
    </div>
  );
}
