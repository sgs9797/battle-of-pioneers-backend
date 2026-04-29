import http from "http";

const PORT = process.env.PORT || 10000;

let queue = [];
let matches = {};

const server = http.createServer(async (req, res) => {
  if (req.method === "POST" && req.url === "/api/matchmaking") {
    let body = "";

    req.on("data", chunk => {
      body += chunk;
    });

    req.on("end", () => {
      const data = JSON.parse(body);
      const { action, username, gameBoard } = data;

      if (action === "findMatch") {
        queue.push({ username, gameBoard });

        if (queue.length >= 2) {
          const p1 = queue.shift();
          const p2 = queue.shift();

          const gameId = Date.now().toString();

          matches[gameId] = {
            players: [p1, p2],
            turn: 0
          };

          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({
            matched: true,
            gameId,
            opponent: p2.username,
            yourTurn: true
          }));
        } else {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ matched: false }));
        }
      }

      else if (action === "cancelMatch") {
        queue = queue.filter(p => p.username !== username);

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ cancelled: true }));
      }
    });
  }

  else {
    res.writeHead(200);
    res.end("Backend running");
  }
});

server.listen(PORT, () => {
  console.log("Server running on", PORT);
});
