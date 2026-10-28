import { appendFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { yandexTileTemplate } from "../src/mapTiles.ts";

export async function checkTiles(key, request = fetch) {
  if (!key?.trim()) return { ok: false, reason: "missing-key" };
  const zoom = 12,
    size = 2 ** zoom,
    lat = (59.8565 * Math.PI) / 180;
  const x = Math.floor(((30.329 + 180) / 360) * size);
  const y = Math.floor(
    ((1 - Math.log(Math.tan(lat) + 1 / Math.cos(lat)) / Math.PI) / 2) * size,
  );
  const url = yandexTileTemplate(key.trim())
    .replace("{x}", String(x))
    .replace("{y}", String(y))
    .replace("{z}", String(zoom));
  try {
    const response = await request(url, {
      headers: { Referer: "https://molmoskovsky.ru/" },
      redirect: "error",
      signal: AbortSignal.timeout(15000),
    });
    const image = Boolean(
      response.headers.get("content-type")?.toLowerCase().startsWith("image/"),
    );
    const reader = response.body?.getReader();
    const chunk = reader ? await reader.read() : undefined;
    await reader?.cancel();
    return {
      ok: response.ok && image && Boolean(chunk?.value?.length),
      httpStatus: response.status,
      image,
    };
  } catch {
    // Do not print fetch errors: they can contain the URL with the client key.
    return { ok: false, reason: "network-or-timeout" };
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const result = await checkTiles(process.env.VITE_YANDEX_TILES_API_KEY);
  console.log("Yandex Tiles readiness:", JSON.stringify(result));
  if (process.env.GITHUB_STEP_SUMMARY) {
    const message = result.ok
      ? "Яндекс вернул изображение тайла."
      : result.httpStatus === 403
        ? "Доступ отклонён. Проверьте ключ Tiles API, активацию (до 15 минут) и ограничения ключа."
        : result.httpStatus === 429
          ? "Яндекс отклонил запрос из-за частоты запросов."
          : "Проверка не подтвердила доступность сервиса из runner. Сайт использует резервную карту при ошибке.";
    await appendFile(
      process.env.GITHUB_STEP_SUMMARY,
      `## Проверка Yandex Tiles API\n\n${message}\n\nHTTP: ${result.httpStatus ?? "ответ не получен"}. Изображение: ${result.image ? "да" : "не подтверждено"}.\n`,
    );
  }
  process.exitCode = result.ok ? 0 : 1;
}
