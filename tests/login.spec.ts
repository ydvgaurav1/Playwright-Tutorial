import { expect, test } from "../fixtures";
import { users } from "../test-data/users";

test.describe(
  "SauceDemo login",
  { tag: ["@sanity", "@regression", "@module:authentication"] },
  () => {
    test.beforeEach(async ({ loginPage }) => {
      await loginPage.goto();
    });

    test("standard user can log in", async ({ loginPage, page }) => {
      await test.step("Submit valid credentials", async () => {
        await loginPage.login(users.standard.username, users.standard.password);
      });

      await test.step("Verify the inventory page", async () => {
        await expect(page).toHaveURL(/\/inventory\.html$/);
        await expect(page.getByTestId("title")).toHaveText("Products");
      });
    });

    test("invalid user sees an authentication error", async ({ loginPage }) => {
      await loginPage.login(users.invalid.username, users.invalid.password);

      await expect(loginPage.errorMessage).toContainText(
        "Username and password do not match",
      );
    });
  },
);
