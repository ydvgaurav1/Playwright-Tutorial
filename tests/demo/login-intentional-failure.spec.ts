import { expect, test } from "../../fixtures";
import { users } from "../../test-data/users";

test(
  "DEMO - Intentional Failure",
  { tag: ["@demo", "@regression", "@module:authentication"] },
  async ({ loginPage }) => {
    await test.step("Open the login page", async () => {
      await loginPage.goto();
    });

    await test.step("Submit invalid credentials", async () => {
      await loginPage.login(users.invalid.username, users.invalid.password);
    });

    await test.step("Verify an intentionally incorrect error message", async () => {
      await expect(
        loginPage.errorMessage,
        "Intentional demo assertion: SauceDemo should reject invalid credentials, but this expected copy is deliberately wrong.",
      ).toContainText("Account locked after invalid login");
    });
  },
);
