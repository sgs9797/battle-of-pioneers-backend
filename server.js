
import { WebSocketServer } from 'ws';
import { v4 as uuid } from 'uuid';

const PORT = process.env.PORT || 8080;
const wss = new WebSocketServer({ port: PORT });

const users = new Map(); // ws -> {id, name, status}
const queue = [];
const rooms = new Map(); // roomId -> {players:[ws,ws], turn, timer}

const TURN_TIME = 20;

function broadcastLobby() {
  const list = [...users.values()].map(u => ({ id: u.id, name: u.name, status: u.status }));
  for (const ws of users.keys()) {
    ws.send(JSON.stringify({ type: 'LOBBY', list }));
  }
}

function startTimer(roomId) {
  const room = rooms.get(roomId);
  if (!room) return;
  clearInterval(room.timer);
  let t = TURN_TIME;
  room.timer = setInterval(() => {
    t--;
    for (const p of room.players) {
      p.send(JSON.stringify({ type: 'TIMER', t }));
    }
    if (t <= 0) {
      clearInterval(room.timer);
      room.turn = room.turn === 0 ? 1 : 0;
      for (const p of room.players) {
        p.send(JSON.stringify({ type: 'TIMEOUT', nextTurn: room.turn }));
      }
      startTimer(roomId);
    }
  }, 1000);
}

function startMatch(a, b) {
  const roomId = uuid();
  rooms.set(roomId, { players: [a, b], turn: 0, timer: null });
  a.send(JSON.stringify({ type: 'MATCH_START', roomId, you: 0 }));
  b.send(JSON.stringify({ type: 'MATCH_START', roomId, you: 1 }));
  startTimer(roomId);
}

wss.on('connection', (ws) => {
  const id = uuid();
  users.set(ws, { id, name: 'Player', status: 'Ready' });

  ws.on('message', (buf) => {
    const msg = JSON.parse(buf.toString());
    if (msg.type === 'HELLO') {
      users.get(ws).name = msg.name || 'Player';
      broadcastLobby();
    }
    if (msg.type === 'QUEUE') {
      if (!queue.includes(ws)) queue.push(ws);
      if (queue.length >= 2) {
        const a = queue.shift();
        const b = queue.shift();
        startMatch(a, b);
      }
    }
    if (msg.type === 'INVITE') {
      for (const [sock, u] of users.entries()) {
        if (u.id === msg.to) {
          sock.send(JSON.stringify({ type: 'INVITED', from: users.get(ws).id, name: users.get(ws).name }));
        }
      }
    }
    if (msg.type === 'ACCEPT') {
      const from = msg.from;
      let inviter;
      for (const [sock, u] of users.entries()) if (u.id === from) inviter = sock;
      if (inviter) startMatch(inviter, ws);
    }
    if (msg.type === 'MOVE') {
      const room = rooms.get(msg.roomId);
      if (!room) return;
      const turnSock = room.players[room.turn];
      if (turnSock !== ws) return;
      room.turn = room.turn === 0 ? 1 : 0;
      for (const p of room.players) {
        p.send(JSON.stringify({ type: 'MOVE', x: msg.x, y: msg.y, nextTurn: room.turn }));
      }
      startTimer(msg.roomId);
    }
  });

  ws.on('close', () => {
    users.delete(ws);
    broadcastLobby();
  });

  broadcastLobby();
});

console.log('Backend running on', PORT);
