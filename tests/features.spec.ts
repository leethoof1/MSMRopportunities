import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("https://tile.openstreetmap.org/**", (route) =>
    route.abort(),
  );
  await page.goto("/");
});

const mainSearch = (page: import("@playwright/test").Page) =>
  page.getByRole("textbox", { name: "Поиск клуба, занятия или адреса" });

async function setTheme(
  page: import("@playwright/test").Page,
  value: "light" | "dark" | "system",
) {
  const select = page.locator('select[aria-label="Тема оформления"]');
  if (await select.isVisible()) await select.selectOption(value);
  else
    await page
      .getByRole("button", {
        name:
          value === "dark"
            ? "Тёмная тема"
            : value === "light"
              ? "Светлая тема"
              : "Тема как на устройстве",
        exact: true,
      })
      .click();
}

test("natural singing request finds actual vocal studios and can narrow by location", async ({
  page,
}) => {
  await mainSearch(page).fill("хочу петь");
  await expect(page.getByLabel("Занятия по интересам")).toContainText("Вокал");
  await expect(
    page.getByRole("button", { name: "Подробнее: Космос", exact: true }),
  ).toBeAttached();
  await expect(
    page.getByRole("button", { name: "Подробнее: Атлант", exact: true }),
  ).toHaveCount(0);
  // Singing must not match choreography merely because both contain "хор".
  await expect(
    page.getByRole("button", { name: "Подробнее: Юность", exact: true }),
  ).toHaveCount(0);
  await expect(page.locator(".matched-activity").first()).toContainText(
    "Вокал",
  );
  await mainSearch(page).fill("хочу петь на звездной");
  await expect(page.getByRole("article")).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: "Подробнее: На Звёздной", exact: true }),
  ).toBeVisible();
});

test("wrestling offers real disciplines and choosing judo finds Atlant", async ({
  page,
}) => {
  await mainSearch(page).fill("хочу заниматься борьбой");
  const suggestions = page.getByLabel("Занятия по интересам");
  await expect(suggestions).toContainText("Дзюдо");
  await expect(suggestions).toContainText("Айкидо");
  await expect(suggestions).toContainText("ММА");
  await suggestions.getByRole("button", { name: /Дзюдо/ }).click();
  await expect(mainSearch(page)).toHaveValue("Дзюдо");
  await expect(page.getByRole("article")).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: "Подробнее: Атлант", exact: true }),
  ).toBeVisible();
});

test("sambo is not invented and guitar inflections work", async ({ page }) => {
  await mainSearch(page).fill("самбо");
  await expect(page.getByRole("article")).toHaveCount(0);
  await expect(page.getByLabel("Занятия по интересам")).toContainText(
    "подтверждённых занятий не нашлось",
  );
  await mainSearch(page).fill("хочу играть на гитаре");
  await expect(
    page.getByRole("button", { name: "Подробнее: Космос", exact: true }),
  ).toBeAttached();
  await expect(
    page.getByRole("button", { name: "Подробнее: Атлант", exact: true }),
  ).toHaveCount(0);
});

test("a club has an independent semantic activity search", async ({ page }) => {
  await page
    .getByRole("button", { name: "Подробнее: На Звёздной", exact: true })
    .click();
  const card = page.getByRole("region", { name: "Карточка: На Звёздной" });
  const search = card.getByRole("textbox", {
    name: "Поиск занятий в этом клубе",
  });
  await search.fill("хочу петь");
  await expect(card.locator(".activity-tags")).toHaveText(
    "Вокальное мастерство",
  );
  await search.fill("дзюдо");
  await expect(card.locator(".activity-tags")).toContainText(
    "такого занятия пока нет",
  );
  await card.getByRole("button", { name: "Очистить поиск занятий" }).click();
  await expect(card.locator(".activity-tags > span")).toHaveCount(20);
});

