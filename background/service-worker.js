chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'save-to-reading-flow-memo',
    title: 'Save to Reading Flow Coach memo',
    contexts: ['selection']
  });
});

async function translateText(text) {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=ko&dt=t&q=${encodeURIComponent(text)}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Translation failed: ${response.status}`);
  const data = await response.json();
  return (data?.[0] || []).map(part => part?.[0] || '').join(' ').trim();
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== 'save-to-reading-flow-memo' || !tab?.id) return;
  await chrome.tabs.sendMessage(tab.id, {
    type: 'RFC_CONTEXT_SAVE_SELECTION',
    payload: { text: info.selectionText || '' }
  });
});

chrome.commands.onCommand.addListener(async (command) => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;

  if (command === 'toggle-sidebar') {
    chrome.tabs.sendMessage(tab.id, { type: 'RFC_TOGGLE_SIDEBAR' });
  }
  if (command === 'save-selection') {
    chrome.tabs.sendMessage(tab.id, { type: 'RFC_SAVE_CURRENT_SELECTION' });
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== 'RFC_TRANSLATE_TEXT') return;
  translateText(message.payload?.text || '')
    .then(translation => sendResponse({ ok: true, translation }))
    .catch(error => sendResponse({ ok: false, error: error.message }));
  return true;
});
