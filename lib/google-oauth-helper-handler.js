const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const ACCOUNT_MANAGEMENT_BASE = "https://mybusinessaccountmanagement.googleapis.com/v1";
const BUSINESS_INFO_BASE = "https://mybusinessbusinessinformation.googleapis.com/v1";
const SERVICE_USAGE_BASE = "https://serviceusage.googleapis.com/v1";
const PROJECT_NUMBER = "717256969075";
const SCOPE = [
  "https://www.googleapis.com/auth/business.manage",
  "https://www.googleapis.com/auth/cloud-platform",
].join(" ");
const REQUIRED_GOOGLE_SERVICES = [
  "mybusinessaccountmanagement.googleapis.com",
  "mybusinessbusinessinformation.googleapis.com",
  "mybusiness.googleapis.com",
];
const fs = require("fs");
const path = require("path");

const ENV_PATH = path.join(__dirname, "..", ".env");
const DATA_DIR = path.join(__dirname, "..", ".data");
const OAUTH_ERROR_LOG = path.join(DATA_DIR, "google-oauth-last-error.txt");

const escapeHtml = (value = "") =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const sendHtml = (res, statusCode, html) => {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.end(html);
};

const getRedirectUri = (req) =>
  process.env.GOOGLE_REDIRECT_URI ||
  `http://${req.headers.host || "localhost:3000"}/oauth/google/callback`;

const getMissingOAuthEnv = () =>
  ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"].filter(
    (key) => !process.env[key] || process.env[key].trim() === ""
  );

const getJson = async (url, accessToken) => {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};

  if (!response.ok) {
    throw new Error(`${url} failed: ${response.status} ${text}`);
  }

  return payload;
};

const postJson = async (url, accessToken, body = {}) => {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};

  if (!response.ok) {
    throw new Error(`${url} failed: ${response.status} ${text}`);
  }

  return payload;
};

const exchangeCodeForTokens = async (code, redirectUri) => {
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    }),
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};

  if (!response.ok) {
    throw new Error(`Google token exchange failed: ${response.status} ${text}`);
  }

  return payload;
};

const stripResourceId = (name, prefix) => String(name || "").replace(prefix, "");

const upsertEnvValues = (values) => {
  const current = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, "utf8") : "";
  const lines = current.split(/\r?\n/);
  const keys = Object.keys(values);
  const seen = new Set();
  const nextLines = lines.map((line) => {
    const match = line.match(/^([A-Z0-9_]+)=/);

    if (!match || !keys.includes(match[1])) {
      return line;
    }

    seen.add(match[1]);
    return `${match[1]}=${values[match[1]] || ""}`;
  });

  for (const key of keys) {
    if (!seen.has(key)) {
      nextLines.push(`${key}=${values[key] || ""}`);
    }

    process.env[key] = values[key] || "";
  }

  fs.writeFileSync(ENV_PATH, `${nextLines.filter((line, index) => line || index < nextLines.length - 1).join("\n")}\n`);
};

const getBusinessProfiles = async (accessToken) => {
  const accountsPayload = await getJson(`${ACCOUNT_MANAGEMENT_BASE}/accounts`, accessToken);
  const accounts = Array.isArray(accountsPayload.accounts) ? accountsPayload.accounts : [];

  const profiles = [];

  for (const account of accounts) {
    const accountName = account.name || "";
    const locationsPayload = await getJson(
      `${BUSINESS_INFO_BASE}/${accountName}/locations?` +
        new URLSearchParams({
          readMask: "name,title,storefrontAddress,metadata",
        }).toString(),
      accessToken
    );
    const locations = Array.isArray(locationsPayload.locations)
      ? locationsPayload.locations
      : [];

    profiles.push({ account, locations });
  }

  return profiles;
};

