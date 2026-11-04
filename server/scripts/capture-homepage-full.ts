import http from "http";
import fs from "fs";
import path from "path";
import puppeteer from "puppeteer-core";

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const CLIENT_DIST = path.resolve(process.cwd(), "client/dist");
const OUTPUT_DIR = path.resolve(process.cwd(), "artifacts/screens/home-rebuild");

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

function startStaticServer(): Promise<{ server: http.Server; url: string }> {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let reqPath = req.url?.split("?")[0] || "/";
      if (reqPath === "/") reqPath = "/index.html";
      let filePath = path.join(CLIENT_DIST, reqPath);

      if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        filePath = path.join(CLIENT_DIST, "index.html");
      }

      const ext = path.extname(filePath).toLowerCase();
      const mimeTypes: Record<string, string> = {
        ".html": "text/html; charset=utf-8",
        ".js": "application/javascript; charset=utf-8",
        ".css": "text/css; charset=utf-8",
        ".json": "application/json",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".svg": "image/svg+xml",
        ".woff": "font/woff",
        ".woff2": "font/woff2",
        ".otf": "font/otf",
        ".ttf": "font/ttf",
      };

      const contentType = mimeTypes[ext] || "application/octet-stream";
      res.writeHead(200, { "Content-Type": contentType });
      fs.createReadStream(filePath).pipe(res);
    });

    server.listen(0, "127.0.0.1", () => {
      const port = (server.address() as any).port;
      resolve({ server, url: `http://127.0.0.1:${port}` });
    });
  });
}

async function main() {
  console.log("Starting static server for complete Home Page capture...");
  const { server, url } = await startStaticServer();
  console.log(`Server running at ${url}`);

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
  });

  const page = await browser.newPage();

  const viewports = [
    { width: 1440, height: 900, name: "1440" },
    { width: 1024, height: 768, name: "1024" },
    { width: 768, height: 1024, name: "768" },
    { width: 390, height: 844, name: "390" },
  ];

  for (const vp of viewports) {
    console.log(`Capturing Home Page at viewport: ${vp.name} (${vp.width}x${vp.height})...`);
    await page.setViewport({
      width: vp.width,
      height: vp.height,
      deviceScaleFactor: 2,
    });

    await page.goto(url, { waitUntil: "networkidle0" });
    await new Promise((r) => setTimeout(r, 800));

    // 1. Full Page Screenshot
    const outPathFull = path.join(OUTPUT_DIR, `homepage-full-${vp.name}.png`);
    await page.screenshot({ path: outPathFull, fullPage: true });
    console.log(`✓ Full Page: ${outPathFull} (${fs.statSync(outPathFull).size} bytes)`);

    // 2. Above-the-fold Viewport Screenshot
    const outPathFold = path.join(OUTPUT_DIR, `homepage-fold-${vp.name}.png`);
    await page.screenshot({ path: outPathFold, fullPage: false });
    console.log(`✓ Above Fold: ${outPathFold} (${fs.statSync(outPathFold).size} bytes)`);
  }

  await browser.close();
  server.close();
  console.log("All Home Page screenshots captured successfully.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

