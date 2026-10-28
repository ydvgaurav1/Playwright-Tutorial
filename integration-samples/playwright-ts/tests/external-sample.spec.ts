import { expect, test } from "@playwright/test";

const SAMPLE_PAGE = `<!doctype html>
<html lang="en">
  <head><title>External Playwright sample</title></head>
  <body>
    <main>
      <h1 data-testid="heading">Universal reporter external sample</h1>
      <p data-testid="description">This page is rendered by an independent project.</p>
    </main>
  </body>
</html>`;

test.describe(
  "External Playwright integration",
  { tag: ["@external", "@module:validation"] },
  () => {
    test("passes with steps, console logs, and screenshot evidence", async ({
      page,
    }, testInfo) => {
      await test.step("Render a local page without network access", async () => {
        await page.setContent(SAMPLE_PAGE);
      });

      await test.step("Verify accessible heading and description", async () => {
        await expect(page.getByRole("heading", { level: 1 })).toHaveText(
          "Universal reporter external sample",
        );
        await expect(page.getByTestId("description")).toContainText(
          "independent project",
        );
      });

      console.log(
        `[external-sample] pass test executed in project "${testInfo.project.name}"`,
      );
      const screenshot = await page.screenshot({ fullPage: true });
      await testInfo.attach("passing-page.png", {
        body: screenshot,
        contentType: "image/png",
      });
    });

    test("fails with an assertion and screenshot evidence", async ({
      page,
    }, testInfo) => {
      await page.setContent(SAMPLE_PAGE);

      const screenshot = await page.screenshot({ fullPage: true });
      await testInfo.attach("failure-page.png", {
        body: screenshot,
        contentType: "image/png",
      });
      console.log(
        [
          "Intentional failure for universal reporter validation.",
          "The heading currently says: Universal reporter external sample",
          "The assertion expects: Universal reporter EXTERNAL sample",
        ].join("\n"),
      );

      await expect(page.getByTestId("heading")).toHaveText(
        "Universal reporter EXTERNAL sample",
      );
    });

    test("is skipped intentionally", async () => {
      test.skip(true, "Intentional skip used to validate status classification.");
      expect(true).toBe(true);
    });
  },
);

test.describe("External Playwright retry sample", () => {
  test.describe.configure({ retries: 1 });

  test(
    "recovers on retry and is classified as flaky",
    { tag: ["@external", "@module:retry"] },
    async ({}, testInfo) => {
      console.log(`[external-sample] retry attempt ${testInfo.retry}`);
      expect(
        testInfo.retry,
        "The first attempt fails on purpose; the retry passes.",
      ).toBeGreaterThan(0);
    },
  );
});
