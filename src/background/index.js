import { handleShortcutOrCapture, triggerCaptureOnActiveTab } from './capture.js';
import { fetchProofhubTasklistFields } from './proofhub-fields.js';
import { createProofhubTask } from './proofhub-task.js';

chrome.commands.onCommand.addListener((command) => {
  if (command === 'take_screenshot') {
    handleShortcutOrCapture();
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'start_capture_from_popup') {
    triggerCaptureOnActiveTab((result) => sendResponse(result));
    return true;
  }

  if (request.action === 'trigger_capture_from_shortcut') {
    handleShortcutOrCapture((result) => sendResponse(result));
    return true;
  }

  if (request.action === 'fetch_tasklist_fields') {
    fetchProofhubTasklistFields(request.url, request.apiKey).then((result) => sendResponse(result));
    return true;
  }

  if (request.action === 'create_task') {
    const fallbackUrl = (sender.tab && sender.tab.url) || '';
    const expectedPageUrl = request.payload.expectedPageUrl || fallbackUrl;
    createProofhubTask({ ...request.payload, expectedPageUrl }).then((response) => sendResponse(response));
    return true;
  }
});
