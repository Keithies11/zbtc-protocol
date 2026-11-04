// Guards the static-site security headers and the external-only script policy.
const { expect } = require("chai");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "public", "index.html"), "utf8");
const config = JSON.parse(fs.readFileSync(path.join(root, "vercel.json"), "utf8"));
const rule = (config.headers || []).find((h) => h.source === "/(.*)");
const header = (key) => rule.headers.find((h) => h.key === key)?.value;
const directive = (name) => header("Content-Security-Policy").split(";").map((s) => s.trim()).find((s) => s.startsWith(`${name} `))?.slice(name.length + 1).split(/\s+/) || [];

describe("Vercel security headers", function () {
  it("uses the modern schema so headers are actually applied", function () {
    // With the legacy builds/routes schema Vercel silently ignores the headers key.
    expect(config).to.not.have.property("builds");
    expect(config).to.not.have.property("routes");
    expect(config.outputDirectory).to.equal("public");
    const redirect = config.redirects.find((r) => r.has?.some((h) => h.type === "host" && h.value === "temporary-prompt-emerald-zsr9wxt.vercel.app"));
    expect(redirect, ".vercel.app -> canonical domain redirect").to.exist;
    expect(redirect.destination).to.equal("https://miner.zynintel.com/:path*");
    expect(redirect.permanent).to.equal(true);
    expect(config.rewrites.some((r) => r.destination === "/index.html"), "catch-all rewrite to the miner page").to.equal(true);
  });

  it("applies a header rule to every path", function () {
    expect(rule, "headers rule for /(.*)").to.exist;
    for (const key of ["Content-Security-Policy", "X-Frame-Options", "X-Content-Type-Options", "Referrer-Policy", "Permissions-Policy", "Strict-Transport-Security"]) {
      expect(header(key), key).to.be.a("string").and.not.empty;
    }
    expect(header("X-Frame-Options")).to.equal("DENY");
    expect(header("X-Content-Type-Options")).to.equal("nosniff");
  });

  it("serves miner code externally and allows no inline executable script", function () {
    const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
    expect(scripts, "all script tags should have a src attribute").to.have.length.greaterThan(0);
    for (const [, attributes, content] of scripts) {
      expect(attributes).to.match(/\bsrc\s*=/i);
      expect(content.trim()).to.equal("");
    }
    expect(fs.existsSync(path.join(root, "public", "miner.js"))).to.equal(true);
    expect(html).to.include('<script src="/miner.js"></script>');
    const scriptSrc = directive("script-src");
    expect(scriptSrc).to.include("'self'");
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
