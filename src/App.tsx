import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronRight,
  Clock3,
  Heart,
  Info,
  Map,
  MapPin,
  Music2,
  Palette,
  Search,
  SlidersHorizontal,
  Sparkles,
  Users,
  Dumbbell,
  X,
  Grid2X2,
  ExternalLink,
  Accessibility,
  Copy,
  Phone,
} from "lucide-react";
import MapView from "./MapView";
import Modal from "./Modal";
import {
  activitySuggestions,
  interpretedInterests,
  matchingActivities,
} from "./activitySearch";
import { useTheme } from "./useTheme";
import ThemeSwitch from "./ThemeSwitch";
import VRHeadsetIcon from "./VRHeadsetIcon";
import {
  categories,
  filterPlaces,
  places,
  routeUrl,
  locationFor,
  vkLinkFor,
  DISTRICT_VK_URL,
  organizations,
  SOURCE_DATE,
  SOURCE_URL,
  type Category,
  type Place,
} from "./data";

const VRExperience = lazy(() => import("./VRExperience"));
const categoryIcons = {
  creative: Palette,
  sport: Dumbbell,
  music: Music2,
  growth: Sparkles,
  community: Users,
};

function readFavorites(): string[] {
  try {
    const value: unknown = JSON.parse(
      localStorage.getItem("msmr-favorites") || "[]",
    );
    return Array.isArray(value)
      ? value.filter(
          (id): id is string =>
            typeof id === "string" && places.some((place) => place.id === id),
        )
      : [];
  } catch {
    return [];
  }
}
function initialPlace() {
  const id = new URLSearchParams(window.location.search).get("place");
  return places.some((place) => place.id === id) ? id : null;
}

