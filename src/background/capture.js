const CONTENT_CSS_FILES = [
  'src/content/styles/theme.css',
  'src/content/styles/overlay.css',
  'src/content/styles/modal.css'
];

const CONTENT_JS_FILES = [
  'src/content/state.js',
  'src/content/canvas-tools.js',
  'src/content/toolbar.js',
  'src/content/banner.js',
  'src/content/modal-fields.js',
  'src/content/modal.js',
  'src/content/index.js'
];

export function handleShortcutOrCapture(done = () => {}) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs && tabs[0];
    if (!tab || !tab.id) {
      done({ success: false, error: 'No active browser tab found.' });
      return;
    }

    chrome.tabs.sendMessage(tab.id, { action: 'shortcut_skip_if_open' }, (resp) => {
      if (!chrome.runtime.lastError && resp && resp.skipped) {
        done({ success: true, skipped: true });
        return;
      }
      triggerCaptureOnActiveTab(done);
    });
  });
}

export function triggerCaptureOnActiveTab(done = () => {}) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs && tabs[0];
    if (!tab || !tab.id) {
      done({ success: false, error: 'No active browser tab found.' });
      return;
    }

    const url = tab.url || '';
    if (
      url.startsWith('chrome://') ||
      url.startsWith('edge://') ||
      url.startsWith('chrome-extension://') ||
      url.startsWith('https://chromewebstore.google.com')
    ) {
      done({ success: false, error: 'Cannot capture internal browser pages. Open a normal website first.' });
      return;
    }

    chrome.tabs.captureVisibleTab(null, { format: 'png' }, (dataUrl) => {
      if (chrome.runtime.lastError || !dataUrl) {
        done({
          success: false,
          error: chrome.runtime.lastError?.message || 'Failed to capture screen.'
        });
        return;
      }

      chrome.tabs.sendMessage(tab.id, { action: 'initiate_capture', image: dataUrl }, (resp) => {
        if (chrome.runtime.lastError || !resp) {
          chrome.scripting.insertCSS({ target: { tabId: tab.id }, files: CONTENT_CSS_FILES }, () => {
            chrome.scripting.executeScript({ target: { tabId: tab.id }, files: CONTENT_JS_FILES }, () => {
              if (chrome.runtime.lastError) {
                done({ success: false, error: 'Cannot run on this page. Refresh the tab and try again.' });
                return;
              }
              chrome.tabs.sendMessage(tab.id, { action: 'initiate_capture', image: dataUrl }, () => {
                done({ success: true });
              });
            });
          });
        } else {
          done({ success: true });
        }
      });
    });
  });
}