test("Sputnik uses its confirmed VK group and no council office claim", async ({
  page,
}) => {
  await mainSearch(page).fill("Спутник");
  await page
    .getByRole("button", { name: "Подробнее: Спутник", exact: true })
    .click();
  const card = page.getByRole("region", { name: "Карточка: Спутник" });
  await expect(
    card.getByRole("link", { name: "Группа клуба ВКонтакте" }),
  ).toHaveAttribute("href", "https://vk.ru/club156414892");
  await expect(card).not.toContainText("офис молодёжного совета");
  await expect(page.getByText("МОЛОДЁЖНЫЙ СОВЕТ ЗДЕСЬ")).toHaveCount(0);
});

test("Prostor has updated technical programmes, old-name lookup and correct VK", async ({
  page,
}) => {
  await mainSearch(page).fill("Молодёжный");
  await page
    .getByRole("button", { name: "Подробнее: Простор", exact: true })
    .click();
  const card = page.getByRole("region", { name: "Карточка: Простор" });
  await expect(card).toContainText("Центр молодёжных инициатив");
  await expect(card.locator(".activity-confirmation")).toHaveCount(0);
  await expect(card.locator(".activity-tags")).toContainText("робототехника");
  await expect(card.locator(".activity-tags")).toContainText("Киберспорт");
  await expect(
    card.getByRole("link", { name: "Группа клуба ВКонтакте" }),
  ).toHaveAttribute("href", "https://vk.ru/cmiprostor");
  await expect(page).toHaveURL(/place=molodezhny/);
});

test("automatic theme follows system changes without a horizontal overflow", async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(
    await page
      .locator("html")
      .evaluate((element) => getComputedStyle(element).backgroundColor),
  ).toBe("rgb(20, 23, 28)");
  await expect(
    page.locator('select[aria-label="Тема оформления"]'),
  ).toHaveValue("system");
  await page
    .getByRole("button", { name: "Показать список", exact: true })
    .click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `/tmp/msmr-dark-${testInfo.project.name}.png`,
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Подробнее: На Звёздной", exact: true })
    .click();
  await page.screenshot({
    path: `/tmp/msmr-dark-${testInfo.project.name}-detail.png`,
    fullPage: true,
  });
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});

test("manual theme persists and auto mode restores system preference", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "light" });
  await setTheme(page, "dark");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(
    page.locator('select[aria-label="Тема оформления"]'),
  ).toHaveValue("dark");
  await setTheme(page, "system");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(
    page.locator('select[aria-label="Тема оформления"]'),
  ).toHaveValue("system");
});

test("updated programmes keep paid children's judo separate from free results", async ({
  page,
}) => {
  await mainSearch(page).fill("дзюдо");
  await expect(page.getByRole("article")).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: "Подробнее: Атлант", exact: true }),
  ).toBeVisible();
  await mainSearch(page).fill("Взлёт");
  await page
    .getByRole("button", { name: "Подробнее: Взлёт", exact: true })
    .click();
  const card = page.getByRole("region", { name: "Карточка: Взлёт" });
  await expect(card.locator(".activity-tags")).not.toContainText("Дзюдо");
  await card
    .getByRole("textbox", { name: "Поиск занятий в этом клубе" })
    .fill("дзюдо");
  await expect(card.getByLabel("Платные занятия")).toContainText(
    "Дзюдо · 4–13 лет",
  );
  await expect(card.locator(".activity-tags")).toContainText(
    "Среди бесплатных занятий совпадений нет",
  );
});

test("removed club is absent and the two curating institutions are explained", async ({
  page,
}) => {
  await mainSearch(page).fill("Искорка");
  await expect(page.getByRole("article")).toHaveCount(0);
  await page.getByRole("button", { name: "Очистить поиск" }).click();
  await expect(page.getByRole("article")).toHaveCount(22);
  await page
    .getByRole("button", { name: "О проекте", exact: true })
    .first()
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.locator(".organization-cards")).toContainText(
    "Молодёжный центр «Московский»",
  );
  await expect(dialog.locator(".organization-cards")).toContainText(
    "Дом молодёжи «Пулковец»",
  );
  await expect(dialog.locator(".organization-cards")).toContainText(
    "Центр патриотического воспитания",
  );
  await expect(
    dialog.getByRole("link", { name: "Администрация Московского района" }),
  ).toHaveAttribute("href", "https://vk.ru/zhit_v_moskovskom");
});
