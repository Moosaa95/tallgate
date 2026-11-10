const { createServer } = require("node:http");
const next = require("next");

const port = Number.parseInt(process.env.PORT || "3000", 10);
const hostname = "0.0.0.0";

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("Invalid PORT environment variable.");
}

const app = next({
  dev: false,
  hostname,
  port,
});

const handle = app.getRequestHandler();

app
  .prepare()
  .then(() => {
    const server = createServer((req, res) => handle(req, res));

    server.listen(port, hostname, () => {
      console.log(`TallGate is listening on http://${hostname}:${port}`);
    });

    server.on("error", (error) => {
      console.error("TallGate server failed to start:", error);
      process.exit(1);
    });
  })
  .catch((error) => {
    console.error("Failed to prepare the TallGate application:", error);
    process.exit(1);
  });
