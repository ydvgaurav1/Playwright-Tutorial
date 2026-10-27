import { readEnv } from "../utils/env";

export type UserCredentials = Readonly<{
  username: string;
  password: string;
}>;

export const users: Readonly<{
  standard: UserCredentials;
  invalid: UserCredentials;
}> = {
  standard: {
    username: readEnv("STANDARD_USER", "standard_user"),
    password: readEnv("STANDARD_PASSWORD", "secret_sauce"),
  },
  invalid: {
    username: "invalid_user",
    password: "invalid_password",
  },
};
