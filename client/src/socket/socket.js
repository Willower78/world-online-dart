import { io } from "socket.io-client";

// In development, we need to point to the backend port (5000).
// If we are on localhost, point to localhost:5000.
// If we are on a network IP (e.g., 192.168.1.215), point to that IP:5000.
const getSocketUrl = () => {
  if (process.env.NODE_ENV === 'production') {
    return undefined; // Relative path for production (nginx proxy)
  }
  
  const hostname = window.location.hostname;
  return `http://${hostname}:5000`;
};

const socket = io(getSocketUrl());

export default socket;