import { io } from "socket.io-client";

// Where to find the Node/Socket.IO server.
// Priority:
//   1. REACT_APP_SERVER_URL (set at build time) — required when the
//      client and server live on different Railway / Fly / Vercel
//      subdomains.
//   2. In production without the env var, use a relative path (nginx
//      proxy / reverse-proxy topology).
//   3. In development, point at `http://<same-host>:5000` so phones on
//      the same LAN can hit the dev server at `http://192.168.1.x:5000`.
const getSocketUrl = () => {
  if (process.env.REACT_APP_SERVER_URL) {
    return process.env.REACT_APP_SERVER_URL;
  }
  if (process.env.NODE_ENV === 'production') {
    return undefined;
  }
  const hostname = window.location.hostname;
  return `http://${hostname}:5000`;
};

const socket = io(getSocketUrl());

export default socket;