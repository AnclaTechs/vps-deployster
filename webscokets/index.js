const WebSocket = require("ws");
const pty = require("node-pty");
const { verifyToken, findUserByDecodedToken } = require("../middlewares");

function setupTerminalWSS(server) {
  let protocol;
  let sslConnection;
  let url;
  const wss = new WebSocket.Server({ noServer: true });

  server.on("upgrade", async (req, socket, head) => {
    try {
      sslConnection = req.socket.encrypted;
      protocol = sslConnection ? "https" : "http";
      url = new URL(req.url, `${protocol}://${req.headers.host}`);
      const token = url.searchParams.get("token");

      const decoded = await verifyToken(token);
      const user = await findUserByDecodedToken(decoded);
      req.user = user;
    } catch (err) {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
    }
    // PROCEED
    if (url.pathname === "/ws/terminal") {
      const username = url.searchParams.get("username");

      // REJECT ROOT / INVALID DATA
      if (!username || username === "root") {
        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
        socket.destroy();
        return;
      }

      req.username = username;

      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit("connection", ws, req);
      });
    } else {
      socket.destroy();
    }
  });

  wss.on("connection", (ws, req) => {
    // const ptyProcess = pty.spawn("bash", [], {
    //   name: "xterm-color",
    //   cols: 80,
    //   rows: 30,
    //   cwd: process.env.HOME,
    //   env: process.env,
    // });
    const username = req.username;
    const ptyProcess = pty.spawn("sudo", ["-u", username, "bash"], {
      name: "xterm-color",
      cols: 80,
      rows: 30,
      cwd: `/home/${username}`,
      env: { ...process.env, HOME: `/home/${username}` },
    });

    ptyProcess.onData((data) => {
      ws.send(data);
    });

    ws.on("message", (msg) => {
      try {
        const parsed = JSON.parse(msg);
        if (parsed.resize) {
          ptyProcess.resize(parsed.cols, parsed.rows);
        } else {
          ptyProcess.write(msg);
        }
      } catch {
        ptyProcess.write(msg);
      }
    });

    ws.on("close", () => {
      ptyProcess.kill();
    });
  });
}

module.exports = setupTerminalWSS;