export default function App() {
  const { preference, theme, changePreference } = useTheme();
  const [query, setQuery] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<Category[]>([]);
  const [favorites, setFavorites] = useState<string[]>(readFavorites);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [only360, setOnly360] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(initialPlace);
  const [view, setView] = useState<"map" | "list">("map");
  const [modal, setModal] = useState<"about" | "vr" | null>(null);
  const [toast, setToast] = useState("");
  const [mobileFilters, setMobileFilters] = useState(false);
  const filtered = useMemo(
    () =>
      filterPlaces(
        query,
        selectedCategories,
        favoritesOnly,
        favorites,
        only360,
      ),
    [query, selectedCategories, favoritesOnly, favorites, only360],
  );
  const selected = places.find((place) => place.id === selectedId);
  const available = useMemo(
    () =>
      filterPlaces("", selectedCategories, favoritesOnly, favorites, only360),
    [selectedCategories, favoritesOnly, favorites, only360],
  );
  const suggestions = useMemo(
    () => activitySuggestions(query, available),
    [query, available],
  );
  const interests = useMemo(() => interpretedInterests(query), [query]);
  const closeModal = useCallback(() => setModal(null), []);
  const selectPlace = useCallback((id: string) => setSelectedId(id), []);

  useEffect(() => {
    try {
      localStorage.setItem("msmr-favorites", JSON.stringify(favorites));
    } catch {
      /* favorites still work for the current session */
    }
  }, [favorites]);
  useEffect(() => {
    const url = new URL(window.location.href);
    if (selectedId) url.searchParams.set("place", selectedId);
    else url.searchParams.delete("place");
    window.history.replaceState(null, "", url);
  }, [selectedId]);
  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(""), 3500);
    return () => window.clearTimeout(timeout);
  }, [toast]);
  useEffect(() => {
    if (!selectedId) return;
    const listener = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedId(null);
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [selectedId]);

  const toggleFavorite = (id: string) =>
    setFavorites((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id],
    );
  const reset = () => {
    setQuery("");
    setSelectedCategories([]);
    setFavoritesOnly(false);
    setOnly360(false);
  };
  const toggleCategory = (id: Category) =>
    setSelectedCategories((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id],
    );

  return (
    <>
      <header className="site-header">
        <a
          href={import.meta.env.BASE_URL}
          className="brand"
          aria-label="Возможности молодёжи в Московском районе — главная"
        >
          <img
            className="brand-symbol"
            src={`${import.meta.env.BASE_URL}moscow-gates.png`}
            alt=""
          />
          <span>
            ВОЗМОЖНОСТИ МОЛОДЁЖИ<small>В МОСКОВСКОМ РАЙОНЕ</small>
          </span>
        </a>
        <nav className="desktop-nav" aria-label="Основная навигация">
          <button
            className={view === "map" ? "nav-active" : ""}
            onClick={() => setView("map")}
          >
            Карта возможностей
          </button>
          <button
            className={view === "list" ? "nav-active" : ""}
            onClick={() => setView("list")}
          >
            Все пространства <span>{places.length}</span>
          </button>
          <button onClick={() => setModal("about")}>О проекте</button>
        </nav>
        <ThemeSwitch preference={preference} onChange={changePreference} />
        <button
          className="vr-nav"
          aria-label="Заглянуть в VR"
          onClick={() => setModal("vr")}
        >
          <VRHeadsetIcon size={20} />
          <span>Заглянуть в VR</span>
          <ArrowUpRight size={16} />
        </button>
      </header>

      <main>
        <section className="hero" aria-labelledby="hero-title">
          <div>
            <p className="eyebrow">
              <span />
              САНКТ-ПЕТЕРБУРГ · МОСКОВСКИЙ РАЙОН
            </p>
            <h1 id="hero-title">
              Твоё место.
              <br />
              <span>Твои возможности.</span>
              <span className="hero-asterisk" aria-hidden="true">
                ✳︎
              </span>
            </h1>
          </div>
          <div className="hero-description">
            <p>
              Творить, двигаться, находить своих.
              <br />
              Открой места рядом, где начинается
              <br className="desktop-br" /> что-то большее.
            </p>
            <p className="hero-cta">Найди своё</p>
          </div>
          <div className="hero-stamp" aria-hidden="true">
            <span>В РАЙОНЕ</span>
            <strong>
              тебя
              <br />
              ждут!
            </strong>
            <Sparkles size={23} />
          </div>
        </section>

        <section
          id="explore"
          className="explorer"
          aria-label="Поиск молодёжных возможностей"
        >
          <div className="filter-bar">
            <label className="search-input">
              <Search size={20} />
              <input
                aria-label="Поиск клуба, занятия или адреса"
                placeholder="Хочу петь, танцевать, бороться…"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              {query && (
                <button
                  onClick={() => setQuery("")}
                  aria-label="Очистить поиск"
                >
                  <X size={17} />
                </button>
              )}
            </label>
            <div
              className={`category-filters ${mobileFilters ? "expanded" : ""}`}
              aria-label="Направления"
            >
              <button
                className={`filter-chip ${!selectedCategories.length ? "selected all-chip" : ""}`}
                onClick={() => setSelectedCategories([])}
              >
                Все
              </button>
              {categories.map((category) => {
                const Icon = categoryIcons[category.id];
                return (
                  <button
                    key={category.id}
                    className={`filter-chip ${selectedCategories.includes(category.id) ? "selected" : ""}`}
                    style={
                      {
                        "--category-color": category.color,
                      } as React.CSSProperties
                    }
                    onClick={() => toggleCategory(category.id)}
                    aria-pressed={selectedCategories.includes(category.id)}
                  >
                    <Icon size={16} />
                    {category.label}
                  </button>
                );
              })}
            </div>
            <button
              className="mobile-filter-button icon-button"
              aria-label="Показать направления"
              aria-expanded={mobileFilters}
              onClick={() => setMobileFilters((value) => !value)}
            >
              <SlidersHorizontal size={20} />
              {selectedCategories.length > 0 && <i />}
            </button>
            <button
              className={`favorites-filter ${favoritesOnly ? "selected" : ""}`}
              aria-label="Избранное"
              onClick={() => setFavoritesOnly((value) => !value)}
              aria-pressed={favoritesOnly}
            >
              <Heart size={19} fill={favoritesOnly ? "currentColor" : "none"} />
              <span>Избранное</span>
              {favorites.length > 0 && <small>{favorites.length}</small>}
            </button>
          </div>

          {interests.length > 0 && (
            <div className="search-insights" aria-label="Занятия по интересам">
              <div className="search-interpretation" role="status">
                <Sparkles size={16} />
                <span>
                  Ищем по интересам: <strong>{interests.join(", ")}</strong>
                </span>
              </div>
              {suggestions.length > 0 && (
                <div className="activity-suggestions">
                  {suggestions.map((suggestion) => (
                    <button
                      key={suggestion.id}
                      onClick={() => setQuery(suggestion.label)}
                    >
                      {suggestion.label}
                      <span>{suggestion.count}</span>
                      <ArrowUpRight size={13} />
                    </button>
                  ))}
                </div>
              )}
              {!filtered.length && suggestions.length > 0 && (
                <p>
                  Для этого запроса подтверждённых занятий не нашлось. Можно
                  посмотреть близкие направления.
                </p>
              )}
            </div>
          )}

          <div className={`workspace ${view === "list" ? "list-mode" : ""}`}>
            <aside className="results-panel">
              <div className="results-heading">
                <div>
                  <span className="eyebrow">МЕСТА ДЛЯ ТЕБЯ</span>
                  <h2>
                    {filtered.length}{" "}
                    <span>
                      {plural(filtered.length, [
                        "пространство",
                        "пространства",
                        "пространств",
                      ])}
                    </span>
                  </h2>
                </div>
                <div className="view-switch">
                  <button
                    className={view === "map" ? "active" : ""}
                    onClick={() => setView("map")}
                    aria-label="Показать карту"
                  >
                    <Map size={17} />
                  </button>
                  <button
                    className={view === "list" ? "active" : ""}
                    onClick={() => setView("list")}
                    aria-label="Показать список"
                  >
                    <Grid2X2 size={17} />
                  </button>
                </div>
              </div>
              <div className="list-options">
                <span>
                  <span className="green-dot" />
                  Бесплатные занятия · 14–35 лет
                </span>
                <button
                  className={only360 ? "active" : ""}
                  onClick={() => setOnly360((value) => !value)}
                  aria-pressed={only360}
                >
                  <VRHeadsetIcon size={14} />
                  360°{only360 && <Check size={12} />}
                </button>
              </div>
              <div className="results-list" aria-label="Найденные пространства">
                {filtered.map((place, index) => (
                  <PlaceCard
                    key={place.id}
                    place={place}
                    index={index}
                    selected={selectedId === place.id}
                    favorite={favorites.includes(place.id)}
                    onSelect={() => selectPlace(place.id)}
                    onFavorite={() => toggleFavorite(place.id)}
                    query={query}
                  />
                ))}
                {!filtered.length && (
                  <div className="empty-state">
                    <Search size={30} />
                    <h3>
                      {only360
                        ? "Панорамы ещё впереди"
                        : favoritesOnly
                          ? "Сохрани своё место"
                          : "Пока ничего не нашлось"}
                    </h3>
                    <p>
                      {only360
                        ? "Добавим виртуальные прогулки, когда появятся фотографии пространств в 360°."
                        : favoritesOnly
                          ? "Нажми на сердечко у пространства — оно появится здесь."
                          : "Попробуй другое название, занятие или убери часть фильтров."}
                    </p>
                    <button className="text-link" onClick={reset}>
                      Показать все пространства <ArrowRight size={16} />
                    </button>
                  </div>
                )}
              </div>
              <div className="source-note">
                <Info size={14} />
                <span>
                  Обновлённый список центра и статья {SOURCE_DATE}. Расписание
                  уточняй у клуба.
                </span>
              </div>
            </aside>

            <div className="map-area">
              <MapView
                theme={theme}
                places={filtered}
                selected={selectedId}
                onSelect={selectPlace}
              />
              {!selected && (
                <div className="map-invite">
                  <span className="invite-spark" aria-hidden="true">
                    ✳︎
                  </span>
                  <div>
                    <strong>Большие идеи начинаются рядом</strong>
                    <p>Нажми на метку и познакомься с местом</p>
                  </div>
                  <ArrowUpRight size={23} />
                </div>
              )}
              {selected && (
                <PlaceDetail
                  place={selected}
                  favorite={favorites.includes(selected.id)}
                  onClose={() => setSelectedId(null)}
                  onFavorite={() => toggleFavorite(selected.id)}
                  onVR={() => setModal("vr")}
                  onToast={setToast}
                />
              )}
            </div>
            {view === "list" && selected && (
              <div
                className="list-detail-backdrop"
                onClick={(event) => {
                  if (event.target === event.currentTarget) setSelectedId(null);
                }}
              >
                <PlaceDetail
                  place={selected}
                  favorite={favorites.includes(selected.id)}
                  onClose={() => setSelectedId(null)}
                  onFavorite={() => toggleFavorite(selected.id)}
                  onVR={() => setModal("vr")}
                  onToast={setToast}
                />
              </div>
            )}
          </div>
        </section>

        <section className="bottom-banner">
          <div className="banner-icon">
            <Users size={26} />
          </div>
          <div>
            <h2>Район становится ближе, когда мы вместе.</h2>
            <p>Знакомься с молодёжным советом. Предлагай, участвуй, меняй.</p>
          </div>
          <a href="https://vk.ru/mr.molsovet" target="_blank" rel="noreferrer">
            Мы ВКонтакте <ArrowUpRight size={18} />
          </a>
        </section>
      </main>
      <footer className="site-footer">
        <p>
          Интерактивная экосистема молодёжных возможностей Московского района
        </p>
        <div>
          <span>Сделано для своих ♡</span>
          <button onClick={() => setModal("about")}>
            О проекте <ArrowUpRight size={13} />
          </button>
        </div>
      </footer>

      {modal === "about" && (
        <Modal title="Возможности — ближе, чем кажется" onClose={closeModal}>
          <div className="about-content">
            <span className="about-mark" aria-hidden="true">
              ✳︎
            </span>
            <p>
              Интерактивная экосистема молодёжных возможностей Московского
              района Санкт-Петербурга помогает найти клуб, секцию или
              пространство рядом с домом.
            </p>
            <h3>{places.length} места. Много способов быть собой.</h3>
            <p>
              Два учреждения подведомственны администрации Московского района.
              Они предлагают бесплатные занятия для молодёжи от 14 до 35 лет.
              Платные занятия показаны отдельно.
            </p>
            <div className="organization-cards">
              {Object.entries(organizations).map(([id, organization]) => (
                <div key={id}>
                  <h3>{organization.name}</h3>
                  <p>{organization.description}</p>
                  <a href={organization.vkUrl} target="_blank" rel="noreferrer">
                    {organization.name} ВКонтакте <ExternalLink size={16} />
                  </a>
                </div>
              ))}
            </div>
            <div className="notice">
              <Info size={19} />
              <p>
                Карта района доступна через Яндекс Карты или резервную
                OpenStreetMap. Перед поездкой проверяй адрес и расписание у
                организаторов.
              </p>
            </div>
            <h3>Скоро — внутри пространств</h3>
            <p>
              Когда появятся фотографии 360°, здесь можно будет прогуляться по
              клубам с телефона, компьютера или в VR-очках. Сейчас доступен
              виртуальный каталог с карточками учреждений.
            </p>
            <div className="about-links">
              <a
                href="https://vk.ru/mr.molsovet"
                target="_blank"
                rel="noreferrer"
              >
                Молодёжный совет <ExternalLink size={16} />
              </a>
              <a href={DISTRICT_VK_URL} target="_blank" rel="noreferrer">
                Администрация Московского района <ExternalLink size={16} />
              </a>
            </div>
            <p className="privacy-note">
              Избранное хранится только в этом браузере. Регистрация и передача
              геолокации не нужны.
            </p>
          </div>
        </Modal>
      )}
      {modal === "vr" && (
        <Modal
          title="Другое измерение возможностей"
          onClose={closeModal}
          className="vr-modal"
        >
          <Suspense
            fallback={
              <div className="vr-loading">
                Собираем виртуальное пространство…
              </div>
            }
          >
            <VRExperience
              places={filtered.length ? filtered : places}
              selected={selected}
              onSelect={(id) => {
                selectPlace(id);
              }}
            />
          </Suspense>
        </Modal>
      )}
      {toast && (
        <div className="toast" role="status">
          <Check size={17} />
          {toast}
        </div>
      )}
    </>
  );
}

