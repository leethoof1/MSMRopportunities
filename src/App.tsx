import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  ArrowDown,
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
  Glasses,
  Grid2X2,
  ExternalLink,
  Accessibility,
  Copy,
  Phone,
} from "lucide-react";
import MapView from "./MapView";
import Modal from "./Modal";
import {
  categories,
  filterPlaces,
  places,
  routeUrl,
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
          aria-label="Молодёжный совет Московского района — главная"
        >
          <span className="brand-symbol">
            м<span>с</span>
            <i />
          </span>
          <span>
            МОЛОДЁЖНЫЙ СОВЕТ<small>МОСКОВСКОГО РАЙОНА</small>
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
        <button className="vr-nav" onClick={() => setModal("vr")}>
          <Glasses size={20} />
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
            <a href="#explore" className="hero-cta">
              Найди своё{" "}
              <span>
                <ArrowDown size={17} />
              </span>
            </a>
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
                placeholder="Клуб, занятие или адрес"
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
                  <Glasses size={14} />
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
                  Данные на {SOURCE_DATE}. Уточняй расписание перед визитом.
                </span>
              </div>
            </aside>

            <div className="map-area">
              <MapView
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
            <h2>Район становится ближе, когда вы вместе.</h2>
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
              Учреждения МПЦ «Московский» и Дома молодёжи «Пулковец». В статье
              указаны бесплатные занятия для молодёжи от 14 до 35 лет; у
              отдельных студий есть дополнительные возрастные условия.
            </p>
            <div className="notice">
              <Info size={19} />
              <p>
                Первая версия проекта. Данные из статьи молодёжного совета
                актуальны на <strong>{SOURCE_DATE}</strong>. «Искорка» и
                телефоны добавлены из предоставленной карты, дата которой не
                указана. Точки на карте пока размещены приблизительно, схема не
                показывает официальные границы района. Перед поездкой проверяй
                адрес и расписание у организаторов.
              </p>
            </div>
            <h3>Скоро — внутри пространств</h3>
            <p>
              Когда появятся фотографии 360°, здесь можно будет прогуляться по
              клубам с телефона, компьютера или в VR-очках. Сейчас доступен
              виртуальный каталог с карточками учреждений.
            </p>
            <div className="about-links">
              <a href={SOURCE_URL} target="_blank" rel="noreferrer">
                Статья — источник данных <ExternalLink size={16} />
              </a>
              <a
                href="https://vk.ru/mr.molsovet"
                target="_blank"
                rel="noreferrer"
              >
                Молодёжный совет <ExternalLink size={16} />
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
}: {
  place: Place;
  index: number;
  selected: boolean;
  favorite: boolean;
  onSelect: () => void;
  onFavorite: () => void;
}) {
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
  useEffect(() => setCopied(false), [place.id]);
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
          {place.kind} ·{" "}
          {place.organization === "mpc" ? "МПЦ «Московский»" : "ДМ «Пулковец»"}
        </p>
        <h2>{place.name}</h2>
        {place.council && (
          <div className="council-label">
            <Users size={15} />
            Офис молодёжного совета
          </div>
        )}
        <p className="detail-description">{place.description}</p>
        <div className="detail-facts">
          <p>
            <MapPin size={17} />
            <span>
              {place.address}
              <small>Санкт-Петербург · координаты уточняются</small>
            </span>
          </p>
          <p>
            <Clock3 size={17} />
            <span>
              {place.hours || "Расписание уточняй у организаторов"}
              <small>
                {place.fromMap
                  ? "По карте учреждений · дата не указана"
                  : `По данным на ${SOURCE_DATE}`}
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
                <small>Телефон с предоставленной карты</small>
              </span>
            </p>
          )}
        </div>
        <h3 className="activities-heading">
          Что здесь есть <span>{place.activities.length}</span>
        </h3>
        <div className="activity-tags">
          {!place.activities.length && (
            <p className="unconfirmed-activities">
              Список студий пока уточняется. Позвони в клуб, чтобы узнать о
              занятиях.
            </p>
          )}
          {place.activities.map((activity) => (
            <span key={activity}>{activity}</span>
          ))}
        </div>
        <div className="tour-preview">
          <div>
            <Glasses size={23} />
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
