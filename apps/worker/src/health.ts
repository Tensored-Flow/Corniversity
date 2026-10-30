import { createServer, type Server } from "node:http";

export function startHealthServer(port: number, status: () => Record<string, unknown>): Server {
  const server = createServer((req, res) => {
    if (req.url === "/health") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ...status(), at: new Date().toISOString() }));
      return;
    }
    res.writeHead(404);
    res.end();
  });
  server.listen(port, "0.0.0.0", () => {
    console.log(`[worker] health on :${port}/health`);
  });
  return server;
}
