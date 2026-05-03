/**
 * AZHA Realtime Service — Socket.IO event broadcasting.
 * All realtime events pass through this module.
 */
let io = null;

function init(socketIoServer) {
  io = socketIoServer;
}

function emit(event, data) {
  if (io) {
    io.emit(event, { ...data, timestamp: new Date().toISOString() });
  }
}

module.exports = {
  init,
  emit,
  events: {
    SCAN_NEW: "scan:new",
    PERMIT_REVOKED: "permit:revoked",
    WATCHLIST_NEW: "watchlist:new",
    WATCHLIST_RESOLVED: "watchlist:resolved",
    PRESENCE_UPDATE: "presence:update",
    GUARD_ONLINE: "guard:online",
    GUARD_OFFLINE: "guard:offline",
    EMERGENCY_ON: "emergency:on",
    EMERGENCY_OFF: "emergency:off",
    ALERT_NEW: "alert:new"
  }
};