function PlaceCard({
  place,
  index,
  selected,
  favorite,
  onSelect,
  onFavorite,
  query,
}: {
  place: Place;
  index: number;
  selected: boolean;
  favorite: boolean;
  onSelect: () => void;
  onFavorite: () => void;
  query: string;
}) {
  const matched = query.trim()
    ? matchingActivities(query, place.activities)
    : [];
  return (
    <article className={`place-card ${selected ? "selected" : ""}`}>
      <button
        className="place-card-main"
        onClick={onSelect}
        aria-label={`Подробнее: ${place.name}`}
      >
        <div className={`place-thumbnail cover-${place.cover}`}>
          <span>
            {place.council ? (
              <Users size={26} />
            ) : place.cover === "music" ? (
              <Music2 size={26} />
            ) : place.cover === "sport" ? (
              <Dumbbell size={26} />
            ) : place.cover === "community" ? (
              <Sparkles size={26} />
            ) : (
              <Palette size={26} />
            )}
          </span>
          <i />
          <small>{String(index + 1).padStart(2, "0")}</small>
        </div>
        <div className="place-card-info">
          <p className="place-kind">
            {place.council
              ? "МОЛОДЁЖНЫЙ СОВЕТ ЗДЕСЬ"
              : place.kind.toUpperCase()}
          </p>
          <h3>{place.name}</h3>
          <p className="place-address">
            <MapPin size={12} />
            {place.address}
          </p>
          <div className="mini-tags">
            {place.categories.slice(0, 2).map((id) => (
              <span key={id}>
                {categories.find((category) => category.id === id)?.label}
              </span>
            ))}
            {place.categories.length > 2 && (
              <span>+{place.categories.length - 2}</span>
            )}
          </div>
          {matched.length > 0 && (
            <p className="matched-activity" title={matched.join(" · ")}>
              <Check size={11} />
              {matched[0]}
              {matched.length > 1 ? ` +${matched.length - 1}` : ""}
            </p>
          )}
        </div>
        <ChevronRight className="card-chevron" size={17} />
      </button>
      <button
        className={`favorite-button ${favorite ? "saved" : ""}`}
        onClick={onFavorite}
        aria-label={`${favorite ? "Убрать из избранного" : "В избранное"}: ${place.name}`}
        aria-pressed={favorite}
      >
        <Heart size={16} fill={favorite ? "currentColor" : "none"} />
      </button>
    </article>
  );
}

