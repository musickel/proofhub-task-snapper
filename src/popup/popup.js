import { isSubtaskItem } from '../shared/url-parser.js';

document.addEventListener('DOMContentLoaded', () => {
  const targetSelect = document.getElementById('targetSelect');
  const targetModeTag = document.getElementById('targetModeTag');
  const captureBtn = document.getElementById('captureBtn');
  const settingsBtn = document.getElementById('settingsBtn');
  const helpBtn = document.getElementById('helpBtn');
  const warning = document.getElementById('warning');

  let storedLists = [];

  function updateModeIndicator() {
    if (storedLists.length === 0) {
      targetModeTag.innerText = 'Not Set';
      return;
    }
    const idx = Number(targetSelect.value) || 0;
    const item = storedLists[idx];
    targetModeTag.innerText = isSubtaskItem(item) ? 'Subtask' : 'Task';
  }

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'sync' && changes.theme) {
      document.documentElement.setAttribute(
        'data-theme',
        changes.theme.newValue === 'dark' ? 'dark' : 'light'
      );
    }
  });

  chrome.storage.sync.get(['customShortcut', 'theme', 'taskLists'], (syncRes) => {
    const theme = syncRes.theme === 'dark' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', theme);

    const label = syncRes.customShortcut ? syncRes.customShortcut.display : 'Ctrl+Shift+E';

    chrome.storage.local.get(['qaCaptureState', 'taskLists', 'selectedTaskListIndex'], (localRes) => {
      storedLists =
        (Array.isArray(localRes.taskLists) && localRes.taskLists.length > 0)
          ? localRes.taskLists
          : (Array.isArray(syncRes.taskLists) ? syncRes.taskLists : []);

      targetSelect.innerHTML = '';
      if (storedLists.length === 0) {
        const emptyOpt = document.createElement('option');
        emptyOpt.value = '';
        emptyOpt.innerText = 'No Task / Task List configured';
        targetSelect.appendChild(emptyOpt);
        targetSelect.disabled = true;
      } else {
        targetSelect.disabled = false;
        storedLists.forEach((item, index) => {
          const opt = document.createElement('option');
          opt.value = String(index);
          const prefix = isSubtaskItem(item) ? '[Subtask]' : '[Task]';
          opt.innerText = `${prefix} ${item.projectName} — ${item.name}`;
          targetSelect.appendChild(opt);
        });

        const savedIdx = Number(localRes.selectedTaskListIndex);
        const validIdx = (!isNaN(savedIdx) && savedIdx >= 0 && savedIdx < storedLists.length) ? savedIdx : 0;
        targetSelect.value = String(validIdx);
      }

      updateModeIndicator();

      const isAwaitingExpected = localRes.qaCaptureState?.step === 'AWAITING_EXPECTED';
      captureBtn.innerText = isAwaitingExpected
        ? `Capture Expected (2/2) (${label})`
        : `Capture Actual (1/2) (${label})`;
      if (isAwaitingExpected) {
        captureBtn.style.background = theme === 'dark' ? '#10b981' : '#029944';
      }
    });
  });

  targetSelect.addEventListener('change', () => {
    const idx = Number(targetSelect.value) || 0;
    chrome.storage.local.set({ selectedTaskListIndex: idx });
    updateModeIndicator();
  });

  captureBtn.addEventListener('click', () => {
    captureBtn.disabled = true;
    captureBtn.innerText = 'Starting...';

    chrome.runtime.sendMessage({ action: 'start_capture_from_popup' }, (response) => {
      if (chrome.runtime.lastError || !response || !response.success) {
        captureBtn.disabled = false;
        captureBtn.innerText = 'Capture Screenshot';
        warning.innerText = response?.error || 'Could not capture this page. Open a regular website and try again.';
        warning.style.display = 'block';
        return;
      }
      window.close();
    });
  });

  settingsBtn.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  helpBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('src/help/help.html') });
  });
});
