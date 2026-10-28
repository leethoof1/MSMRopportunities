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
    page.getByRole("heading", { name: "22 пространства" }),
  ).toBeVisible();
  await expect(page.getByRole("article")).toHaveCount(22);
  await expect(page.locator(".map-coordinate-note")).toBeVisible();
  await expect(page.locator(".map-coordinate-note")).toHaveText(
    "Метки по сверенным адресам",
  );
  await expect(page.locator(".place-pin")).toHaveCount(22);
  await expect(page.locator(".place-pin.is-approximate")).toHaveCount(0);
  await expect(page.locator(".leaflet-image-layer")).toHaveCount(0);
  await expect(page.locator(".map-shell")).toHaveAttribute(
    "data-map-provider",
    "openstreetmap",
  );
  await expect(
    page.getByText(
      "Точное расписание уточняй у клубов — контакты прикреплены в карточках.",
      { exact: true },
    ),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("reviewed club locations retain the correct source in their details", async ({
  page,
}) => {
  for (const [id, name, source] of [
    ["kosmos", "Космос", "OpenStreetMap / Nominatim"],
    ["romantiki", "Романтики", "OpenStreetMap / Nominatim"],
    ["oktyabr", "Октябрь", "Яндекс Карты"],
  ]) {
    await page.goto(`/?place=${id}`);
    const dialog = page.getByRole("region", { name: `Карточка: ${name}` });
    await expect(
      dialog.getByRole("heading", { name, exact: true }),
    ).toBeVisible();
    await expect(
      dialog.getByText(`Санкт-Петербург · точка по адресу · ${source}`, {
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      dialog.getByText("Санкт-Петербург · положение метки уточняется", {
        exact: true,
      }),
    ).toHaveCount(0);
  }
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
  await search.fill("робототехника");
  await expect(page.getByRole("article")).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: "Подробнее: Простор", exact: true }),
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
  await expect(page.getByRole("article")).toHaveCount(22);
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
    card.getByRole("link", { name: "+7 (911) 951-80-31" }),
  ).toHaveAttribute("href", "tel:+79119518031");
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
  const marker = page.locator('.leaflet-marker-icon[title="Вертикаль"]');
  await marker.click();
  await expect(
    page.getByRole("region", { name: "Карточка: Вертикаль" }),
  ).toBeVisible();
});

test("list view opens an updated club with direct VK and both contact phones", async ({
  page,
}) => {
  await page
    .getByRole("button", { name: "Показать список", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Поиск клуба, занятия или адреса" })
    .fill("Надежда");
  await page
    .getByRole("button", { name: "Подробнее: Надежда", exact: true })
    .click();
  const card = page
    .getByRole("region", { name: "Карточка: Надежда" })
    .filter({ visible: true });
  await expect(
    card.getByRole("link", { name: "+7 (921) 869-14-58" }),
  ).toHaveAttribute("href", "tel:+79218691458");
  await expect(
    card.getByRole("link", { name: "+7 (812) 417-50-73" }),
  ).toBeVisible();
  await expect(
    card.getByRole("link", { name: "Группа клуба ВКонтакте" }),
  ).toHaveAttribute("href", "https://vk.ru/club136795033");
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
  await expect(page.getByRole("article")).toHaveCount(22);
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
