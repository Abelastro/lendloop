import { expect, test } from "@playwright/test";

test.describe("public surface", () => {
  test("landing page tells the LendLoop story", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Borrow what you need",
    );
    await expect(page.getByText("A neighborhood tool board").first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Sign in" }).first()).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Join LendLoop/ }).first(),
    ).toBeVisible();
  });

  test("public board exposes only the public projection", async ({ page }) => {
    await page.goto("/#board");
    await page.waitForLoadState("networkidle");

    await expect(
      page.getByRole("heading", { name: "A live shelf for the neighborhood." }),
    ).toBeVisible();
    await expect(
      page.getByText("Public view shows tool names and categories only", {
        exact: false,
      }),
    ).toBeVisible();

    const filter = page.getByRole("group", { name: "Filter by category" });
    await expect(filter).toBeVisible();
    await filter.getByRole("button", { name: "Power tools" }).click();
    await expect(filter.getByRole("button", { name: "Power tools" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  test("health endpoint is no-store and alive", async ({ request }) => {
    const response = await request.get("/api/health");
    expect(response.status()).toBe(200);
    expect(response.headers()["cache-control"]).toContain("no-store");
    expect(await response.json()).toEqual({
      status: "ok",
      service: "lendloop-web",
    });
  });

  test("signed-out workspace redirects to sign-in", async ({ page }) => {
    await page.goto("/app");
    await expect(page).toHaveURL(/\/sign-in/);
  });
});
