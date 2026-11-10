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
  await expect(page.locator(".map-coordinate-note")).toHaveCount(0);
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

test("club details show addresses and contacts without source footnotes", async ({
  page,
}) => {
  for (const [id, name, address] of [
    ["kosmos", "Космос", "Московский проспект, 174А"],
    ["romantiki", "Романтики", "Ленинский проспект, 158, корп. 2"],
    ["oktyabr", "Октябрь", "Пулковская улица, 11, корп. 1"],
  ]) {
    await page.goto(`/?place=${id}`);
    const card = page.getByRole("region", { name: `Карточка: ${name}` });
    await expect(
      card.getByRole("heading", { name, exact: true }),
    ).toBeVisible();
    await expect(card.getByText(address, { exact: true })).toBeVisible();
    await expect(
      card.locator('.detail-facts a[href^="tel:"]').first(),
    ).toBeVisible();
    await expect(
      card.locator(".detail-facts small, .source-detail"),
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

test("empty results can be reset, 360 filter shows only photographed clubs", async ({
  page,
}) => {
  await page
    .getByRole("textbox", { name: "Поиск клуба, занятия или адреса" })
    .fill("абракадабра");
  await expect(page.getByText("Пока ничего не нашлось")).toBeVisible();
  await page.getByRole("button", { name: "Показать все пространства" }).click();
  await expect(page.getByRole("article")).toHaveCount(22);
  await page.getByRole("button", { name: "360°", exact: true }).click();
  await expect(page.getByRole("article")).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: "Подробнее: Нева", exact: true }),
  ).toBeVisible();
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

test("catalogue opens directly as a VR map with all spaces", async ({
  page,
}) => {
  await page
    .getByRole("button", { name: "Клубы изнутри", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("heading", { name: "Клубы изнутри", exact: true }),
  ).toBeVisible();
  await expect(dialog.getByLabel("VR-карта района")).toBeVisible();
  await expect(dialog.locator(".explore-place-list > button")).toHaveCount(22);
  await expect(dialog.locator("canvas")).toBeVisible();
  await expect(dialog.locator(".leaflet-container")).toHaveCount(0);
  await dialog
    .getByRole("button", { name: "Выбрать клуб: Нева", exact: true })
    .click();
  await expect(
    dialog.getByRole("region", { name: "Выбрано: Нева" }),
  ).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Заглянуть внутрь", exact: true }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Закрыть окно" }).click();
  await expect(dialog).toHaveCount(0);
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

test("Neva panorama loads, responds to dragging, and returns to the catalogue", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/?place=neva");
  await page.getByRole("button", { name: "Смотреть 360°" }).click();
  const dialog = page.getByRole("dialog");
  const scene = dialog.getByLabel("Панорама 360°: Нева", { exact: true });
  await expect(scene).toHaveAttribute("data-panorama-state", "ready");
  const canvas = scene.locator("canvas");
  const before = await canvas.screenshot();
  const bounds = (await canvas.boundingBox())!;
  // Start beside the doorway marker, which is a separate clickable button.
  const x = bounds.x + bounds.width * 0.22,
    y = bounds.y + bounds.height / 2;
  if (test.info().project.name === "mobile") {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x, y }],
    });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: x + 90, y: y + 25 }],
    });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await cdp.detach();
  } else {
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 90, y + 25, { steps: 6 });
    await page.mouse.up();
  }
  await expect
    .poll(async () => (await canvas.screenshot()).equals(before))
    .toBe(false);
  await canvas.focus();
  const afterDrag = await canvas.screenshot();
  await page.keyboard.press("ArrowRight");
  await expect
    .poll(async () => (await canvas.screenshot()).equals(afterDrag))
    .toBe(false);
  await expect(dialog.locator(".vr-pagination")).toHaveCount(0);
  await dialog
    .getByRole("button", { name: "Выбрать другой клуб", exact: true })
    .click();
  await expect(dialog.getByLabel("VR-карта района")).toBeVisible();
  await expect(
    dialog.getByRole("region", { name: "Выбрано: Нева" }),
  ).toBeVisible();
  await dialog
    .getByRole("button", { name: "Заглянуть внутрь", exact: true })
    .click();
  await expect(scene).toHaveAttribute("data-panorama-state", "ready");
  expect(errors).toEqual([]);
});

test("failed Neva photo can be reopened after a network error", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await page.route("**/panoramas/neva-corridor-*.webp", (route) =>
    route.abort(),
  );
  await page.goto("/?place=neva");
  await page.getByRole("button", { name: "Смотреть 360°" }).click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByText(
      "Не удалось загрузить панораму. Проверь подключение и попробуй ещё раз.",
    ),
  ).toBeVisible();
  await expect(dialog.getByText("Загружаем панораму…")).toHaveCount(0);
  await page.unroute("**/panoramas/neva-corridor-*.webp");
  await dialog.getByRole("button", { name: "Закрыть окно" }).click();
  await page.getByRole("button", { name: "Смотреть 360°" }).click();
  await expect(
    dialog.getByLabel("Панорама 360°: Нева", { exact: true }),
  ).toHaveAttribute("data-panorama-state", "ready");
});

