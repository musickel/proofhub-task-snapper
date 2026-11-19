import { RESERVED_SHORTCUTS } from '../shared/constants.js';
import { ensureMetadataAndAssignees, renderTaskLists } from './fields-ui.js';

document.addEventListener('DOMContentLoaded', () => {
  const darkModeToggle = document.getElementById('darkModeToggle');
  const themeStatusLabel = document.getElementById('themeStatusLabel');
  const shortcutInput = document.getElementById('shortcutInput');
  const shortcutError = document.getElementById('shortcutError');
  const resetShortcutBtn = document.getElementById('resetShortcutBtn');
  const addTaskListBtn = document.getElementById('addTaskListBtn');
  const saveBtn = document.getElementById('saveBtn');
  const taskListStatus = document.getElementById('taskListStatus');
  const saveStatus = document.getElementById('saveStatus');
  const taskListsContainer = document.getElementById('taskListsContainer');

  let taskLists = [];
  let currentShortcut = null;
  let currentTheme = 'light';
  let hasShortcutError = false;
  let pressedKeys = new Set();
  let recordedCombo = null;

  function applyTheme(theme) {
    currentTheme = theme === 'dark' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', currentTheme);
    if (darkModeToggle) darkModeToggle.checked = currentTheme === 'dark';
    if (themeStatusLabel) {
      themeStatusLabel.innerText = currentTheme === 'dark' ? 'Dark Theme' : 'Light Theme';
    }
  }

  darkModeToggle.addEventListener('change', () => {
    const nextTheme = darkModeToggle.checked ? 'dark' : 'light';
    applyTheme(nextTheme);
    chrome.storage.sync.set({ theme: nextTheme });
  });

  function showStatus(el, message, type) {
    if (!el) return;
    el.innerText = message;
    el.className = `status-msg ${type}`;
  }

  function clearStatus(el) {
    if (!el) return;
    el.innerText = '';
    el.className = 'status-msg';
  }

  function saveTaskListsToStorage(callback) {
    chrome.storage.local.set({ taskLists }, () => {
      if (chrome.runtime.lastError) {
        showStatus(taskListStatus, `Failed to save: ${chrome.runtime.lastError.message}`, 'error');
        return;
      }
      if (typeof callback === 'function') callback();
    });
  }

  function normalizeKey(e) {
    if (e.key === 'Control') return 'Ctrl';
    if (e.key === 'Alt') return 'Alt';
    if (e.key === 'Shift') return 'Shift';
    if (e.key === 'Meta') return 'Cmd';
    if (e.key === ' ') return 'Space';
    if (e.key.length === 1) return e.key.toUpperCase();
    return e.key;
  }

  function formatCombo(keysSet) {
    const modifierOrder = ['Ctrl', 'Cmd', 'Alt', 'Shift'];
    const mods = modifierOrder.filter((m) => keysSet.has(m));
    const regulars = Array.from(keysSet).filter((k) => !modifierOrder.includes(k));
    return { modifiers: mods, keys: regulars, display: [...mods, ...regulars].join('+') };
  }

  function showShortcutError(message) {
    hasShortcutError = true;
    shortcutInput.classList.add('invalid');
    shortcutError.innerText = message;
    shortcutError.style.display = 'block';
  }

  function clearShortcutError() {
    hasShortcutError = false;
    shortcutInput.classList.remove('invalid');
    shortcutError.innerText = '';
    shortcutError.style.display = 'none';
  }

  async function validateShortcut(combo) {
    const hasPrimaryModifier = combo.modifiers.some((m) => ['Ctrl', 'Alt', 'Cmd'].includes(m));
    const hasRegularKey = combo.keys.length > 0;

    if (!hasPrimaryModifier || !hasRegularKey) {
      showShortcutError('Shortcut must include Ctrl, Alt, or Cmd plus at least one letter/number key.');
      return false;
    }

    const normalizedDisplay = combo.display.replace('Cmd+', 'Ctrl+');
    if (RESERVED_SHORTCUTS[combo.display] || RESERVED_SHORTCUTS[normalizedDisplay]) {
      const conflictName = RESERVED_SHORTCUTS[combo.display] || RESERVED_SHORTCUTS[normalizedDisplay];
      showShortcutError(`"${combo.display}" overlaps with the browser's "${conflictName}" shortcut.`);
      return false;
    }

    if (chrome.commands && chrome.commands.getAll) {
      const commands = await chrome.commands.getAll();
      const conflictCmd = commands.find((cmd) => {
        if (!cmd.shortcut || cmd.name === 'take_screenshot') return false;
        return cmd.shortcut.replace(/\s+/g, '').toLowerCase() === combo.display.toLowerCase();
      });

      if (conflictCmd) {
        showShortcutError(`"${combo.display}" overlaps with "${conflictCmd.description || conflictCmd.name}".`);
        return false;
      }
    }

    clearShortcutError();
    currentShortcut = combo;
    return true;
  }

  shortcutInput.addEventListener('focus', () => {
    pressedKeys.clear();
    recordedCombo = null;
    shortcutInput.value = 'Press your key combination...';
    clearShortcutError();
  });

  shortcutInput.addEventListener('blur', () => {
    pressedKeys.clear();
    if (!recordedCombo) {
      shortcutInput.value = currentShortcut ? currentShortcut.display : 'Ctrl+Shift+E (Default)';
    }
  });

  shortcutInput.addEventListener('keydown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    pressedKeys.add(normalizeKey(e));
    recordedCombo = formatCombo(pressedKeys);
    shortcutInput.value = recordedCombo.display;
  });

  shortcutInput.addEventListener('keyup', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    pressedKeys.delete(normalizeKey(e));
    if (pressedKeys.size === 0 && recordedCombo) await validateShortcut(recordedCombo);
  });

  resetShortcutBtn.addEventListener('click', () => {
    currentShortcut = null;
    recordedCombo = null;
    clearShortcutError();
    shortcutInput.value = 'Ctrl+Shift+E (Default)';
  });

  function fetchFieldsForUrl(url, apiKey) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: 'fetch_tasklist_fields', url, apiKey }, (response) => {
        if (chrome.runtime.lastError) {
          resolve({ success: false, error: chrome.runtime.lastError.message });
          return;
        }
        resolve(response || { success: false, error: 'Failed to fetch fields.' });
      });
    });
  }

  async function syncSingleTaskListFields(list, apiKey) {
    const res = await fetchFieldsForUrl(list.url, apiKey);
    if (res.success && Array.isArray(res.fields)) {
      const prevFieldMap = new Map((list.fields || []).map((f) => [f.key, f]));
      list.isSubtask = Boolean(res.isSubtask);
      list.fields = res.fields.map((f) => {
        const prev = prevFieldMap.get(f.key);
        return {
          ...f,
          enabled: prev ? Boolean(prev.enabled) : false,
          defaultValue: prev && prev.defaultValue !== undefined ? prev.defaultValue : f.defaultValue
        };
      });
      return { success: true };
    }
    return { success: false, error: res.error };
  }

  function redrawLists() {
    renderTaskLists({
      container: taskListsContainer,
      taskLists,
      onRefreshList: async (list, refreshBtn) => {
        refreshBtn.disabled = true;
        refreshBtn.innerText = 'Syncing...';
        const apiKey = document.getElementById('apiKey').value.trim();
        const res = await syncSingleTaskListFields(list, apiKey);

        if (res.success) {
          saveTaskListsToStorage(() => {
            redrawLists();
            showStatus(taskListStatus, `Synced ${list.fields.length} fields for "${list.name}".`, 'success');
          });
        } else {
          refreshBtn.disabled = false;
          refreshBtn.innerText = 'Refresh Fields';
          showStatus(taskListStatus, res.error || 'Could not sync fields.', 'error');
        }
      },
      onRemoveList: (listIndex) => {
        taskLists.splice(listIndex, 1);
        redrawLists();
        saveTaskListsToStorage(() => {
          chrome.storage.local.get(['selectedTaskListIndex'], (selRes) => {
            const cur = Number(selRes.selectedTaskListIndex || 0);
            if (cur >= taskLists.length) chrome.storage.local.set({ selectedTaskListIndex: 0 });
          });
          showStatus(taskListStatus, 'Removed successfully.', 'success');
        });
      },
      onPersist: (statusMessage) => {
        saveTaskListsToStorage(() => {
          if (statusMessage) showStatus(taskListStatus, statusMessage, 'success');
        });
      }
    });
  }

  addTaskListBtn.addEventListener('click', async () => {
    const projectInput = document.getElementById('newProjectName');
    const nameInput = document.getElementById('newListName');
    const urlInput = document.getElementById('newListUrl');
    const apiKey = document.getElementById('apiKey').value.trim();

    const projectName = projectInput.value.trim();
    const name = nameInput.value.trim();
    const url = urlInput.value.trim();

    if (!projectName || !name || !url) {
      showStatus(taskListStatus, 'Please fill in Project Name, Task / Task List Name, and ProofHub URL.', 'error');
      return;
    }

    if (!apiKey) {
      showStatus(taskListStatus, 'Please enter your ProofHub API Key above first.', 'error');
      document.getElementById('apiKey').focus();
      return;
    }

    addTaskListBtn.disabled = true;
    addTaskListBtn.innerText = 'Fetching Fields...';
    clearStatus(taskListStatus);

    const res = await fetchFieldsForUrl(url, apiKey);

    addTaskListBtn.disabled = false;
    addTaskListBtn.innerText = 'Add & Fetch Fields';

    if (!res.success) {
      showStatus(taskListStatus, res.error || 'Failed to fetch fields.', 'error');
      return;
    }

    const newIndex = taskLists.length;
    taskLists.push({
      projectName,
      name,
      url,
      isSubtask: Boolean(res.isSubtask),
      fields: res.fields || []
    });

    redrawLists();

    chrome.storage.sync.set({ proofhubApiKey: apiKey });
    saveTaskListsToStorage(() => {
      chrome.storage.local.set({ selectedTaskListIndex: newIndex });
      projectInput.value = '';
      nameInput.value = '';
      urlInput.value = '';
      const modeText = res.isSubtask ? 'Parent Task (Subtasks)' : 'Task List (Tasks)';
      showStatus(
        taskListStatus,
        `Added ${modeText} "${projectName} — ${name}" with ${res.fields.length} available fields.`,
        'success'
      );
    });
  });

  saveBtn.addEventListener('click', () => {
    if (hasShortcutError) {
      showStatus(saveStatus, 'Please fix the overlapping shortcut error before saving.', 'error');
      shortcutInput.focus();
      return;
    }

    const apiKey = document.getElementById('apiKey').value.trim();
    chrome.storage.sync.set({
      proofhubApiKey: apiKey,
      customShortcut: currentShortcut,
      theme: currentTheme
    }, () => {
      saveTaskListsToStorage(() => {
        saveBtn.innerText = 'Saved!';
        showStatus(saveStatus, 'All settings saved successfully.', 'success');
        setTimeout(() => {
          saveBtn.innerText = 'Save All Settings';
        }, 2000);
      });
    });
  });

  chrome.storage.sync.get(['proofhubApiKey', 'taskLists', 'customShortcut', 'theme'], (syncResult) => {
    applyTheme(syncResult.theme || 'light');

    const apiKey = syncResult.proofhubApiKey || '';
    if (apiKey) document.getElementById('apiKey').value = apiKey;

    if (syncResult.customShortcut) {
      currentShortcut = syncResult.customShortcut;
      shortcutInput.value = syncResult.customShortcut.display;
    } else {
      shortcutInput.value = 'Ctrl+Shift+E (Default)';
    }

    chrome.storage.local.get(['taskLists'], async (localResult) => {
      if (Array.isArray(localResult.taskLists) && localResult.taskLists.length > 0) {
        taskLists = localResult.taskLists;
      } else if (Array.isArray(syncResult.taskLists) && syncResult.taskLists.length > 0) {
        taskLists = syncResult.taskLists;
        chrome.storage.sync.remove('taskLists');
      } else {
        taskLists = [];
      }

      if (ensureMetadataAndAssignees(taskLists)) saveTaskListsToStorage();
      redrawLists();
      clearStatus(taskListStatus);

      if (apiKey && taskLists.length > 0) {
        let didSync = false;
        for (const list of taskLists) {
          const assigneesField = (list.fields || []).find((f) => f.key === 'assigned');
          if (assigneesField && (!Array.isArray(assigneesField.options) || assigneesField.options.length === 0)) {
            const syncRes = await syncSingleTaskListFields(list, apiKey);
            if (syncRes.success) didSync = true;
          }
        }
        if (didSync) saveTaskListsToStorage(() => redrawLists());
      }
    });
  });
});
