async function withActiveTab(callback) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) callback(tab.id);
}

document.getElementById('toggleSidebar').addEventListener('click', async () => {
  await withActiveTab((tabId) => chrome.tabs.sendMessage(tabId, { type: 'RFC_TOGGLE_SIDEBAR' }));
  window.close();
});

document.getElementById('openOptions').addEventListener('click', () => chrome.runtime.openOptionsPage());