const enableGoogleBusinessServices = async (accessToken) => {
  const results = [];

  for (const service of REQUIRED_GOOGLE_SERVICES) {
    try {
      await postJson(
        `${SERVICE_USAGE_BASE}/projects/${PROJECT_NUMBER}/services/${service}:enable`,
        accessToken
      );
      results.push({ service, status: "enabled" });
    } catch (error) {
      results.push({ service, status: "skipped", detail: error.message });
    }
  }

  return results;
};

const wait = (milliseconds) =>
  new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });

const getBusinessProfilesWithRetry = async (accessToken) => {
  try {
    return await getBusinessProfiles(accessToken);
  } catch (error) {
    await wait(30000);
    return getBusinessProfiles(accessToken);
  }
};

const writeOAuthErrorLog = (error) => {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  fs.writeFileSync(
    OAUTH_ERROR_LOG,
    [`${new Date().toISOString()}`, error.message, error.stack || ""].join("\n\n")
  );
};

const renderStartPage = (req, res) => {
  const missing = getMissingOAuthEnv();

  if (missing.length > 0) {
    return sendHtml(
      res,
      500,
      `<h1>Missing Google OAuth env</h1><p>Add these to <code>.env</code>: ${escapeHtml(
        missing.join(", ")
      )}</p>`
    );
  }

  const redirectUri = getRedirectUri(req);
  const authUrl =
    `${AUTH_URL}?` +
    new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: SCOPE,
      access_type: "offline",
      prompt: "consent",
      include_granted_scopes: "true",
    }).toString();

  res.statusCode = 302;
  res.setHeader("Location", authUrl);
  res.end();
};

const renderCallbackPage = async (req, res) => {
  const { code, error } = req.query || {};

  if (error) {
    return sendHtml(res, 400, `<h1>Google OAuth error</h1><p>${escapeHtml(error)}</p>`);
  }

  if (!code) {
    return sendHtml(res, 400, "<h1>Missing OAuth code</h1>");
  }

  const redirectUri = getRedirectUri(req);
  const tokens = await exchangeCodeForTokens(code, redirectUri);

  if (!tokens.refresh_token) {
    return sendHtml(
      res,
      200,
      `<h1>No refresh token returned</h1>
      <p>Google only returns a refresh token on first consent or when <code>prompt=consent</code> is honored. Revoke this app from your Google Account security page, then try <a href="/oauth/google/start">starting again</a>.</p>`
    );
  }

  upsertEnvValues({
    GOOGLE_REFRESH_TOKEN: tokens.refresh_token,
    GOOGLE_BUSINESS_ACCOUNT_ID: process.env.GOOGLE_BUSINESS_ACCOUNT_ID,
    GOOGLE_BUSINESS_LOCATION_ID: process.env.GOOGLE_BUSINESS_LOCATION_ID,
  });

  const serviceResults = await enableGoogleBusinessServices(tokens.access_token);
  await wait(5000);
  const profiles = await getBusinessProfilesWithRetry(tokens.access_token);
  const firstProfile = profiles.find((profile) => profile.locations.length > 0);
  const firstAccount = firstProfile?.account;
  const firstLocation = firstProfile?.locations?.[0];
  const accountId = stripResourceId(firstAccount?.name, "accounts/");
  const locationId = stripResourceId(firstLocation?.name, `${firstAccount?.name}/locations/`);

  const envBlock = [
    `GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}`,
    accountId ? `GOOGLE_BUSINESS_ACCOUNT_ID=${accountId}` : "GOOGLE_BUSINESS_ACCOUNT_ID=",
    locationId ? `GOOGLE_BUSINESS_LOCATION_ID=${locationId}` : "GOOGLE_BUSINESS_LOCATION_ID=",
  ].join("\n");

  upsertEnvValues({
    GOOGLE_REFRESH_TOKEN: tokens.refresh_token,
    GOOGLE_BUSINESS_ACCOUNT_ID: accountId,
    GOOGLE_BUSINESS_LOCATION_ID: locationId,
  });

  const profileList = profiles
    .map(({ account, locations }) => {
      const locationItems = locations
        .map(
          (location) =>
            `<li><strong>${escapeHtml(location.title || "Untitled location")}</strong><br>
            Account ID: <code>${escapeHtml(stripResourceId(account.name, "accounts/"))}</code><br>
            Location ID: <code>${escapeHtml(stripResourceId(location.name, `${account.name}/locations/`))}</code></li>`
        )
        .join("");

      return `<section><h2>${escapeHtml(account.accountName || account.name)}</h2><ul>${locationItems}</ul></section>`;
    })
    .join("");
  const serviceList = serviceResults
    .map(
      (result) =>
        `<li><strong>${escapeHtml(result.service)}</strong>: ${escapeHtml(result.status)}</li>`
    )
    .join("");

  return sendHtml(
    res,
    200,
    `<!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Google OAuth Complete</title>
        <style>
          body{font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;margin:40px;line-height:1.5;color:#111}
          pre{white-space:pre-wrap;background:#f4f4f4;border:1px solid #ddd;padding:16px}
          code{background:#f4f4f4;padding:2px 5px}
        </style>
      </head>
      <body>
        <h1>Google OAuth Complete</h1>
        <p>The local <code>.env</code> file was updated automatically.</p>
        <pre>${escapeHtml(envBlock)}</pre>
        <h2>API Setup</h2>
        <ul>${serviceList}</ul>
        <h2>Business Profiles Found</h2>
        ${profileList || "<p>No Business Profile locations were returned for this Google account.</p>"}
      </body>
    </html>`
  );
};

