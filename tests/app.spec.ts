import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("https://tile.openstreetmap.org/**", (route) =>
    route.abort(),
  );
  await page.goto("/");
});

test("loads the complete catalogue and shows source limitations", async ({
  page,
}) => {
  await expect(
    page.getByRole("heading", { name: "23 пространства" }),
  ).toBeVisible();
  await expect(page.getByRole("article")).toHaveCount(23);
  await expect(page.locator(".map-coordinate-note")).toBeVisible();
  await expect(page.locator(".leaflet-image-layer")).toHaveCount(0);
  await expect(page.locator(".map-shell")).toHaveAttribute(
    "data-map-provider",
    "openstreetmap",
  );
  await expect(
    page.getByText("Данные на 29.07.2025.", { exact: false }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("searches activities, normalizes ё and combines category filters", async ({
  page,
}) => {
  const search = page.getByRole("textbox", {
    name: "Поиск клуба, занятия или адреса",
  });
  await search.fill("звездной");
  await expect(page.getByRole("article")).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: "Подробнее: На Звёздной", exact: true }),
  ).toBeVisible();
  await search.fill("японский");
  await expect(page.getByRole("article")).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: "Подробнее: Молодёжный", exact: true }),
  ).toBeVisible();
  await search.fill("");
  await page.getByRole("button", { name: "Спорт", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Подробнее: Атлант", exact: true }),
  ).toBeAttached();
  await expect(
    page.getByRole("button", { name: "Подробнее: Космос", exact: true }),
  ).toHaveCount(0);
});

test("empty results can be reset, 360 filter does not invent tours", async ({
  page,
}) => {
  await page
    .getByRole("textbox", { name: "Поиск клуба, занятия или адреса" })
    .fill("абракадабра");
  await expect(page.getByText("Пока ничего не нашлось")).toBeVisible();
  await page.getByRole("button", { name: "Показать все пространства" }).click();
  await expect(page.getByRole("article")).toHaveCount(23);
  await page.getByRole("button", { name: "360°", exact: true }).click();
  await expect(page.getByText("Панорамы ещё впереди")).toBeVisible();
  await expect(page.getByRole("article")).toHaveCount(0);
});

