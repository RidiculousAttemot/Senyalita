import http from "http";
import puppeteer from "puppeteer";

const PORT = 8766;

const server = http.createServer((req, res) => {
  res.setHeader("Content-Type", "text/html");
  res.end("<html><body><h1>Hello</h1><script>document.title='loaded';</script></body></html>");
});

const main = async () => {
  await new Promise((r) => server.listen(PORT, r));
  console.log("Server on", PORT);

  const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
  const page = await browser.newPage();

  page.on("pageerror", (e) => console.log("ERR:", e.message));

  console.log("Navigating...");
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: "load", timeout: 10000 });
  console.log("Loaded, title:", await page.title());

  await browser.close();
  server.close();
  console.log("Done");
};

main().catch(console.error);
