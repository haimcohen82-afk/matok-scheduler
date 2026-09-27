import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDirectory, "../..");
const read = (relativePath) => readFile(path.join(root, relativePath), "utf8");

const [consentHtml, consentJs, loginHtml, loginJs, authConfig, netlify] = await Promise.all([
  read("oauth/consent/index.html"),
  read("oauth/consent/app.js"),
  read("login/index.html"),
  read("login/app.js"),
  read("auth/supabase.js"),
  read("netlify.toml"),
]);

assert.match(consentHtml, /src="\/oauth\/consent\/app\.js"/);
assert.match(loginHtml, /src="\/login\/app\.js"/);
assert.match(authConfig, /@supabase\/supabase-js@2\.117\.2\/\+esm/);
assert.match(authConfig, /https:\/\/hotfvqqzahakumwadtiy\.supabase\.co/);
assert.match(authConfig, /sb_publishable_[A-Za-z0-9_-]+/);
assert.doesNotMatch(authConfig, /service_role|sb_secret_|META_PAGE_ACCESS_TOKEN|MATOK_API_KEY/i);

for (const method of ["getAuthorizationDetails", "approveAuthorization", "denyAuthorization"]) {
  assert.match(consentJs, new RegExp(method));
}
assert.match(loginJs, /signInWithPassword/);
assert.match(netlify, /Cache-Control = "no-store, max-age=0"/);
assert.match(netlify, /frame-ancestors 'none'/);
assert.match(netlify, /script-src 'self' https:\/\/cdn\.jsdelivr\.net/);
assert.doesNotMatch(consentHtml + loginHtml, /<script(?![^>]*\bsrc=)[^>]*>/i);
assert.doesNotMatch(consentHtml + loginHtml, /style\s*=/i);

console.log("OAuth pages, pinned client dependency, and Netlify security policy verified.");
