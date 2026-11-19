# ProofHub Task Snapper

A Chrome extension for capturing, annotating, and attaching screenshots when creating tasks or subtasks in ProofHub.

## Features

- Capture actual and expected screenshots
- Crop and annotate screenshots with pen, highlight, arrow, rectangle, circle, and text tools
- Move and format text annotations
- Create ProofHub tasks or subtasks from the captured screenshots
- Attach screenshots and page information to the task description
- Support dynamic ProofHub task fields
- Use a configurable keyboard shortcut
- Switch between light and dark themes
- Open a built-in instruction manual

## Requirements

- Google Chrome or a Chromium-based browser
- A valid ProofHub API key
- ProofHub Task List or parent Task URLs

## Installation

1. Open `chrome://extensions` in Chrome.
2. Enable **Developer mode**.
3. Select **Load unpacked**.
4. Choose this project folder.

## Configuration

1. Open the extension popup.
2. Select **Settings & Task Lists**.
3. Enter the ProofHub API key.
4. Add a **Task List URL** to create tasks or a **Task URL** to create subtasks.
5. Optionally configure a keyboard shortcut and choose light or dark theme.
6. Select **Save All Settings**.

## Usage

1. Open the webpage containing the issue.
2. Open the extension popup and select the destination task list or parent task.
3. Select **Capture Actual (1/2)** or use the configured shortcut.
4. Crop the screenshot and add annotations if needed.
5. Capture the expected screenshot, or skip the expected screenshot if it is not needed.
6. Enter the task title and description.
7. Complete the available ProofHub fields.
8. Select **Add Task** or **Add Subtask**.

The task description includes the actual screenshot and the expected screenshot when captured. The page URL shown is from the actual screenshot page.

## Keyboard Shortcut

The default screenshot shortcut is:

- Windows/Linux: `Ctrl+Shift+E`
- macOS: `Command+Shift+E`

The shortcut can be changed in the extension settings.

## Project Structure

- `manifest.json` — Chrome extension configuration
- `src/popup/` — Extension popup
- `src/options/` — Settings and task-list configuration
- `src/content/` — Screenshot, annotation, banner, and task modal UI
- `src/background/` — Extension capture and ProofHub API integration
- `src/shared/` — Shared constants and URL parsing
- `src/help/` — Built-in instruction manual
- `icon-ph-ss.png` — Extension icon

## Dark Mode

Dark mode applies to the extension popup, settings page, instruction manual, screenshot overlay, annotation toolbar, banners, and task/subtask modal.

## Permissions

The extension uses Chrome storage, active-tab access, scripting, tabs, and host permissions required to capture pages and communicate with ProofHub APIs.
