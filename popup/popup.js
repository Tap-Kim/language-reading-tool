async function withActiveTab(callback) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) callback(tab.id);
}

document.getElementById('enterInspectMode').addEventListener('click', async () => {
  await withActiveTab((tabId) => chrome.tabs.sendMessage(tabId, { type: 'RFC_ENTER_INSPECT_MODE' }));
  window.close();
});

document.getElementById('toggleSidebar').addEventListener('click', async () => {
  await withActiveTab((tabId) => chrome.tabs.sendMessage(tabId, { type: 'RFC_TOGGLE_SIDEBAR' }));
  window.close();
});

document.getElementById('openOptions').addEventListener('click', () => chrome.runtime.openOptionsPage());
