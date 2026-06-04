const EXTENSION_KEY = 'rfcExtensionEnabled';
const FLOATING_KEY = 'rfcFloatingButtonEnabled';
const AUTO_KEY = 'rfcAutoOpenSidebar';
const REDUCE_KEY = 'rfcReduceMotion';

function syncControls() {
  const extensionEnabled = document.getElementById('extensionEnabled').checked;
  document.getElementById('floatingButtonEnabled').disabled = !extensionEnabled;
}

async function load() {
  const data = await chrome.storage.local.get([EXTENSION_KEY, FLOATING_KEY, AUTO_KEY, REDUCE_KEY]);
  document.getElementById('extensionEnabled').checked = data[EXTENSION_KEY] !== false;
  document.getElementById('floatingButtonEnabled').checked = data[FLOATING_KEY] !== false;
  document.getElementById('autoOpenSidebar').checked = Boolean(data[AUTO_KEY]);
  document.getElementById('reduceMotion').checked = Boolean(data[REDUCE_KEY]);
  syncControls();
}

document.getElementById('extensionEnabled').addEventListener('change', (event) => {
  if (!event.target.checked) {
    document.getElementById('floatingButtonEnabled').checked = false;
  } else {
    document.getElementById('floatingButtonEnabled').checked = true;
  }
  syncControls();
});

document.getElementById('saveBtn').addEventListener('click', async () => {
  const extensionEnabled = document.getElementById('extensionEnabled').checked;
  const floatingButtonEnabled = extensionEnabled && document.getElementById('floatingButtonEnabled').checked;
  await chrome.storage.local.set({
    [EXTENSION_KEY]: extensionEnabled,
    [FLOATING_KEY]: floatingButtonEnabled,
    [AUTO_KEY]: document.getElementById('autoOpenSidebar').checked,
    [REDUCE_KEY]: document.getElementById('reduceMotion').checked
  });
  document.getElementById('status').textContent = '저장되었습니다.';
  setTimeout(() => document.getElementById('status').textContent = '', 1500);
});

load();