test("Neva tour starts at the entrance and doorway arrows work both ways", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/?place=neva");
  const card = page.getByRole("region", { name: "Карточка: Нева" });
  // The tour is immediately after VK, above the address and activity list.
  await expect(card.locator(".club-vk-link + .tour-preview")).toBeVisible();
  await card.getByRole("button", { name: "Смотреть 360°" }).click();
  const dialog = page.getByRole("dialog");
  const scene = dialog.locator(".vr-scene");
  await expect(scene).toHaveAttribute("data-tour-scene", "entrance");
  await expect(scene).toHaveAttribute("data-panorama-state", "ready", {
    timeout: 20000,
  });
  const forward = dialog.getByRole("button", {
    name: "В пространство возможностей",
    exact: true,
  });
  await expect(forward).toBeVisible();
  if (test.info().project.name === "mobile") await forward.tap();
  else await forward.click();
  await expect(scene).toHaveAttribute("data-tour-scene", "room");
  await expect(scene).toHaveAttribute("data-panorama-state", "ready", {
    timeout: 20000,
  });
  // The return arrow sits on the exit door behind the viewer, so turn around.
  const canvas = scene.locator("canvas");
  await canvas.focus();
  for (let i = 0; i < 26; i++) await page.keyboard.press("ArrowLeft");
  const back = dialog.getByRole("button", {
    name: "Обратно в коридор",
    exact: true,
  });
  await expect(back).toBeVisible();
  if (test.info().project.name === "mobile") await back.tap();
  else await back.click();
  await expect(scene).toHaveAttribute("data-tour-scene", "entrance");
  await expect(scene).toHaveAttribute("data-panorama-state", "ready", {
    timeout: 20000,
  });
  await expect(forward).toBeVisible();
  await expect(scene).toHaveAttribute("data-panorama-detail", "full");
  expect(errors).toEqual([]);
});

test("Neva previews remain interactive during slow downloads, then upgrade and reuse cached rooms", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  const requests: string[] = [];
  // Ignore development StrictMode's aborted mount; count completed transfers.
  page.on("requestfinished", (request) => {
    if (request.url().includes("/panoramas/")) requests.push(request.url());
  });
  let release!: () => void;
  const slowDownload = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(/panoramas\/neva-.*-(4096|8192)\.webp/, async (route) => {
    await slowDownload;
    await route.continue().catch(() => {});
  });
  try {
    await page.goto("/?place=neva");
    await page.getByRole("button", { name: "Смотреть 360°" }).click();
    const dialog = page.getByRole("dialog");
    const scene = dialog.locator(".vr-scene");
    // Large images are held indefinitely; the little preview must allow a visit now.
    await expect(scene).toHaveAttribute("data-panorama-state", "ready");
    await expect(scene).toHaveAttribute("data-panorama-detail", "preview");
    await dialog
      .getByRole("button", { name: "В пространство возможностей", exact: true })
      .click();
    await expect(scene).toHaveAttribute("data-tour-scene", "room");
    await expect(scene).toHaveAttribute("data-panorama-state", "ready");
    await expect(scene).toHaveAttribute("data-panorama-detail", "preview");
    const canvas = scene.locator("canvas");
    await canvas.focus();
    // Turn to the room's exit and ensure sharpening does not reset the view.
    for (let i = 0; i < 24; i++) await page.keyboard.press("ArrowLeft");
    await canvas.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );
    const back = dialog.getByRole("button", {
      name: "Обратно в коридор",
      exact: true,
    });
    await expect(back).toBeVisible();
    const before = (await back.boundingBox())!;
    release();
    await expect(scene).toHaveAttribute("data-panorama-detail", "full", {
      timeout: 20000,
    });
    await expect(scene).toHaveAttribute("data-tour-scene", "room");
    const after = (await back.boundingBox())!;
    expect(Math.abs(after.x - before.x)).toBeLessThan(2);
    expect(Math.abs(after.y - before.y)).toBeLessThan(2);
    await back.click();
    await expect(scene).toHaveAttribute("data-tour-scene", "entrance");
    await expect(scene).toHaveAttribute("data-panorama-detail", "full", {
      timeout: 20000,
    });
    // Revisit again: each image is transferred only once per open tour.
    await dialog
      .getByRole("button", { name: "Пространство возможностей", exact: true })
      .click();
    await expect(scene).toHaveAttribute("data-panorama-detail", "full");
    expect(requests.some((url) => url.endsWith(".jpg"))).toBe(false);
    const fullSize = testInfo.project.name === "mobile" ? "4096" : "8192";
    for (const room of ["corridor", "room"]) {
      expect(
        requests.filter((url) => url.endsWith(`neva-${room}-1024.webp`)),
      ).toHaveLength(1);
      expect(
        requests.filter((url) => url.endsWith(`neva-${room}-${fullSize}.webp`)),
      ).toHaveLength(1);
    }
  } finally {
    release();
  }
});
