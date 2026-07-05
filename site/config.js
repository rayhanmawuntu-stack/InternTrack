/*
  InternTrack cloud-only runtime configuration.
  Google Sheets is the sole persistent data store; the app will not open until
  this Apps Script endpoint is configured and reachable.
*/
window.INTERNTRACK_CONFIG = {
  syncEnabled: true,
  apiUrl: "https://script.google.com/macros/s/AKfycbxiaYVOslliEKT5hAMwDnaUZSfVT2EUXpMI507Dz0fveMV0nmwQTooGr1t9ulRPqgXi/exec",
  workspaceId: "interntrack-main",
  requestTimeoutMs: 12000
};
