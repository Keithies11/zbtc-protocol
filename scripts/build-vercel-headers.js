#!/usr/bin/env node
// Regenerates the security headers in vercel.json from public/index.html.
// The CSP script-src uses a hash of the single inline <script>, so it must be
// recomputed whenever that script changes. Run: node scripts/build-vercel-headers.js
"use strict";
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const root = path.join(__dirname, "..");
const htmlPath = path.join(root, "public", "index.html");
const configPath = path.join(root, "vercel.json");

const html = fs.readFileSync(htmlPath, "utf8");
const inlineScripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
if (inlineScripts.length !== 1) {
  throw new Error(`Expected exactly one inline <script> in public/index.html, found ${inlineScripts.length}`);
}
const scriptHash = `'sha256-${crypto.createHash("sha256").update(inlineScripts[0], "utf8").digest("base64")}'`;

// Every origin the page legitimately touches. Wallet extensions inject their own
// providers and are not governed by the page CSP; deep links (rabby://, okx://,
// link.metamask.io, ...) are navigations, which CSP does not restrict.
const csp = [
  "default-src 'none'",
  `script-src ${scriptHash} https://cdn.jsdelivr.net https://zynintel.com`,
  // Inline style attributes and the wallet picker's cssText require 'unsafe-inline';
  // scripts remain hash/origin-locked so this does not allow code execution.
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src https://fonts.gstatic.com",
  "img-src 'self' https://zynintel.com data:",
  "connect-src https://zynintel.com",
  "frame-ancestors 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "object-src 'none'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

// The legacy `builds`/`routes` schema makes Vercel ignore the top-level `headers`
// key, so the whole file is emitted in the modern schema. Static assets in public/
// are served as-is: a static deployment needs no build definition.
const config = {
  $schema: "https://openapi.vercel.sh/vercel.json",
  outputDirectory: "public",
  cleanUrls: false,
  trailingSlash: false,
  redirects: [
    {
      // Keep the generated .vercel.app hostname pointing at the canonical domain.
      source: "/:path*",
      has: [{ type: "host", value: "temporary-prompt-emerald-zsr9wxt.vercel.app" }],
      destination: "https://miner.zynintel.com/:path*",
      permanent: true,
    },
  ],
  rewrites: [
    // Single-page static site: every path other than real files serves the miner page.
    { source: "/((?!zyn-twitter-header\\.png$).*)", destination: "/index.html" },
  ],
  headers: [{ source: "/(.*)", headers: securityHeaders }],
};
fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
console.log(`vercel.json regenerated (script hash ${scriptHash})`);
