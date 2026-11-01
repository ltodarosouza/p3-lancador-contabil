// Servidor local para testar a mesma rota que a Vercel serve: npm start
const http = require("http");
const fs = require("fs");
const path = require("path");
const { tratar, tratarFila, tratarExportar, tratarPainel } = require("./lib/rota");

try { process.loadEnvFile(".env"); } catch { /* sem .env: a rota responde 503, sem chave */ }

const pagina = fs.readFileSync(path.join(__dirname, "public", "index.html"));
const paginaFila = fs.readFileSync(path.join(__dirname, "public", "fila.html"));
const paginaPainel = fs.readFileSync(path.join(__dirname, "public", "painel.html"));
const estilo = fs.readFileSync(path.join(__dirname, "public", "estilo.css"));
const porta = Number(process.env.PORT) || 3000;

http.createServer((req, res) => {
  if (req.url === "/api/lancar") return tratar(req, res);
  if (req.url.split("?")[0] === "/api/fila") return tratarFila(req, res);
  if (req.url.split("?")[0] === "/api/exportar") return tratarExportar(req, res);
  if (req.url.split("?")[0] === "/api/painel") return tratarPainel(req, res);
  if (req.method === "GET" && req.url === "/estilo.css") {
    res.writeHead(200, { "content-type": "text/css; charset=utf-8" });
    return res.end(estilo);
  }
  if (req.method === "GET" && req.url === "/fila") {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    return res.end(paginaFila);
  }
  if (req.method === "GET" && req.url === "/painel") {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    return res.end(paginaPainel);
  }
  if (req.method === "GET" && req.url === "/") {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    return res.end(pagina);
  }
  res.writeHead(404, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify({ erro: "nao_encontrado" }));
}).listen(porta, () => console.log(`http://localhost:${porta}`));
