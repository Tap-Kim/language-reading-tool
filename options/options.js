const AUTO_KEY = 'rfcAutoOpenSidebar';
const REDUCE_KEY = 'rfcReduceMotion';

async function load() {
  const data = await chrome.storage.local.get([AUTO_KEY, REDUCE_KEY]);
  document.getElementById('autoOpenSidebar').checked = Boolean(data[AUTO_KEY]);
  document.getElementById('reduceMotion').checked = Boolean(data[REDUCE_KEY]);
}

document.getElementById('saveBtn').addEventListener('click', async () => {
  await chrome.storage.local.set({
    [AUTO_KEY]: document.getElementById('autoOpenSidebar').checked,
    [REDUCE_KEY]: document.getElementById('reduceMotion').checked
  });
  document.getElementById('status').textContent = '저장되었습니다.';
  setTimeout(() => document.getElementById('status').textContent = '', 1500);
});

load();
