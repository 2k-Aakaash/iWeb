// background.js

chrome.runtime.onInstalled.addListener(() => {
  chrome.browserAction.onClicked.addListener(() => {
    chrome.tabs.create({ url: chrome.runtime.getURL('index.html') });
  });
});
