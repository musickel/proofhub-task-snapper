(() => {
  const TS = window.TSSnapper;

  TS.resetOverlayToExpectedStep = () => {
    TS.capturePhase = 'EXPECTED';
    TS.extensionState = 'SELECTING';
    TS.isDrawing = false;
    TS.startX = TS.startY = TS.endX = TS.endY = 0;
    TS.snapshotCanvas = null;
    TS.undoStack = [];
    TS.strokePoints = [];

    const existingToolbar = document.getElementById('ts-toolbar');
    if (existingToolbar) existingToolbar.remove();

    const badgeText = document.getElementById('ts-phase-badge-text');
    if (badgeText) badgeText.innerText = 'Step 2 of 2: Select & Annotate EXPECTED Screenshot';

    const badge = document.getElementById('ts-phase-badge');
    if (badge) badge.className = 'expected';

    const topSkipBtn = document.getElementById('ts-top-skip-btn');
    if (topSkipBtn) topSkipBtn.innerText = '⏭ Skip Expected';

    if (TS.ctx && TS.canvas) {
      TS.ctx.save();
      TS.ctx.setTransform(1, 0, 0, 1, 0, 0);
      TS.ctx.clearRect(0, 0, TS.canvas.width, TS.canvas.height);
      TS.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      TS.ctx.fillRect(0, 0, TS.canvas.width, TS.canvas.height);
      TS.ctx.restore();
    }
  };

  TS.skipCurrentStep = () => {
    TS.commitActiveText();
    if (TS.capturePhase === 'ACTUAL') {
      const nextState = { step: 'AWAITING_EXPECTED', actualImage: null, actualPageUrl: null };
      TS.qaCaptureState = nextState;
      chrome.storage.local.set({ qaCaptureState: nextState });
      TS.resetOverlayToExpectedStep();
    } else {
      const actualImg = TS.qaCaptureState ? TS.qaCaptureState.actualImage : null;
      const actualUrl = TS.qaCaptureState ? TS.qaCaptureState.actualPageUrl : null;
      TS.showDescriptionBox(actualImg, null, actualUrl);
    }
  };

  TS.confirmCurrentAnnotation = () => {
    TS.commitActiveText();
    const croppedImage = TS.getCroppedSelectionDataUrl();

    if (TS.capturePhase === 'ACTUAL') {
      const nextState = {
        step: 'AWAITING_EXPECTED',
        actualImage: croppedImage,
        actualPageUrl: window.location.href
      };
      TS.qaCaptureState = nextState;
      TS.closeOverlayOnly();
      chrome.storage.local.set({ qaCaptureState: nextState }, () => TS.syncStep2Banner());
    } else {
      const actualImg = TS.qaCaptureState ? TS.qaCaptureState.actualImage : null;
      const actualUrl = TS.qaCaptureState ? TS.qaCaptureState.actualPageUrl : null;
      TS.showDescriptionBox(actualImg, croppedImage, actualUrl);
    }
  };

  TS.openStandaloneModal = (actualImage, expectedImage, actualPageUrl) => {
    if (document.getElementById('ts-overlay-container')) return;
    TS.overlayUI = document.createElement('div');
    TS.overlayUI.id = 'ts-overlay-container';
    TS.overlayUI.className = TS.currentTheme === 'dark' ? 'ts-theme-dark' : 'ts-theme-light';
    TS.overlayUI.style.cursor = 'default';
    document.body.appendChild(TS.overlayUI);
    TS.showDescriptionBox(actualImage, expectedImage, actualPageUrl);
  };

  function initOverlay(dataUrl) {
    if (document.getElementById('ts-overlay-container')) return;
    TS.removeStep2Banner();
    TS.extensionState = 'SELECTING';

    TS.overlayUI = document.createElement('div');
    TS.overlayUI.id = 'ts-overlay-container';
    TS.overlayUI.className = TS.currentTheme === 'dark' ? 'ts-theme-dark' : 'ts-theme-light';

    const phaseBadge = document.createElement('div');
    phaseBadge.id = 'ts-phase-badge';
    phaseBadge.className = TS.capturePhase === 'EXPECTED' ? 'expected' : 'actual';

    const badgeText = document.createElement('span');
    badgeText.id = 'ts-phase-badge-text';
    badgeText.innerText = TS.capturePhase === 'EXPECTED'
      ? 'Step 2 of 2: Select & Annotate EXPECTED Screenshot'
      : 'Step 1 of 2: Select & Annotate ACTUAL Screenshot';

    const shortcutLabel = TS.customShortcut ? TS.customShortcut.display : 'Ctrl+Shift+E';
    const topSkipBtn = document.createElement('button');
    topSkipBtn.id = 'ts-top-skip-btn';
    topSkipBtn.type = 'button';
    topSkipBtn.title = `Skip this screenshot (${shortcutLabel})`;
    topSkipBtn.innerText = TS.capturePhase === 'EXPECTED' ? '⏭ Skip Expected' : '⏭ Skip Actual';
    topSkipBtn.onclick = (e) => {
      e.stopPropagation();
      TS.skipCurrentStep();
    };

    phaseBadge.append(badgeText, topSkipBtn);
    TS.overlayUI.appendChild(phaseBadge);

    const closeBtn = document.createElement('button');
    closeBtn.id = 'ts-close-overlay-btn';
    closeBtn.type = 'button';
    closeBtn.title = 'Close & Cancel (Esc)';
    closeBtn.innerText = '×';
    closeBtn.onclick = (e) => {
      e.stopPropagation();
      TS.resetAllCaptureState();
    };
    TS.overlayUI.appendChild(closeBtn);

    TS.canvas = document.createElement('canvas');
    TS.canvas.style.width = '100%';
    TS.canvas.style.height = '100%';
    TS.overlayUI.appendChild(TS.canvas);
    document.body.appendChild(TS.overlayUI);

    TS.ctx = TS.canvas.getContext('2d');

    TS.baseImage = new Image();
    TS.baseImage.onload = () => {
      TS.canvas.width = TS.baseImage.naturalWidth;
      TS.canvas.height = TS.baseImage.naturalHeight;
      TS.ctx.save();
      TS.ctx.setTransform(1, 0, 0, 1, 0, 0);
      TS.ctx.imageSmoothingEnabled = false;
      TS.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      TS.ctx.fillRect(0, 0, TS.canvas.width, TS.canvas.height);
      TS.ctx.restore();
    };
    TS.baseImage.src = dataUrl;

    TS.canvas.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      if (TS.extensionState === 'SELECTING') {
        TS.isDrawing = true;
        TS.startX = e.clientX;
        TS.startY = e.clientY;
      } else if (TS.extensionState === 'ANNOTATING') {
        if (TS.activeTextInput) {
          TS.commitActiveText();
          return;
        }
        if (!TS.isInsideSelection(e.clientX, e.clientY)) return;
        if (TS.currentTool === 'text') {
          TS.spawnTextInput(e.clientX, e.clientY);
          return;
        }
        TS.isDrawing = true;
        TS.shapeStartX = e.clientX;
        TS.shapeStartY = e.clientY;
        TS.strokePoints = [{ x: e.clientX, y: e.clientY }];
        TS.pushUndoState();
        TS.snapshotCanvas = TS.captureSnapshot();
      }
    });

    TS.canvas.addEventListener('mousemove', (e) => {
      if (!TS.isDrawing || !TS.baseImage || !TS.baseImage.complete) return;
      if (TS.extensionState === 'SELECTING') {
        TS.endX = e.clientX;
        TS.endY = e.clientY;
        TS.renderSelectionRegion(true);
      } else if (TS.extensionState === 'ANNOTATING') {
        TS.strokePoints.push({ x: e.clientX, y: e.clientY });
        TS.restoreSnapshot(TS.snapshotCanvas);
        TS.drawAnnotationShape(TS.shapeStartX, TS.shapeStartY, e.clientX, e.clientY, TS.strokePoints);
      }
    });

    TS.canvas.addEventListener('mouseup', (e) => {
      if (!TS.isDrawing) return;
      TS.isDrawing = false;
      if (TS.extensionState === 'SELECTING') {
        TS.endX = e.clientX;
        TS.endY = e.clientY;
        const b = TS.getSelectionBounds();
        if (b.width < 10 || b.height < 10) return;
        TS.renderSelectionRegion(false);
        TS.extensionState = 'ANNOTATING';
        TS.showToolbar(b.right, b.bottom);
      } else if (TS.extensionState === 'ANNOTATING') {
        TS.restoreSnapshot(TS.snapshotCanvas);
        TS.drawAnnotationShape(TS.shapeStartX, TS.shapeStartY, e.clientX, e.clientY, TS.strokePoints);
        TS.snapshotCanvas = null;
        TS.strokePoints = [];
      }
    });
  }

  const handleStorageChanged = (changes, area) => {
    if (area === 'sync') {
      if (changes.customShortcut) {
        TS.customShortcut = changes.customShortcut.newValue || null;
        TS.syncStep2Banner();
      }
      if (changes.theme) {
        TS.currentTheme = changes.theme.newValue === 'dark' ? 'dark' : 'light';
        TS.applyThemeClasses();
      }
    }
    if (area === 'local' && changes.qaCaptureState) {
      TS.qaCaptureState = changes.qaCaptureState.newValue || null;
      TS.syncStep2Banner();
    }
  };
  chrome.storage.onChanged.addListener(handleStorageChanged);

  const handleVisibilityChange = () => {
    if (!document.hidden) TS.syncStep2Banner();
  };
  document.addEventListener('visibilitychange', handleVisibilityChange);

  const handleKeyDown = (e) => {
    if (TS.extensionState !== 'IDLE' && (e.key === 'Escape' || e.key === 'Esc')) {
      e.preventDefault();
      e.stopPropagation();
      TS.resetAllCaptureState();
      return;
    }

    if (TS.extensionState === 'ANNOTATING' && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !TS.activeTextInput) {
      e.preventDefault();
      e.stopPropagation();
      TS.undoAnnotation();
      return;
    }

    if (TS.extensionState === 'ANNOTATING' && e.key === 'Enter' && !TS.activeTextInput) {
      e.preventDefault();
      e.stopPropagation();
      TS.confirmCurrentAnnotation();
      return;
    }

    if (
      TS.extensionState === 'IDLE' &&
      TS.qaCaptureState &&
      TS.qaCaptureState.step === 'AWAITING_EXPECTED' &&
      e.key === 'Enter' &&
      !TS.isEditableTarget(e.target)
    ) {
      e.preventDefault();
      e.stopPropagation();
      TS.removeStep2Banner();
      chrome.runtime.sendMessage({ action: 'trigger_capture_from_shortcut' });
      return;
    }

    if (!TS.customShortcut || TS.extensionState === 'MODAL') return;
    TS.activeKeys.add(TS.normalizeKeyEvent(e));

    const requiredKeys = [...TS.customShortcut.modifiers, ...TS.customShortcut.keys];
    const isMatch = TS.activeKeys.size === requiredKeys.length && requiredKeys.every((k) => TS.activeKeys.has(k));

    if (isMatch) {
      e.preventDefault();
      e.stopPropagation();
      TS.activeKeys.clear();
      if (TS.extensionState === 'SELECTING' || TS.extensionState === 'ANNOTATING') {
        TS.skipCurrentStep();
      } else if (TS.extensionState === 'IDLE') {
        TS.removeStep2Banner();
        chrome.runtime.sendMessage({ action: 'trigger_capture_from_shortcut' });
      }
    }
  };
  window.addEventListener('keydown', handleKeyDown, true);

  const handleKeyUp = (e) => TS.activeKeys.delete(TS.normalizeKeyEvent(e));
  window.addEventListener('keyup', handleKeyUp, true);

  const handleWindowBlur = () => TS.activeKeys.clear();
  window.addEventListener('blur', handleWindowBlur);

  const handleRuntimeMessage = (request, sender, sendResponse) => {
    if (request.action === 'shortcut_skip_if_open') {
      if (TS.extensionState === 'SELECTING' || TS.extensionState === 'ANNOTATING') {
        TS.skipCurrentStep();
        sendResponse({ skipped: true });
      } else {
        sendResponse({ skipped: false });
      }
      return;
    }

    if (request.action === 'initiate_capture') {
      chrome.storage.sync.get(['theme'], (syncRes) => {
        TS.currentTheme = syncRes.theme === 'dark' ? 'dark' : 'light';
        chrome.storage.local.get(['qaCaptureState'], (res) => {
          TS.qaCaptureState = res.qaCaptureState || null;
          TS.capturePhase = (TS.qaCaptureState && TS.qaCaptureState.step === 'AWAITING_EXPECTED') ? 'EXPECTED' : 'ACTUAL';
          initOverlay(request.image);
          sendResponse({ received: true });
        });
      });
      return true;
    }
  };
  chrome.runtime.onMessage.addListener(handleRuntimeMessage);

  window.__tsSnapperCleanup = () => {
    TS.closeOverlayOnly();
    TS.removeStep2Banner();
    window.removeEventListener('keydown', handleKeyDown, true);
    window.removeEventListener('keyup', handleKeyUp, true);
    window.removeEventListener('blur', handleWindowBlur);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    try {
      chrome.storage.onChanged.removeListener(handleStorageChanged);
      chrome.runtime.onMessage.removeListener(handleRuntimeMessage);
    } catch (e) {}
  };
})();
