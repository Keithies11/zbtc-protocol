// Guards the static-site security headers in vercel.json. The CSP pins the inline
// miner script by hash, so any edit to that script must be followed by
// `node scripts/build-vercel-headers.js`; this test fails if the two drift apart.
const { expect } = require("chai");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "public", "index.html"), "utf8");
const config = JSON.parse(fs.readFileSync(path.join(root, "vercel.json"), "utf8"));
const rule = (config.headers || []).find((h) => h.source === "/(.*)");
const header = (key) => rule.headers.find((h) => h.key === key)?.value;
const directive = (name) => header("Content-Security-Policy").split(";").map((s) => s.trim()).find((s) => s.startsWith(`${name} `))?.slice(name.length + 1).split(/\s+/) || [];

describe("Vercel security headers", function () {
  it("applies a header rule to every path", function () {
    expect(rule, "headers rule for /(.*)").to.exist;
    for (const key of ["Content-Security-Policy", "X-Frame-Options", "X-Content-Type-Options", "Referrer-Policy", "Permissions-Policy", "Strict-Transport-Security"]) {
      expect(header(key), key).to.be.a("string").and.not.empty;
    }
    expect(header("X-Frame-Options")).to.equal("DENY");
    expect(header("X-Content-Type-Options")).to.equal("nosniff");
  });

  it("pins the current inline miner script by hash and allows no other inline script", function () {
    const inline = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
    expect(inline, "exactly one inline script").to.have.length(1);
    const hash = `'sha256-${crypto.createHash("sha256").update(inline[0], "utf8").digest("base64")}'`;
    const scriptSrc = directive("script-src");
    expect(scriptSrc, "run: node scripts/build-vercel-headers.js").to.include(hash);
    expect(scriptSrc).to.not.include("'unsafe-inline'");
    expect(scriptSrc).to.not.include("'unsafe-eval'");
    expect(html).to.not.match(/ on[a-z]+="/i, "inline event handlers would be blocked by the CSP");
  });

  it("allows exactly the origins the page loads and nothing broader", function () {
    const externalScriptHosts = [...html.matchAll(/<script src="(https:\/\/[^/"]+)/g)].map((m) => m[1]);
    for (const host of externalScriptHosts) expect(directive("script-src"), host).to.include(host);
    const fetched = [...html.matchAll(/https:\/\/zynintel\.com\/(?:api|zbtc)\/[^"'`]*/g)];
    expect(fetched.length).to.be.greaterThan(0);
    expect(directive("connect-src")).to.deep.equal(["https://zynintel.com"]);
    expect(directive("style-src")).to.include("https://fonts.googleapis.com");
    expect(directive("font-src")).to.include("https://fonts.gstatic.com");
    expect(directive("img-src")).to.include("https://zynintel.com");
    expect(directive("default-src")).to.deep.equal(["'none'"]);
    expect(directive("frame-ancestors")).to.deep.equal(["'none'"]);
    expect(directive("object-src")).to.deep.equal(["'none'"]);
    for (const d of ["script-src", "connect-src", "img-src", "style-src", "font-src"]) {
      expect(directive(d), `${d} must not use a wildcard`).to.not.include("*");
      expect(directive(d).join(" "), `${d} must not use http:`).to.not.match(/\bhttp:/);
    }
  });
});
