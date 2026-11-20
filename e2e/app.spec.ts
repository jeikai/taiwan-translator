import { expect, test } from "@playwright/test";

test("guest can translate in conversation mode by typing", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Gõ chữ (bạn)").fill("Ga tàu điện ở đâu?");
  await page.getByLabel("Gõ chữ (bạn)").press("Enter");
  // The other person's half shows the translation into Traditional Chinese.
  await expect(page.getByTestId("half-B").getByText("[zh-TW] Ga tàu điện ở đâu?")).toBeVisible();
  await page.getByLabel("Gõ chữ (người đối diện)").fill("直走兩百公尺");
  await page.getByLabel("Gõ chữ (người đối diện)").press("Enter");
  await expect(page.getByTestId("half-A").getByText("[vi] 直走兩百公尺")).toBeVisible();
});

test("text mode translates as you type", async ({ page }) => {
  await page.goto("/text");
  await page.getByLabel("Văn bản cần dịch").fill("謝謝你");
  await expect(page.getByTestId("text-result")).toContainText("[vi] 謝謝你");
  await page.getByLabel("Ngôn ngữ đích").selectOption("en");
  await expect(page.getByTestId("text-result")).toContainText("[en] 謝謝你");
});

test("signed-in user gets conversation history", async ({ page }) => {
  const email = `u${Date.now()}${Math.floor(Math.random() * 1e6)}@example.com`;
  await page.goto("/register");
  await page.getByLabel("Tên hiển thị").fill("Phúc");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mật khẩu").fill("password123");
  await page.getByRole("button", { name: "Đăng ký" }).click();
  await expect(page.getByRole("button", { name: "Đăng xuất" })).toBeVisible();

  await page.getByLabel("Gõ chữ (bạn)").fill("Bao nhiêu tiền?");
  await page.getByLabel("Gõ chữ (bạn)").press("Enter");
  await expect(page.getByTestId("half-B").getByText("[zh-TW] Bao nhiêu tiền?")).toBeVisible();

  await page.goto("/history");
  await page.getByText("Bao nhiêu tiền?").first().click();
  await expect(page.getByText("[zh-TW] Bao nhiêu tiền?")).toBeVisible();

  await page.getByRole("button", { name: "Đăng xuất" }).click();
  await page.goto("/history");
  await expect(page).toHaveURL(/\/login/);
});
