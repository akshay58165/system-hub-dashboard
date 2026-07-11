// Preload runs with node access before the page loads. The web app doesn't
// need any Node bridges yet, so we only expose a version stamp for future
// diagnostics without opening the door to arbitrary main-process calls.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('unicornDesk', {
  isElectron: true,
  platform: process.platform,
  ping: () => ipcRenderer.invoke('unicorn-desk:ping'),
});
