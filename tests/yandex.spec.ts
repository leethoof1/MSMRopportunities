import { test, expect, type Page } from "@playwright/test";

// SDK contract fixture only: it exercises our integration without a real key,
// billable requests or pretending to validate Yandex's live cartographic data.
const sdkFixture = `(() => {
  window.__yandexTest = {created:0,active:0,updates:[],locations:[]};
  class YMap {
    constructor(container, props) {
      this.container=container;this.zoom=props.location.zoom||12;
      this.element=document.createElement('div');this.element.className='sdk-map';
      this.element.style.cssText='position:absolute;inset:0;padding:160px 65px;display:flex;gap:50px;flex-wrap:wrap;align-content:start';
      this.element.dataset.theme=props.theme;container.appendChild(this.element);
      window.__yandexTest.created++;window.__yandexTest.active++;
    }
    addChild(child) {
      if(child.kind==='scheme')this.element.dataset.scheme='true';
      if(child.kind==='features')this.element.dataset.features='true';
      if(child.element)this.element.appendChild(child.element);
      return this;
    }
    removeChild(child) {child.element?.remove();return this;}
    update(props) {if(props.theme)this.element.dataset.theme=props.theme;window.__yandexTest.updates.push(props);}
    setLocation(location) {if(location.zoom!==undefined)this.zoom=location.zoom;window.__yandexTest.locations.push(location);}
    destroy() {this.element.remove();window.__yandexTest.active--;}
  }
  class YMapDefaultSchemeLayer {constructor(){this.kind='scheme'}}
  class YMapDefaultFeaturesLayer {constructor(){this.kind='features'}}
  class YMapMarker {constructor(props,element){this.props=props;this.element=element;element.dataset.coordinates=JSON.stringify(props.coordinates)}}
  window.ymaps3={ready:Promise.resolve(),YMap,YMapDefaultSchemeLayer,YMapDefaultFeaturesLayer,YMapMarker};
})();`;

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
  await page.route("https://api-maps.yandex.ru/v3/**", (route) =>
    route.fulfill({ contentType: "application/javascript", body: sdkFixture }),
  );
  await page.route("https://tile.openstreetmap.org/**", (route) =>
    route.abort(),
  );
  await page.goto("/");
});

test("Yandex scheme and feature layers receive filtered markers and open real cards", async ({
  page,
}) => {
  await expect(
    page.locator('.map-shell[data-map-provider="yandex"]'),
  ).toBeVisible();
  await expect(page.locator(".sdk-map")).toHaveAttribute("data-scheme", "true");
  await expect(page.locator(".sdk-map")).toHaveAttribute(
    "data-features",
    "true",
  );
  await expect(page.locator(".yandex-place-marker")).toHaveCount(22);
  await expect(page.locator(".leaflet-image-layer")).toHaveCount(0);
  await page
    .getByRole("textbox", { name: "Поиск клуба, занятия или адреса" })
    .fill("дроны");
  await expect(page.locator(".yandex-place-marker")).toHaveCount(1);
  await expect(page.locator(".yandex-place-marker")).toHaveAttribute(
    "data-coordinates",
    "[30.3312,59.8553]",
  );
  await page.getByRole("button", { name: /Открыть Простор/ }).click();
  await expect(
    page.getByRole("region", { name: "Карточка: Простор" }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() =>
        (
          window as unknown as {
            __yandexTest: { locations: { zoom?: number }[] };
          }
        ).__yandexTest.locations.some((location) => location.zoom === 15),
      ),
    )
    .toBe(true);
});

test("native scheme theme follows desktop buttons or unchanged mobile selection", async ({
  page,
}) => {
  await expect(page.locator(".sdk-map")).toBeVisible();
  await setTheme(page, "dark");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator(".sdk-map")).toHaveAttribute("data-theme", "dark");
  await setTheme(page, "light");
  await expect(page.locator(".sdk-map")).toHaveAttribute("data-theme", "light");
  await page.emulateMedia({ colorScheme: "dark" });
  await setTheme(page, "system");
  await expect(page.locator(".sdk-map")).toHaveAttribute("data-theme", "dark");
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { __yandexTest: { created: number } })
          .__yandexTest.created,
    ),
  ).toBe(1);
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator(".sdk-map")).toHaveAttribute("data-theme", "light");
});

test("manual map theme survives reloading and SDK loads once", async ({
  page,
}) => {
  await setTheme(page, "dark");
  await page.reload();
  await expect(page.locator(".sdk-map")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator("script[data-yandex-maps]")).toHaveCount(1);
  await page
    .getByRole("textbox", { name: "Поиск клуба, занятия или адреса" })
    .fill("петь");
  await expect(page.locator("script[data-yandex-maps]")).toHaveCount(1);
});

test("SDK failure supports retry and explicit OSM fallback without losing clubs", async ({
  page,
}) => {
  await page.route("https://api-maps.yandex.ru/v3/**", (route) =>
    route.abort(),
  );
  await page.reload();
  await expect(
    page.getByText("Яндекс Карты не загрузились", { exact: true }),
  ).toBeVisible();
  await page.route("https://api-maps.yandex.ru/v3/**", (route) =>
    route.fulfill({ contentType: "application/javascript", body: sdkFixture }),
  );
  await page.getByRole("button", { name: "Повторить загрузку" }).click();
  await expect(page.locator(".sdk-map")).toBeVisible();
  await page.route("https://api-maps.yandex.ru/v3/**", (route) =>
    route.abort(),
  );
  await page.reload();
  await expect(
    page.getByText("Яндекс Карты не загрузились", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Открыть OpenStreetMap" }).click();
  await expect(page.locator(".map-shell")).toHaveAttribute(
    "data-map-provider",
    "openstreetmap",
  );
  await expect(page.getByRole("article")).toHaveCount(22);
});

test("desktop has one-click buttons and mobile keeps its native control", async ({
  page,
  isMobile,
}, testInfo) => {
  const buttons = page.locator(".desktop-theme-switch");
  const select = page.locator('select[aria-label="Тема оформления"]');
  if (isMobile) {
    await expect(buttons).toBeHidden();
    await expect(select).toBeVisible();
  } else {
    await expect(buttons).toBeVisible();
    await expect(select).toBeHidden();
    await expect(buttons.getByRole("button")).toHaveCount(3);
  }
  await setTheme(page, "dark");
  if (!isMobile)
    await expect(
      page.getByRole("button", { name: "Тёмная тема", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page
    .locator(".site-header")
    .screenshot({
      path: "/tmp/msmr-theme-header-" + testInfo.project.name + ".png",
    });
});
