export type YandexMapType = "map" | "admin" | "transit";
export type TileProvider = "openstreetmap" | "yandex-tiles";

// https://yandex.ru/maps-api/docs/tiles-api/index.html
// No theme parameter is documented. Night display is CSS, not a provider style.
export function yandexTileTemplate(
  apiKey: string,
  maptype: YandexMapType = "map",
) {
  return `https://tiles.api-maps.yandex.ru/v1/tiles/?apikey=${encodeURIComponent(apiKey)}&lang=ru_RU&l=map&scale=1&projection=web_mercator&maptype=${maptype}&x={x}&y={y}&z={z}`;
}
