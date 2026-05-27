chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'save-to-reading-flow-memo',
    title: 'Save to Reading Flow Coach memo',
    contexts: ['selection']
  });
});

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
