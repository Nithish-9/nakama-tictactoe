import { Client, Session } from "@heroiclabs/nakama-js";

const NAKAMA_HOST = import.meta.env.VITE_NAKAMA_HOST || "127.0.0.1";
const NAKAMA_PORT = import.meta.env.VITE_NAKAMA_PORT || "7350";
const NAKAMA_KEY = import.meta.env.VITE_NAKAMA_KEY || "defaultkey";
const USE_SSL = import.meta.env.VITE_NAKAMA_SSL === "true";

export const client = new Client(NAKAMA_KEY, NAKAMA_HOST, NAKAMA_PORT, USE_SSL);

const SESSION_KEY = "nakama_session";

export function saveSession(session) {
  localStorage.setItem(SESSION_KEY, JSON.stringify({
    token: session.token,
    refresh_token: session.refresh_token,
    created_at: Date.now(),
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
  let session;

  try {
    session = await client.authenticateDevice(deviceId, true, username);
  } catch (err) {
    const isAlreadyExists =
      err?.code === 6 ||
      (err?.message ?? "").toLowerCase().includes("already in use") ||
      (err?.message ?? "").toLowerCase().includes("already exists");

    if (!isAlreadyExists) throw err;

    session = await client.authenticateDevice(deviceId, false);

    try {
      await client.updateAccount(session, {
        username: username,
        display_name: username,
      });
    } catch {  }
  }

  saveSession(session);

  try {
    await client.rpc(session, "add_user_to_leaderboard", {});
  } catch (err) {
    console.warn("Leaderboard init failed:", err);
  }

  return session;
}

export async function restoreSession() {
  const saved = loadSession();
  if (!saved) return null;
  try {
    const restored = Session.restore(saved.token, saved.refresh_token);
    const newSession = await client.sessionRefresh(restored);
    saveSession(newSession);
    return newSession;
  } catch {
    clearSession();
    return null;
  }
}

let _socket = null;

export async function connectSocket(session) {
  if (_socket) return _socket;
  _socket = client.createSocket(USE_SSL, true);
  await _socket.connect(session, true);
  _socket.onmatchdata = (d) => console.log("MATCH DATA:", d);
  _socket.onmatchpresence = (d) => console.log("PRESENCE:", d);
  _socket.ondisconnect = (d) => console.log("DISCONNECTED:", d);
  _socket.onerror = (d) => console.error("SOCKET ERROR:", d);
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

export function saveMatchSession(matchId, mySymbol, oppSymbol) {
  sessionStorage.setItem("active_match", JSON.stringify({ matchId, mySymbol, oppSymbol }));
}

export function loadMatchSession() {
  try {
    const raw = sessionStorage.getItem("active_match");
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function clearMatchSession() {
  sessionStorage.removeItem("active_match");
}

export async function getAccount(session) {
  return await client.getAccount(session);
}

export async function updateAccount(session, { username, displayName, avatarUrl }) {
  return await client.updateAccount(session, {
    username: username,
    display_name: displayName,
    avatar_url: avatarUrl,
  });
}

export async function findMatch(socket, mode = "classic") {
  const ticket = await socket.addMatchmaker("*", 2, 2, { mode });
  return ticket;
}

export async function cancelMatchmaking(socket, ticket) {
  await socket.removeMatchmaker(ticket.ticket);
}

export async function createMatch(session, mode = "classic") {
  const result = await client.rpc(session, "create_match", { mode });
  return result.payload;
}

export async function joinMatch(socket, matchId, token) {
  const result = await socket.joinMatch(matchId, token);
  return result
}

export async function leaveMatch(socket, matchId) {
  await socket.leaveMatch(matchId);
}

export async function getLeaderboard(session, limit = 10) {
  return await client.listLeaderboardRecords(session, "tic_tac_toe_global", [], limit);
}

export async function writeLeaderboardScore(session, score) {
  return await client.writeLeaderboardRecord(session, "tic_tac_toe_global", score);
}

export async function getPlayerStats(session) {
  try {
    const result = await client.readStorageObjects(session, {
      object_ids: [{
        collection: "player_stats",
        key: "stats",
        user_id: session.user_id,
      }],
    });
    const obj = result.objects?.[0];
    return obj ? JSON.parse(obj.value) : { wins: 0, losses: 0, streak: 0 };
  } catch {
    return { wins: 0, losses: 0, streak: 0 };
  }
}

export const OpCode = {
  MOVE: 1,
  GAME_STATE: 2,
  GAME_OVER: 3,
  PLAYER_READY: 4,
  TIMER_TICK: 5,
  OPPONENT_LEFT: 6,
};