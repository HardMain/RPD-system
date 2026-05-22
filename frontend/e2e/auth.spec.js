import { test, expect } from "@playwright/test";

test.describe("Авторизация", () => {
  test("вход с верными данными открывает приложение", async ({ page }) => {
    await page.goto("/");

    await page.getByPlaceholder("Введите логин").fill("ivanov");
    await page.getByPlaceholder("Введите пароль").fill("password");
    await page.getByRole("button", { name: "Войти" }).click();

    await expect(page.getByText("Рабочие программы дисциплин")).toBeVisible();
    await expect(page.getByPlaceholder("Введите логин")).toHaveCount(0);
  });

  test("неверные данные показывают ошибку", async ({ page }) => {
    await page.goto("/");

    await page.getByPlaceholder("Введите логин").fill("ivanov");
    await page.getByPlaceholder("Введите пароль").fill("неправильный");
    await page.getByRole("button", { name: "Войти" }).click();

    await expect(page.getByText("Неверные учётные данные")).toBeVisible();
  });

  test("текст техподдержки виден на странице входа", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText(/обратитесь в техническую поддержку/i)).toBeVisible();
  });
});