function PlaceDetail({
  place,
  favorite,
  onClose,
  onFavorite,
  onVR,
  onToast,
}: {
  place: Place;
  favorite: boolean;
  onClose: () => void;
  onFavorite: () => void;
  onVR: () => void;
  onToast: (text: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [activityQuery, setActivityQuery] = useState("");
  const visibleActivities = activityQuery.trim()
    ? matchingActivities(activityQuery, place.activities)
    : place.activities;
  const visiblePaidActivities = activityQuery.trim()
    ? matchingActivities(activityQuery, place.paidActivities || [])
    : place.paidActivities || [];
  const vk = vkLinkFor(place);
  useEffect(() => {
    setCopied(false);
    setActivityQuery("");
  }, [place.id]);
  async function share() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      onToast("Ссылка на пространство скопирована");
    } catch {
      onToast("Ссылка на место — в адресной строке браузера");
    }
  }
  return (
    <section
      className="place-detail"
      aria-label={`Карточка: ${place.name}`}
      key={place.id}
    >
      <div className={`detail-cover cover-${place.cover}`}>
        <img
          src={`${import.meta.env.BASE_URL}covers/${place.cover}.svg`}
          alt=""
        />
        <span className="illustration-label">Иллюстрация</span>
        <button
          className="detail-back icon-button"
          onClick={onClose}
          aria-label="Закрыть карточку"
        >
          <ArrowLeft size={19} />
        </button>
        <button
          className={`detail-heart icon-button ${favorite ? "saved" : ""}`}
          onClick={onFavorite}
          aria-label={
            favorite ? "Удалить из избранного" : "Сохранить пространство"
          }
        >
          <Heart size={19} fill={favorite ? "currentColor" : "none"} />
        </button>
        <span className="free-label">
          <span />
          {place.fromMap ? "Информация уточняется" : "Бесплатные занятия"}
        </span>
      </div>
      <div className="detail-body">
        <p className="eyebrow">
          {place.kind} · {organizations[place.organization].shortName}
        </p>
        <h2>{place.name}</h2>
        {place.council && (
          <div className="council-label">
            <Users size={15} />
            Офис молодёжного совета
          </div>
        )}
        <p className="detail-description">{place.description}</p>
        <a
          className="club-vk-link"
          href={vk.url}
          target="_blank"
          rel="noreferrer"
        >
          <span className="vk-symbol" aria-hidden="true">
            VK
          </span>
          <span>
            <strong>
              {vk.direct
                ? "Группа клуба ВКонтакте"
                : "Найти группу клуба ВКонтакте"}
            </strong>
            {!vk.direct && (
              <small>
                {place.vkGroupName || place.name} · ссылка уточняется
              </small>
            )}
          </span>
          <ExternalLink size={16} />
        </a>
        <div className="detail-facts">
          <p>
            <MapPin size={17} />
            <span>
              {place.address}
              <small>
                {locationFor(place).resolved
                  ? `Санкт-Петербург · точка по адресу · ${locationFor(place).source}`
                  : "Санкт-Петербург · положение метки уточняется"}
              </small>
            </span>
          </p>
          <p>
            <Clock3 size={17} />
            <span>
              {place.hours || "Расписание уточняй у организаторов"}
              <small>
                {place.updatedProgramme
                  ? "Обновлённый список центра «Московский»"
                  : `По статье от ${SOURCE_DATE}`}
              </small>
            </span>
          </p>
          <p>
            <Accessibility size={17} />
            <span>
              Для молодёжи 14–35 лет
              <small>Условия отдельных студий могут отличаться</small>
            </span>
          </p>
          {place.phone && (
            <p>
              <Phone size={17} />
              <span>
                <a href={`tel:${place.phone.replace(/[^+0-9]/g, "")}`}>
                  {place.phone}
                </a>
                {place.additionalPhones?.map((phone) => (
                  <a href={`tel:${phone.replace(/[^+0-9]/g, "")}`} key={phone}>
                    {phone}
                  </a>
                ))}
                <small>
                  {place.updatedProgramme
                    ? "Контакт из обновлённого списка"
                    : "Телефон с предоставленной карты"}
                </small>
              </span>
            </p>
          )}
        </div>
        <h3 className="activities-heading">
          Что здесь есть{" "}
          <span>
            {visibleActivities.length}
            {activityQuery.trim() ? ` / ${place.activities.length}` : ""}
          </span>
        </h3>
        {place.activitiesNeedConfirmation && (
          <p className="activity-confirmation" role="note">
            Это занятия прежнего клуба «Молодёжный» по данным на {SOURCE_DATE}.
            Актуальные направления центра «Простор» уточняй в его группе
            ВКонтакте.
          </p>
        )}
        {place.activities.length > 0 && (
          <label className="club-activity-search">
            <Search size={15} />
            <input
              value={activityQuery}
              onChange={(event) => setActivityQuery(event.target.value)}
              aria-label="Поиск занятий в этом клубе"
              placeholder="Например, хочу петь"
            />
            {activityQuery && (
              <button
                onClick={() => setActivityQuery("")}
                aria-label="Очистить поиск занятий"
              >
                <X size={14} />
              </button>
            )}
          </label>
        )}
        <div className="activity-tags">
          {place.activities.length > 0 && !visibleActivities.length && (
            <p className="unconfirmed-activities" role="status">
              {visiblePaidActivities.length
                ? "Среди бесплатных занятий совпадений нет. Подходящие платные группы показаны ниже."
                : "В этом клубе такого занятия пока нет в каталоге. Попробуй другой запрос."}
            </p>
          )}
          {!place.activities.length && (
            <p className="unconfirmed-activities">
              Список студий пока уточняется. Позвони в клуб, чтобы узнать о
              занятиях.
            </p>
          )}
          {visibleActivities.map((activity) => (
            <span key={activity}>{activity}</span>
          ))}
        </div>
        {visiblePaidActivities.length > 0 && (
          <section className="paid-activities" aria-label="Платные занятия">
            <h3>Платные занятия</h3>
            <p>Отдельные условия и стоимость уточняй в клубе.</p>
            <ul>
              {visiblePaidActivities.map((activity) => (
                <li key={activity}>{activity}</li>
              ))}
            </ul>
          </section>
        )}
        <div className="tour-preview">
          <div>
            <VRHeadsetIcon size={23} />
            <span>
              <strong>Загляни внутрь</strong>
              <small>Панорамы 360° появятся после съёмки</small>
            </span>
          </div>
          <button onClick={onVR}>
            VR-каталог <ArrowUpRight size={16} />
          </button>
        </div>
        <a
          className="source-detail"
          href={place.fromMap ? "https://vk.ru/mr.molsovet" : SOURCE_URL}
          target="_blank"
          rel="noreferrer"
        >
          {place.fromMap
            ? "Молодёжный совет — уточнить данные"
            : "Данные и контакты в статье совета"}{" "}
          <ExternalLink size={14} />
        </a>
      </div>
      <div className="detail-actions">
        <a href={routeUrl(place)} target="_blank" rel="noreferrer">
          <MapPin size={17} />
          Найти на карте <ArrowUpRight size={16} />
        </a>
        <button
          className="icon-button"
          onClick={share}
          aria-label="Скопировать ссылку на место"
        >
          {copied ? <Check size={19} /> : <Copy size={19} />}
        </button>
      </div>
    </section>
  );
}

function plural(count: number, forms: string[]) {
  const mod100 = count % 100,
    mod10 = count % 10;
  return mod100 >= 11 && mod100 <= 14
    ? forms[2]
    : mod10 === 1
      ? forms[0]
      : mod10 >= 2 && mod10 <= 4
        ? forms[1]
        : forms[2];
}
