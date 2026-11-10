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

test("VR map opens directly and keeps search and tour availability in sync", async ({
  page,
}, testInfo) => {
  const dialog = page.getByRole("dialog");
  await expect(dialog.locator(".explore-place-list > button")).toHaveCount(22);
  await expect(
    dialog.locator('[data-tour-scene="district"] canvas'),
  ).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Карта и клубы", exact: true }),
  ).toHaveCount(0);
  await expect(dialog.locator(".leaflet-container")).toHaveCount(0);
  await expect(page.locator(".map-shell")).toHaveCount(1);
  if (testInfo.project.name === "desktop") {
    const bounds = (await dialog.boundingBox())!;
    expect(bounds.width).toBeGreaterThan(1300);
  }
  await dialog
    .getByRole("button", { name: "Выбрать клуб: Вертикаль", exact: true })
    .click();
  await expect(
    dialog.getByRole("region", { name: "Выбрано: Вертикаль" }),
  ).toBeVisible();
  await expect(
    dialog
      .getByRole("region", { name: "Выбрано: Вертикаль" })
      .getByText("Съёмка интерьера пока не добавлена", { exact: true }),
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

test("a panorama returns to the same VR map and fullscreen still works", async ({
  page,
}) => {
  test.setTimeout(90000);
  const dialog = page.getByRole("dialog");
  const scene = dialog.locator(".vr-scene");
  await expect(scene).toHaveAttribute("data-tour-scene", "district");
  const canvas = scene.locator("canvas");
  await canvas.evaluate((element) =>
    element.setAttribute("data-preserved-renderer", "yes"),
  );
  await dialog
    .getByRole("button", { name: "Выбрать клуб: Нева", exact: true })
    .click();
  await dialog
    .getByRole("button", { name: "Заглянуть внутрь", exact: true })
    .click();
  await expect(scene).toHaveAttribute("data-panorama-state", "ready");
  await expect(scene).toHaveAttribute("data-tour-scene", "entrance");
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
  await expect(scene).toHaveAttribute("data-tour-scene", "district");
  await expect(canvas).toHaveAttribute("data-preserved-renderer", "yes");
  await expect(
    dialog.getByRole("region", { name: "Выбрано: Нева" }),
  ).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Открыть обычную карту", exact: true }),
  ).toHaveCount(0);
});

test("curved VR map markers respond to clicks and preserve their renderer across a tour", async ({
  page,
}) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const dialog = page.getByRole("dialog");
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
    [0.5, 0.58],
    [0.48, 0.55],
    [0.52, 0.55],
    [0.5, 0.65],
    [0.45, 0.6],
    [0.55, 0.6],
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
  expect(errors).toEqual([]);
});
