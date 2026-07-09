import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { join, extname } from "node:path";

const PORT = parseInt(process.env.PORT || "8080", 10);
const CLIENT_DIR = new URL("./dist/client/", import.meta.url).pathname;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

let serverModule;

async function ensureServer() {
  if (!serverModule) {
    serverModule = await import("./dist/server/server.js");
  }
  return serverModule.default;
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const pathname = url.pathname;

    // Try to serve static assets from dist/client first.
    // Only handle GET/HEAD for static; for API/SSR pass to the server handler.
    if (req.method === "GET" || req.method === "HEAD") {
      const ext = extname(pathname);
      if (ext && MIME[ext]) {
        const filePath = join(CLIENT_DIR, pathname === "/" ? "index.html" : pathname.slice(1));
        try {
          const content = readFileSync(filePath);
          res.writeHead(200, { "content-type": MIME[ext] || "application/octet-stream" });
          res.end(content);
          return;
        } catch {
          // file not found → fall through to SSR
        }
      }
    }

    // Pass to TanStack Start SSR handler
    const handler = await ensureServer();
    const nodeReq = req;
    const proto = req.headers["x-forwarded-proto"] || "http";
    const host = req.headers["x-forwarded-host"] || req.headers.host || `localhost:${PORT}`;
    const requestUrl = `${proto}://${host}${pathname}${url.search}`;
    const headers = new Headers();
    for (let i = 0; i < nodeReq.rawHeaders.length; i += 2) {
      headers.set(nodeReq.rawHeaders[i], nodeReq.rawHeaders[i + 1]);
    }

    let body;
    if (req.method !== "GET" && req.method !== "HEAD") {
      body = await new Promise((resolve) => {
        const chunks = [];
        req.on("data", (c) => chunks.push(c));
        req.on("end", () => resolve(Buffer.concat(chunks)));
      });
    }

    const request = new Request(requestUrl, {
      method: req.method,
      headers,
      body: body || undefined,
    });

    const response = await handler.fetch(request, {}, {});
    res.writeHead(response.status, Object.fromEntries(response.headers));
    if (response.body) {
      for await (const chunk of response.body) {
        res.write(chunk);
      }
    }
    res.end();
  } catch (error) {
    console.error("Server error:", error);
    res.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
    res.end("Error interno del servidor");
  }
});

server.listen(PORT, () => {
  console.log(`[CAIF] Server running on http://localhost:${PORT}`);
});
