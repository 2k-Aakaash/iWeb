// iWeb extension service worker.
//
// After an in-app update the extension reloads itself (src/libs/updater/updater.js). Chrome
// unloads the extension for that, so the tab that showed iWeb falls back to Chrome's default
// new tab page. Before reloading, the updater stores that tab's id under REOPEN_KEY; this
// worker starts with the new version and loads iWeb back into the same tab.

const REOPEN_KEY = 'iweb:reopenAfterUpdate'; // keep in sync with updater.js
const REOPEN_WINDOW_MS = 2 * 60 * 1000;

async function reopenAfterUpdate() {
  const { [REOPEN_KEY]: pending } = await chrome.storage.local.get(REOPEN_KEY);
  if (!pending) return;
  await chrome.storage.local.remove(REOPEN_KEY);
  if (Date.now() - (pending.at || 0) > REOPEN_WINDOW_MS) return;

  const url = chrome.runtime.getURL('index.html');
  if (Number.isInteger(pending.tabId)) {
    try {
      await chrome.tabs.update(pending.tabId, { url, active: true });
      return;
    } catch {
      // The tab was closed meanwhile: open a new one.
    }
  }
  await chrome.tabs.create({ url });
}

// The reload starts a fresh worker, which runs this.
reopenAfterUpdate().catch(() => {});
