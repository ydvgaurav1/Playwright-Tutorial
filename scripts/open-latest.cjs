const { existsSync } = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");

const reportPath = path.resolve("reports/latest/index.html");

if (!existsSync(reportPath)) {
  console.error("No completed custom report exists at reports/latest/index.html");
  process.exit(1);
}

const command =
  process.platform === "darwin"
    ? { executable: "open", arguments: [reportPath] }
    : process.platform === "win32"
      ? { executable: "cmd", arguments: ["/c", "start", "", reportPath] }
      : { executable: "xdg-open", arguments: [reportPath] };

spawn(command.executable, command.arguments, {
  detached: true,
  stdio: "ignore",
}).unref();

console.log(`Opened ${reportPath}`);
