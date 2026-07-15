const fs = require("fs");
const path = require("path");
const http = require("http");
const { URL } = require("url");

const rootDir = __dirname;

if (typeof process.loadEnvFile === "function" && fs.existsSync(path.join(rootDir, ".env"))) {
  process.loadEnvFile(path.join(rootDir, ".env"));
}

const port = Number(process.env.PORT || 3000);

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".xml": "application/xml; charset=utf-8",
};

const handlers = {
  "/oauth/google/start": require("./lib/google-oauth-helper-handler").googleOAuthStartHandler,
  "/oauth/google/callback": require("./lib/google-oauth-helper-handler").googleOAuthCallbackHandler,
  "/api/reviews/google": require("./api/reviews/google"),
  "/api/reviews/zillow": require("./api/reviews/zillow"),
  "/api/stats": require("./api/stats"),
  "/api/lead": require("./api/lead"),
  "/api/media-assistant": require("./api/media-assistant"),
};

const readRequestBody = (req) =>
  new Promise((resolve, reject) => {
    const chunks = [];

    req.on("data", (chunk) => {
      chunks.push(chunk);
    });

    req.on("end", () => {
      resolve(Buffer.concat(chunks).toString("utf8"));
    });

    req.on("error", reject);
  });

const sendFile = (res, filePath) => {
  fs.readFile(filePath, (error, data) => {
    if (error) {
      res.statusCode = error.code === "ENOENT" ? 404 : 500;
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.end(error.code === "ENOENT" ? "Not found" : "Server error");
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    res.statusCode = 200;
    res.setHeader("Content-Type", mimeTypes[ext] || "application/octet-stream");
    res.end(data);
  });
};

const createResponseAdapter = (res) => {
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };

  res.json = (payload) => {
    if (!res.getHeader("Content-Type")) {
      res.setHeader("Content-Type", "application/json; charset=utf-8");
    }

    res.end(JSON.stringify(payload));
    return res;
  };

  return res;
};

const server = http.createServer(async (req, res) => {
  const requestUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = decodeURIComponent(requestUrl.pathname);

  if (handlers[pathname]) {
    try {
      const body = await readRequestBody(req);
      await handlers[pathname](
        {
          method: req.method,
          headers: req.headers,
          query: Object.fromEntries(requestUrl.searchParams.entries()),
          body,
        },
        createResponseAdapter(res)
      );
    } catch (error) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(
        JSON.stringify({
          error: "Local API execution failed.",
          detail: error.message,
        })
      );
    }
    return;
  }

  const requestedPath = pathname === "/" ? "/index.html" : pathname;
  const absolutePath = path.join(rootDir, requestedPath);
  const normalizedPath = path.normalize(absolutePath);

  if (!normalizedPath.startsWith(rootDir)) {
    res.statusCode = 403;
    res.end("Forbidden");
    return;
  }

  sendFile(res, normalizedPath);
});

server.listen(port, () => {
  console.log(`Andrew Allen site running at http://localhost:${port}`);
});
