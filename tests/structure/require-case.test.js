// macOS nggak bedain huruf besar/kecil nama file, Linux/Docker bedain.
// Test ini mastiin semua require relatif ejaannya persis sama kayak file di disk,
// biar backend nggak lolos di laptop tapi crash pas start di server.
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "../..");
const SCAN_DIRS = ["src", "tests"];
const REQUIRE_PATTERN =
  /(?:require|jest\.mock|jest\.requireActual|jest\.doMock)\(\s*["'](\.{1,2}\/[^"']+)["']/g;

function listJsFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return listJsFiles(full);
    return entry.name.endsWith(".js") ? [full] : [];
  });
}

function resolveCandidate(fromFile, spec) {
  const base = path.resolve(path.dirname(fromFile), spec);
  return [base, `${base}.js`, `${base}.json`, path.join(base, "index.js")].find(
    (candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile(),
  );
}

function hasExactCase(absolutePath) {
  const relative = path.relative(ROOT, absolutePath).split(path.sep);
  let current = ROOT;
  for (const segment of relative) {
    if (!fs.readdirSync(current).includes(segment)) return false;
    current = path.join(current, segment);
  }
  return true;
}

function findCaseMismatches(files) {
  const mismatches = [];
  for (const file of files) {
    const source = fs.readFileSync(file, "utf8");
    for (const [, spec] of source.matchAll(REQUIRE_PATTERN)) {
      const resolved = resolveCandidate(file, spec);
      if (resolved && !hasExactCase(resolved)) {
        mismatches.push(`${path.relative(ROOT, file)} → ${spec}`);
      }
    }
  }
  return mismatches;
}

describe("ejaan path require (case-sensitive)", () => {
  test("[positive] semua require relatif di src & tests sama persis dengan nama file", () => {
    const files = SCAN_DIRS.flatMap((dir) => listJsFiles(path.join(ROOT, dir)));
    expect(findCaseMismatches(files)).toEqual([]);
  });

  test("[negative] require yang beda huruf besar/kecil ketahuan", () => {
    const tmpDir = fs.mkdtempSync(path.join(ROOT, "tests", ".tmp-case-"));
    try {
      fs.writeFileSync(path.join(tmpDir, "fooBar.js"), "module.exports = 1;");
      const consumer = path.join(tmpDir, "consumer.js");
      fs.writeFileSync(consumer, 'require("./foobar");');
      const isCaseInsensitiveFs = fs.existsSync(path.join(tmpDir, "foobar.js"));
      const mismatches = findCaseMismatches([consumer]);
      // Di Linux file "foobar.js" nggak ketemu sama sekali (resolve gagal);
      // di macOS ketemu tapi ejaannya beda -> harus ke-flag.
      expect(mismatches).toEqual(isCaseInsensitiveFs ? ["tests/" + path.basename(tmpDir) + "/consumer.js → ./foobar"] : []);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
