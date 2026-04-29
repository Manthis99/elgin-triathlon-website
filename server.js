const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");

const root = __dirname;
const dataDir = path.join(root, "data");
const csvPath = path.join(dataDir, "interest.csv");
const port = Number(process.env.PORT || 4173);

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

function sendJson(response, status, body) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
}

function csvEscape(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function readJson(request) {
  const chunks = [];

  for await (const chunk of request) {
    chunks.push(chunk);
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

async function saveInterest(request, response) {
  try {
    const body = await readJson(request);
    const name = String(body.name || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const distance = String(body.distance || "").trim();

    if (!name || !email || !distance) {
      sendJson(response, 400, { error: "Name, email, and distance are required." });
      return;
    }

    if (!isValidEmail(email)) {
      sendJson(response, 400, { error: "Please enter a valid email address." });
      return;
    }

    await fs.mkdir(dataDir, { recursive: true });

    try {
      await fs.access(csvPath);
    } catch {
      await fs.writeFile(csvPath, "submitted_at,name,email,distance\n", "utf8");
    }

    const row = [
      new Date().toISOString(),
      name,
      email,
      distance,
    ].map(csvEscape).join(",");

    await fs.appendFile(csvPath, `${row}\n`, "utf8");
    sendJson(response, 201, { ok: true });
  } catch {
    sendJson(response, 400, { error: "Could not read this form submission." });
  }
}

async function serveStatic(request, response) {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const requestedPath = decodeURIComponent(url.pathname);
  const normalizedPath = requestedPath === "/" ? "/index.html" : requestedPath;
  const filePath = path.normalize(path.join(root, normalizedPath));

  if (!filePath.startsWith(root)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  try {
    const file = await fs.readFile(filePath);
    const extension = path.extname(filePath);
    response.writeHead(200, {
      "Content-Type": contentTypes[extension] || "application/octet-stream",
    });
    response.end(file);
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
  }
}

const server = http.createServer((request, response) => {
  if (request.method === "POST" && request.url === "/api/interest") {
    saveInterest(request, response);
    return;
  }

  if (request.method === "GET" || request.method === "HEAD") {
    serveStatic(request, response);
    return;
  }

  response.writeHead(405, { "Content-Type": "text/plain; charset=utf-8" });
  response.end("Method not allowed");
});

server.listen(port, () => {
  console.log(`Elgin Triathlon site running at http://localhost:${port}`);
  console.log(`Interest submissions save to ${csvPath}`);
});
