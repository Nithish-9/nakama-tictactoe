import { Client } from "@heroiclabs/nakama-js";

const NAKAMA_HOST = import.meta.env.VITE_NAKAMA_HOST || "127.0.0.1";
const NAKAMA_PORT = import.meta.env.VITE_NAKAMA_PORT || "7350";
const NAKAMA_KEY  = import.meta.env.VITE_NAKAMA_KEY  || "defaultkey";
const USE_SSL     = import.meta.env.VITE_NAKAMA_SSL  === "true";

export const client = new Client(NAKAMA_KEY, NAKAMA_HOST, NAKAMA_PORT, USE_SSL);

const SESSION_KEY = "nakama_session";

export function saveSession(session) {
  localStorage.setItem(SESSION_KEY, JSON.stringify({
    token:        session.token,
    refresh_token: session.refresh_token,
    created_at:   Date.now(),
  }));
}

export function loadSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}


export async function authenticateDevice(deviceId, username) {
  try {
    const session = await client.authenticateDevice(deviceId, true, username);
    saveSession(session);
    return session;
  } catch (err) {
    const isAlreadyExists =
      err?.code === 6 ||
      (err?.message ?? "").toLowerCase().includes("already in use") ||
      (err?.message ?? "").toLowerCase().includes("already exists");

    if (!isAlreadyExists) throw err;

    const session = await client.authenticateDevice(deviceId, false);
    saveSession(session);
    try {
      await client.updateAccount(session, {
        username:     username,
        display_name: username,
      });
    } catch {
      // Non-critical — keep existing account name if update fails
    }

    return session;
  }
}

export async function restoreSession() {
  const saved = loadSession();
  if (!saved) return null;
  try {
    const session = await client.sessionRefresh(saved.refresh_token);
    saveSession(session);
    return session;
  } catch {
    clearSession();
    return null;
  }
}

let _socket = null;

export async function connectSocket(session) {
  if (_socket) return _socket;
  _socket = client.createSocket(USE_SSL, false);
  await _socket.connect(session, true);
  return _socket;
}

export function getSocket() {
  return _socket;
}

export async function disconnectSocket() {
  if (_socket) {
    _socket.disconnect(true);
    _socket = null;
  }
}

export async function getAccount(session) {
  return await client.getAccount(session);
}

export async function updateAccount(session, { username, displayName, avatarUrl }) {
  return await client.updateAccount(session, { username, display_name: displayName, avatar_url: avatarUrl });
}

export async function findMatch(socket, mode = "classic") {
  const ticket = await socket.addMatchmaker("*", 2, 2, { mode: { string_value: mode } });
  return ticket;
}

export async function cancelMatchmaking(socket, ticket) {
  await socket.removeMatchmaker(ticket.ticket);
}

export async function createMatch(socket) {
  return await socket.createMatch();
}

export async function joinMatch(socket, matchId) {
  return await socket.joinMatch(matchId);
}

export async function leaveMatch(socket, matchId) {
  await socket.leaveMatch(matchId);
}

export async function getLeaderboard(session, limit = 10) {
  return await client.listLeaderboardRecords(session, "tictactoe_wins", [], limit);
}

export async function writeLeaderboardScore(session, score) {
  return await client.writeLeaderboardRecord(session, "tictactoe_wins", score);
}

export async function rpcCall(session, id, payload = {}) {
  return await client.rpc(session, id, payload);
}

export const OpCode = {
  MOVE:        1,
  GAME_STATE:  2,
  GAME_OVER:   3,
  PLAYER_READY: 4,
  TIMER_TICK:  5,
};