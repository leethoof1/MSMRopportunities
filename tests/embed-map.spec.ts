import { test, expect } from "@playwright/test";

const tile = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=", "base64");
test.beforeEach(async ({ page }) => {
  await page.route("https://tile.openstreetmap.org/**", route => route.fulfill({ contentType: "image/png", body: tile }));
  await page.route("https://tiles.api-maps.yandex.ru/**", route => route.fulfill({ contentType: "image/png", body: tile }));
});

test("standalone map shows 22 clubs, contacts and touch-sized controls", async ({ page }) => {
  await page.goto("/?embed=map");
  await expect(page.getByRole("main", { name: "Карта клубов Московского района" })).toBeVisible();
  await expect(page.locator(".place-pin")).toHaveCount(22);
  await expect(page.locator(".site-header, .site-footer, .hero, canvas")).toHaveCount(0);
  await expect(page).toHaveTitle("Клубы района — карта");
  const main = await page.getByRole("main").boundingBox();
  const viewport = page.viewportSize()!;
  expect(main!.width).toBe(viewport.width);
  expect(main!.height).toBe(viewport.height);
  await page.locator('.leaflet-marker-icon[title="Нева"]').click();
  const card = page.getByRole("region", { name: "Карточка клуба: Нева" });
  await expect(card.getByRole("heading", { name: "Нева", exact: true })).toBeVisible();
  await expect(card.getByText("Смоленская улица, 1", { exact: true })).toBeVisible();
  await expect(card.getByRole("link", { name: "Группа клуба ВКонтакте" })).toHaveAttribute("href", /pmknevaa/);
  await card.getByRole("button", { name: "Закрыть карточку клуба" }).click();
  await expect(card).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Показать все найденные места" })).toBeVisible();
});

test("map works in another application's iframe and the main site still opens normally", async ({ page }) => {
  // A different host represents an external kiosk page.
  await page.route("http://localhost:5173/kiosk-parent/**", route => route.fulfill({
    contentType: "text/html",
    body: '<!doctype html><html><body style="margin:0"><iframe title="Карта клубов" src="http://127.0.0.1:5173/?embed=map" style="display:block;width:100vw;height:100vh;border:0"></iframe></body></html>'
  }));
  await page.goto("http://localhost:5173/kiosk-parent/");
  const widget = page.frameLocator('iframe[title="Карта клубов"]');
  await expect(widget.locator(".place-pin")).toHaveCount(22);
  await expect(widget.locator(".site-header")).toHaveCount(0);
  await widget.locator('.leaflet-marker-icon[title="Нева"]').click();
  await expect(widget.getByRole("region", { name: "Карточка клуба: Нева" })).toBeVisible();
  await page.goto("/");
  await expect(page.locator(".site-header")).toBeVisible();
  await expect(page.getByRole("button", { name: "Клубы изнутри", exact: true })).toBeVisible();
});