test("favorites persist across reloads and can be removed", async ({
  page,
}) => {
  await page
    .getByRole("button", { name: "В избранное: На Звёздной", exact: true })
    .click();
  await page.reload();
  await page
    .getByRole("button", { name: /Избранное/ })
    .first()
    .click();
  await expect(page.getByRole("article")).toHaveCount(1);
  await expect(
    page.getByRole("heading", { name: "На Звёздной", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "Убрать из избранного: На Звёздной",
      exact: true,
    })
    .click();
  await expect(page.getByText("Сохрани своё место")).toBeVisible();
});

test("place details expose real activities, phone, address route and shareable URL", async ({
  page,
}) => {
  await page
    .getByRole("textbox", { name: "Поиск клуба, занятия или адреса" })
    .fill("Спутник");
  await page
    .getByRole("button", { name: "Подробнее: Спутник", exact: true })
    .click();
  const card = page.getByRole("region", { name: "Карточка: Спутник" });
  await expect(card).toBeVisible();
  await expect(
    card.getByText("Актёрское мастерство", { exact: true }),
  ).toBeVisible();
  await expect(
    card.getByRole("link", { name: "+7 (812) 246-30-08" }),
  ).toHaveAttribute("href", "tel:+78122463008");
  await expect(
    card.getByRole("link", { name: "Найти на карте" }),
  ).toHaveAttribute("href", /yandex\.ru\/maps\/\?text=.*51/);
  await expect(page).toHaveURL(/place=sputnik/);
  await page.reload();
  await expect(card).toBeVisible();
  await card.getByRole("button", { name: "Закрыть карточку" }).click();
  await expect(page).not.toHaveURL(/place=/);
});

test("a map marker opens its corresponding place after fitting the results", async ({
  page,
}) => {
  // Stub image transport for this interaction test. The separate failure test
  // checks real tile URLs, retry and attribution; live imagery needs network access.
  await page.route("https://tile.openstreetmap.org/**", (route) =>
    route.fulfill({
      contentType: "image/png",
      body: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
        "base64",
      ),
    }),
  );
  await page.reload();
  await expect(
    page.getByText("Карта не загрузилась", { exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Показать все найденные места" })
    .click();
  const marker = page.locator('.leaflet-marker-icon[title="Спутник"]');
  await marker.click();
  await expect(
    page.getByRole("region", { name: "Карточка: Спутник" }),
  ).toBeVisible();
});

test("list view and map-only source entry remain usable", async ({ page }) => {
  await page
    .getByRole("button", { name: "Показать список", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Поиск клуба, занятия или адреса" })
    .fill("Искорка");
  await page
    .getByRole("button", { name: "Подробнее: Искорка", exact: true })
    .click();
  const card = page
    .getByRole("region", { name: "Карточка: Искорка" })
    .filter({ visible: true });
  await expect(
    card.getByText("Список студий пока уточняется.", { exact: false }),
  ).toBeVisible();
  await expect(
    card.getByRole("link", { name: "+7 (812) 417-30-10" }),
  ).toBeVisible();
  await expect(
    card.getByText("Информация уточняется", { exact: true }),
  ).toBeVisible();
});

test("real OSM is requested immediately and failure preserves the catalogue", async ({
  page,
}) => {
  let requests = 0;
  await page.route("https://tile.openstreetmap.org/**", (route) => {
    requests++;
    return route.abort();
  });
  await page.reload();
  await expect(
    page.getByText("Карта не загрузилась", { exact: true }),
  ).toBeVisible();
  expect(requests).toBeGreaterThan(0);
  await expect(page.locator(".leaflet-image-layer")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Открыть схему" })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole("link", { name: "OpenStreetMap contributors" }),
  ).toBeVisible();
  await expect(page.getByRole("article")).toHaveCount(23);
  await expect(
    page.getByRole("link", { name: "Открыть в Яндексе" }),
  ).toHaveAttribute("href", /yandex\.ru/);
  const beforeRetry = requests;
  await page.getByRole("button", { name: "Повторить загрузку" }).click();
  await expect.poll(() => requests).toBeGreaterThan(beforeRetry);
  await page
    .getByRole("button", { name: "Подробнее: На Звёздной", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Карточка: На Звёздной" }),
  ).toBeVisible();
});

test("VR catalogue renders and supports accessible card selection", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.getByRole("button", { name: "Заглянуть в VR" }).click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByText("Виртуальный каталог", { exact: true }),
  ).toBeVisible();
  await expect(dialog.locator("canvas")).toBeVisible();
  const canvas = dialog.locator("canvas");
  const size = await canvas.boundingBox();
  await canvas.click({
    position: { x: size!.width / 2, y: size!.height * 0.35 },
  });
  await expect(dialog.locator(".vr-selected")).toContainText("Пулковец");
  await dialog
    .getByRole("button", { name: "На Звёздной", exact: true })
    .click();
  await expect(dialog.locator(".vr-selected")).toContainText(
    "Академический рисунок",
  );
  await dialog.getByRole("button", { name: "Следующие места в VR" }).click();
  await expect(dialog.locator(".vr-pagination")).toContainText("2 / 4");
  await page.screenshot({ path: "/tmp/msmr-vr.png" });
  await dialog.getByRole("button", { name: "Закрыть окно" }).click();
  await expect(dialog).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("captures the layout and detail at this device size", async ({
  page,
}, testInfo) => {
  await page.screenshot({
    path: `/tmp/msmr-${testInfo.project.name}.png`,
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Подробнее: На Звёздной", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Карточка: На Звёздной" }),
  ).toBeVisible();
  await page.screenshot({
    path: `/tmp/msmr-${testInfo.project.name}-detail.png`,
    fullPage: true,
  });
});
