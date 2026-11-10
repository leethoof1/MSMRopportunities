import { test, expect } from "@playwright/test";
const tile = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
  "base64",
);
test.beforeEach(async ({ page }) => {
  await page.route("https://tile.openstreetmap.org/**", (route) =>
    route.fulfill({ contentType: "image/png", body: tile }),
  );
  await page.goto("/");
  await page
    .getByRole("button", { name: "Клубы изнутри", exact: true })
    .click();
});

test("map, list, search, and tour availability agree without paginated cards", async ({
  page,
}, testInfo) => {
  const dialog = page.getByRole("dialog");
  await expect(dialog.locator(".explore-place-list > button")).toHaveCount(22);
  await expect(dialog.locator(".place-pin")).toHaveCount(22);
  await expect(dialog.locator("canvas")).toHaveCount(0);
  if (testInfo.project.name === "desktop") {
    const bounds = (await dialog.boundingBox())!;
    expect(bounds.width).toBeGreaterThan(1300);
  }
  await dialog.locator('.leaflet-marker-icon[title="Вертикаль"]').click();
  await expect(
    dialog.getByRole("region", { name: "Выбрано: Вертикаль" }),
  ).toBeVisible();
  await expect(
    dialog.getByText("Съёмка интерьера пока не добавлена", { exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Заглянуть внутрь", exact: true }),
  ).toHaveCount(0);
  await dialog
    .getByRole("textbox", { name: "Найти пространство в каталоге" })
    .fill("Смоленская");
  await expect(dialog.locator(".explore-place-list > button")).toHaveCount(1);
  await dialog
    .getByRole("button", { name: "Выбрать клуб: Нева", exact: true })
    .click();
  await expect(
    dialog.getByRole("button", { name: "Заглянуть внутрь", exact: true }),
  ).toBeVisible();
  await dialog
    .getByRole("textbox", { name: "Найти пространство в каталоге" })
    .fill("");
  await dialog
    .getByRole("button", { name: "Только с туром 360°", exact: true })
    .click();
  await expect(dialog.locator(".explore-place-list > button")).toHaveCount(1);
  await dialog
    .getByRole("button", { name: "Только с туром 360°", exact: true })
    .click();
  await expect(dialog.locator(".explore-place-list > button")).toHaveCount(22);
  await expect(dialog.locator(".vr-pagination")).toHaveCount(0);
});

test("returning from a panorama keeps the map instance, selection and zoom", async ({
  page,
}) => {
  test.setTimeout(90000);
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("button", { name: "Выбрать клуб: Нева", exact: true })
    .click();
  const map = dialog.locator(".explore-map .map-canvas");
  await map.evaluate((element) =>
    element.setAttribute("data-preserved-map", "yes"),
  );
  const shell = dialog.locator(".explore-map .map-shell");
  await expect(shell).toHaveAttribute("data-map-view", /z=15$/);
  await dialog
    .locator(".explore-map")
    .getByRole("button", { name: "Приблизить карту" })
    .click();
  await expect(shell).toHaveAttribute("data-map-view", /z=16$/);
  const view = await shell.getAttribute("data-map-view");
  await dialog
    .getByRole("button", { name: "Заглянуть внутрь", exact: true })
    .click();
  await expect(dialog.locator('[data-panorama-state="ready"]')).toBeVisible();
  await expect(dialog.locator(".explore-map")).toBeHidden();
  if (test.info().project.name === "desktop") {
    await dialog
      .getByRole("button", { name: "На весь экран", exact: true })
      .click();
    await expect
      .poll(() => page.evaluate(() => Boolean(document.fullscreenElement)))
      .toBe(true);
    await dialog.getByRole("button", { name: "Свернуть", exact: true }).click();
    await expect
      .poll(() => page.evaluate(() => Boolean(document.fullscreenElement)))
      .toBe(false);
  }
  await dialog
    .getByRole("button", { name: "Выбрать другой клуб", exact: true })
    .click();
  await expect(map).toHaveAttribute("data-preserved-map", "yes");
  await expect(
    dialog.getByRole("region", { name: "Выбрано: Нева" }),
  ).toBeVisible();
  await expect(shell).toHaveAttribute("data-map-view", view!);
});

test("VR miniature shows every club and enters a tour without replacing its canvas", async ({
  page,
}) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("button", { name: "Макет района · VR", exact: true })
    .click();
  const scene = dialog.locator('[data-tour-scene="district"]');
  await expect(scene).toHaveAttribute("data-district-pins", "22");
  const canvas = scene.locator("canvas");
  await expect(canvas).toBeVisible();
  await canvas.evaluate((element) =>
    element.setAttribute("data-same-renderer", "yes"),
  );
  await canvas.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  const bounds = (await canvas.boundingBox())!;
  for (const [x, y] of [
    [0.5, 0.5],
    [0.5, 0.46],
    [0.48, 0.52],
    [0.52, 0.52],
  ]) {
    await page.mouse.click(
      bounds.x + bounds.width * x,
      bounds.y + bounds.height * y,
    );
    if (await dialog.locator(".district-summary strong").count()) break;
  }
  await expect(dialog.locator(".district-summary strong")).toBeVisible();
  await dialog
    .getByRole("button", { name: "Выбрать клуб: Нева", exact: true })
    .click();
  await expect(dialog.locator(".district-summary")).toContainText("Нева");
  await dialog
    .getByRole("button", { name: "Заглянуть внутрь в VR", exact: true })
    .click();
  await expect(
    dialog.locator('[data-tour-scene="entrance"][data-panorama-state="ready"]'),
  ).toBeVisible();
  await expect(dialog.locator(".vr-scene canvas")).toHaveAttribute(
    "data-same-renderer",
    "yes",
  );
  await dialog
    .getByRole("button", { name: "Выбрать другой клуб", exact: true })
    .click();
  await expect(scene).toBeVisible();
  await expect(canvas).toHaveAttribute("data-same-renderer", "yes");
  await dialog
    .getByRole("button", { name: "Открыть обычную карту", exact: true })
    .click();
  await expect(dialog.getByLabel("Карта каталога пространств")).toBeVisible();
  expect(errors).toEqual([]);
});
