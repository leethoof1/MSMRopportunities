import { test, expect, type Page, type Route } from "@playwright/test";

const tiles = "https://tiles.api-maps.yandex.ru/v1/tiles/**";
// This is only a transport fixture, not a claimed live cartographic image.
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
  "base64",
);
const imageResponse = { contentType: "image/png", body: png };

async function setTheme(page: Page, theme: "dark" | "light" | "system") {
  const select = page.locator('select[aria-label="Тема оформления"]');
  if (await select.isVisible()) await select.selectOption(theme);
  else
    await page
      .getByRole("button", {
        name:
          theme === "dark"
            ? "Тёмная тема"
            : theme === "light"
              ? "Светлая тема"
              : "Тема как на устройстве",
        exact: true,
      })
      .click();
}

test.beforeEach(async ({ page }) => {
  await page.route(tiles, (route) => route.fulfill(imageResponse));
  await page.route("https://tile.openstreetmap.org/**", (route) =>
    route.fulfill(imageResponse),
  );
  await page.goto("/");
});

test("official Tiles API request uses spherical Mercator and no v3 SDK", async ({
  page,
}) => {
  await expect(page.locator(".map-shell")).toHaveAttribute(
    "data-map-provider",
    "yandex-tiles",
  );
  const urls = await page
    .locator(".leaflet-tile")
    .evaluateAll((images) =>
      images.map((image) => (image as HTMLImageElement).src),
    );
  expect(urls.length).toBeGreaterThan(0);
  for (const value of urls) {
    const url = new URL(value);
    expect(url.origin + url.pathname).toBe(
      "https://tiles.api-maps.yandex.ru/v1/tiles/",
    );
    expect(url.searchParams.get("apikey")).toBe("tiles-contract-test-only");
    expect(url.searchParams.get("projection")).toBe("web_mercator");
    expect(url.searchParams.get("lang")).toBe("ru_RU");
    expect(url.searchParams.get("l")).toBe("map");
    expect(url.searchParams.get("maptype")).toBe("map");
    expect(url.searchParams.has("theme")).toBe(false);
    for (const key of ["x", "y", "z"])
      expect(url.searchParams.get(key)).toMatch(/^\d+$/);
  }
  await expect(page.locator('script[src*="api-maps.yandex.ru"]')).toHaveCount(
    0,
  );
  await expect(page.locator(".leaflet-image-layer")).toHaveCount(0);
  await expect(page.locator(".leaflet-marker-icon")).toHaveCount(22);
  await expect(
    page.getByRole("link", { name: "Яндекс Карты — открыть текущий участок" }),
  ).toHaveAttribute("href", /yandex\.ru\/maps\/\?ll=/);
  await expect
    .poll(() =>
      page
        .locator(".yandex-tiles-brand img")
        .evaluate((image) => (image as HTMLImageElement).naturalWidth),
    )
    .toBeGreaterThan(0);
});

test("filtered clubs retain clickable markers and correct cards", async ({
  page,
}) => {
  await page
    .getByRole("textbox", { name: "Поиск клуба, занятия или адреса" })
    .fill("дроны");
  await expect(page.locator(".leaflet-marker-icon")).toHaveCount(1);
  await page.getByRole("button", { name: /Открыть Простор/ }).click();
  await expect(
    page.getByRole("region", { name: "Карточка: Простор" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Группа клуба ВКонтакте" }),
  ).toHaveAttribute("href", "https://vk.ru/cmiprostor");
});

test("administrative map changes the documented maptype only", async ({
  page,
}) => {
  const requests: string[] = [];
  page.on("request", (request) => {
    if (request.url().startsWith("https://tiles.api-maps.yandex.ru/"))
      requests.push(request.url());
  });
  await page
    .getByRole("combobox", { name: "Вид карты Яндекса" })
    .selectOption("admin");
  await expect
    .poll(() =>
      requests.some(
        (value) => new URL(value).searchParams.get("maptype") === "admin",
      ),
    )
    .toBe(true);
  await expect(page.locator(".leaflet-marker-icon")).toHaveCount(22);
  await expect(page.locator(".map-shell")).toHaveAttribute(
    "data-map-provider",
    "yandex-tiles",
  );
});

test("night display is local and changing theme does not request new tiles", async ({
  page,
}) => {
  await expect(page.locator(".leaflet-tile-loaded").first()).toBeVisible();
  await expect(page.getByText("Загружаем карту…", { exact: true })).toHaveCount(
    0,
  );
  let requests = 0;
  page.on("request", (request) => {
    if (request.url().startsWith("https://tiles.api-maps.yandex.ru/"))
      requests++;
  });
  await setTheme(page, "dark");
  await expect(page.locator(".map-shell")).toHaveAttribute(
    "data-map-theme",
    "dark",
  );
  await expect
    .poll(() =>
      page
        .locator(".leaflet-tile-pane")
        .evaluate((element) => getComputedStyle(element).filter),
    )
    .toContain("invert(1)");
  await setTheme(page, "light");
  await expect
    .poll(() =>
      page
        .locator(".leaflet-tile-pane")
        .evaluate((element) => getComputedStyle(element).filter),
    )
    .toBe("none");
  expect(requests).toBe(0);
  await page.emulateMedia({ colorScheme: "dark" });
  await setTheme(page, "system");
  await expect(page.locator(".map-shell")).toHaveAttribute(
    "data-map-theme",
    "dark",
  );
});

for (const status of [403, 429]) {
  test(`HTTP ${status} uses the fallback and supports a Yandex retry`, async ({
    page,
  }) => {
    await page.route(tiles, (route) =>
      route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify({
          message: status === 403 ? "Invalid key" : "Too many requests",
        }),
      }),
    );
    await page.reload();
    await expect(page.locator(".map-shell")).toHaveAttribute(
      "data-map-provider",
      "openstreetmap",
    );
    await expect(page.locator(".map-provider-fallback")).toContainText(
      "Тайлы Яндекса не загрузились",
    );
    await expect(page.getByRole("article")).toHaveCount(22);
    await page.route(tiles, (route) => route.fulfill(imageResponse));
    await page.getByRole("button", { name: "Повторить Яндекс" }).click();
    await expect(page.locator(".map-shell")).toHaveAttribute(
      "data-map-provider",
      "yandex-tiles",
    );
    await expect(page.locator(".yandex-tiles-brand")).toBeVisible();
  });
}

test("a stalled tile request times out without dropping the catalogue", async ({
  page,
}) => {
  await page.clock.install();
  const pending: Route[] = [];
  await page.route(tiles, (route) => {
    pending.push(route);
  });
  await page
    .getByRole("combobox", { name: "Вид карты Яндекса" })
    .selectOption("admin");
  await expect.poll(() => pending.length).toBeGreaterThan(0);
  await page.clock.fastForward(16000);
  await expect(page.locator(".map-shell")).toHaveAttribute(
    "data-map-provider",
    "openstreetmap",
  );
  await expect(page.getByRole("article")).toHaveCount(22);
  for (const route of pending) await route.abort().catch(() => {});
});

test("desktop keeps one-click themes and mobile keeps its existing control", async ({
  page,
  isMobile,
}) => {
  const buttons = page.locator(".desktop-theme-switch");
  const select = page.locator('select[aria-label="Тема оформления"]');
  if (isMobile) {
    await expect(buttons).toBeHidden();
    await expect(select).toBeVisible();
  } else {
    await expect(buttons).toBeVisible();
    await expect(select).toBeHidden();
  }
  await setTheme(page, "dark");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