const googleOAuthStartHandler = async (req, res) => {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed." });
  }

  return renderStartPage(req, res);
};

const googleOAuthCallbackHandler = async (req, res) => {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed." });
  }

  try {
    return await renderCallbackPage(req, res);
  } catch (error) {
    writeOAuthErrorLog(error);
    const projectNumber = PROJECT_NUMBER;
    const apiLinks = [
      {
        label: "My Business Account Management API",
        href: `https://console.developers.google.com/apis/api/mybusinessaccountmanagement.googleapis.com/overview?project=${projectNumber}`,
      },
      {
        label: "My Business Business Information API",
        href: `https://console.developers.google.com/apis/api/mybusinessbusinessinformation.googleapis.com/overview?project=${projectNumber}`,
      },
      {
        label: "Google Business Profile API",
        href: `https://console.developers.google.com/apis/api/mybusiness.googleapis.com/overview?project=${projectNumber}`,
      },
    ];
    const links = apiLinks
      .map((api) => `<li><a href="${api.href}" target="_blank" rel="noreferrer">${api.label}</a></li>`)
      .join("");

    return sendHtml(
      res,
      500,
      `<!doctype html>
      <html lang="en">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>Google OAuth Needs One More Step</title>
          <style>
            body{font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;margin:40px;line-height:1.5;color:#111}
            pre{white-space:pre-wrap;background:#f4f4f4;border:1px solid #ddd;padding:16px;overflow:auto}
          </style>
        </head>
        <body>
          <h1>Google Business Profile Access Is Quota-Gated</h1>
          <p>The Google sign-in worked, and the refresh token was saved locally. The remaining blocker is Google Business Profile API quota/access for this Cloud project.</p>
          <p>If the technical detail mentions <code>quota_limit_value": "0"</code>, Google has not granted this project usable Business Profile API access yet. Submit Google's Basic API Access request for the project, or use the Google Places API fallback by adding <code>GOOGLE_PLACES_API_KEY</code> and <code>GOOGLE_PLACE_ID</code> to <code>.env</code>.</p>
          <ul>${links}</ul>
          <p>After enabling anything Google asks for, wait one or two minutes and <a href="/oauth/google/start">try again</a>.</p>
          <h2>Technical detail</h2>
          <pre>${escapeHtml(error.message)}</pre>
        </body>
      </html>`
    );
  }
};

module.exports = {
  googleOAuthCallbackHandler,
  googleOAuthStartHandler,
};
