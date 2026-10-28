const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const universalRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(universalRoot, "../..");

require.extensions[".ts"] = (module, filename) => {
  const source = fs.readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
    fileName: filename,
  }).outputText;
  module._compile(output, filename);
};

function load(relativePath) {
  return require(path.resolve(universalRoot, relativePath));
}

function loadRepo(relativePath) {
  return require(path.resolve(repoRoot, relativePath));
}

module.exports = { universalRoot, repoRoot, load, loadRepo };
