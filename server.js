const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, "public");

const server = http.createServer((req, res) => {
  let filePath = path.join(PUBLIC_DIR, req.url === "/" ? "index.html" : req.url);
  const ext = path.extname(filePath);
  let contentType = "text/html";

  if (ext === ".js") contentType = "text/javascript";
  if (ext === ".css") contentType = "text/css";
  if (ext === ".json") contentType = "application/json";

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("404 Not Found");
    } else {
      res.writeHead(200, { "Content-Type": contentType });
      res.end(content);
    }
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 ZBTC dApp Server running at http://localhost:${PORT} and http://0.0.0.0:${PORT}`);
});
