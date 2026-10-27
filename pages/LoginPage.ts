import type { Locator, Page } from "@playwright/test";

export class LoginPage {
  readonly usernameInput: Locator;
  readonly passwordInput: Locator;
  readonly loginButton: Locator;
  readonly errorMessage: Locator;

  constructor(private readonly page: Page) {
    this.usernameInput = page.getByPlaceholder("Username", { exact: true });
    this.passwordInput = page.getByPlaceholder("Password", { exact: true });
    this.loginButton = page.getByRole("button", { name: "Login", exact: true });
    this.errorMessage = page.getByTestId("error");
  }

  async goto(): Promise<void> {
    await this.page.goto("/");
  }

  async login(username: string, password: string): Promise<void> {
    await this.usernameInput.fill(username);
    await this.passwordInput.fill(password);
    await this.loginButton.click();
  }
}
