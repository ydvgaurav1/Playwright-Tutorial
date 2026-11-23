* [ ] 

# Environment Variable Flow: .env.example to Test Execution

## Overview

This project uses a layered approach to load environment variables from `.env.example` down to actual test usage.

## Flow Path

```
.env.example (reference) 
    → .env (actual, may or may not exist)
    → dotenv/config → process.env
    → utils/env.ts → readEnv(name, fallback)
    → test-data/users.ts → credentials
    → tests/login.spec.ts → test execution
    → pages/LoginPage.ts → form interaction
```

## Step-by-Step

### 1. `.env.example`

Reference file containing public demo values:

- `BASE_URL=https://www.saucedemo.com`
- `STANDARD_USER=standard_user`
- `STANDARD_PASSWORD=secret_sauce`
- `TEST_ENV=demo`

### 2. `playwright.config.ts`

```typescript
import "dotenv/config"; // Loads .env if present

const baseURL = process.env.BASE_URL ?? "https://www.saucedemo.com";
// ... uses baseURL throughout config
```

- `dotenv/config` automatically loads variables from `.env` into `process.env`
- Falls back to hardcoded `"https://www.saucedemo.com"` if not set

### 3. `utils/env.ts`

```typescript
export function readEnv(name: string, fallback: string): string {
  const value = process.env[name] ?? fallback;
  if (value.trim() === "") {
    throw new Error(`${name} must not be empty.`);
  }
  return value;
}
```

- Reads from `process.env` with a fallback value
- Throws if the value is empty after trimming

### 4. `test-data/users.ts` - Credentials Configuration

```typescript
import { readEnv } from "../utils/env";

export const users = {
  standard: {
    username: readEnv("STANDARD_USER", "standard_user"),
    password: readEnv("STANDARD_PASSWORD", "secret_sauce"),
  },
  // ...
};
```

- Uses `readEnv()` to get `STANDARD_USER` and `STANDARD_PASSWORD`
- Falls back to `"standard_user"` and `"secret_sauce"` (which match `.env.example` values)

### 5. Test Execution

- `tests/login.spec.ts` uses `users.standard.username` and `users.standard.password`
- These are passed to `LoginPage.fill()` which types them into the form fields

## Important Notes

- **No `.env` file**: Since there's no actual `.env` file, the fallback values from `.env.example` are used directly
- **`dotenv/config`**: This package is what bridges `.env` files to `process.env`
- **Fallback chain**: `process.env.VAR` → `readEnv()` fallback → hardcoded default in `playwright.config.ts`
- **`BASE_URL`**: Has a separate fallback in `playwright.config.ts` (`process.env.BASE_URL ?? "https://www.saucedemo.com"`)
