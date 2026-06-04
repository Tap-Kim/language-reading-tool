const EXTENSION_KEY = 'rfcExtensionEnabled';
const FLOATING_KEY = 'rfcFloatingButtonEnabled';

async function withActiveTab(callback) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) await callback(tab.id);
}

async function notifyActiveTab() {
  await withActiveTab(async (tabId) => {
    try {
      await chrome.tabs.sendMessage(tabId, { type: 'RFC_SETTINGS_UPDATED' });
    } catch {}
  });
}

function syncControls() {
  const extensionEnabled = document.getElementById('extensionEnabled').checked;
  document.getElementById('floatingButtonEnabled').disabled = !extensionEnabled;
  document.getElementById('enterInspectMode').disabled = !extensionEnabled;
  document.getElementById('toggleSidebar').disabled = !extensionEnabled;
}

async function loadSettings() {
  const data = await chrome.storage.local.get([EXTENSION_KEY, FLOATING_KEY]);
  document.getElementById('extensionEnabled').checked = data[EXTENSION_KEY] !== false;
  document.getElementById('floatingButtonEnabled').checked = data[FLOATING_KEY] !== false;
  syncControls();
}

async function saveSettings() {
  const extensionEnabled = document.getElementById('extensionEnabled').checked;
  const floatingButtonEnabled = extensionEnabled && document.getElementById('floatingButtonEnabled').checked;
  await chrome.storage.local.set({
    [EXTENSION_KEY]: extensionEnabled,
    [FLOATING_KEY]: floatingButtonEnabled
  });
  syncControls();
  await notifyActiveTab();
}

document.getElementById('extensionEnabled').addEventListener('change', async (event) => {
  if (!event.target.checked) {
    document.getElementById('floatingButtonEnabled').checked = false;
  } else {
    document.getElementById('floatingButtonEnabled').checked = true;
  }
  await saveSettings();
});

document.getElementById('floatingButtonEnabled').addEventListener('change', saveSettings);

document.getElementById('enterInspectMode').addEventListener('click', async () => {
  await withActiveTab((tabId) => chrome.tabs.sendMessage(tabId, { type: 'RFC_ENTER_INSPECT_MODE' }));
  window.close();
});

document.getElementById('toggleSidebar').addEventListener('click', async () => {
  await withActiveTab((tabId) => chrome.tabs.sendMessage(tabId, { type: 'RFC_TOGGLE_SIDEBAR' }));
  window.close();
});

document.getElementById('openOptions').addEventListener('click', () => chrome.runtime.openOptionsPage());

loadSettings();
