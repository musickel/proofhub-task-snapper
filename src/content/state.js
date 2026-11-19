(() => {
  if (typeof window.__tsSnapperCleanup === 'function') {
    window.__tsSnapperCleanup();
  }

  const TS = (window.TSSnapper = {
    extensionState: 'IDLE', // IDLE, SELECTING, ANNOTATING, MODAL
    capturePhase: 'ACTUAL', // ACTUAL | EXPECTED
    startX: 0,
    startY: 0,
    endX: 0,
    endY: 0,
    shapeStartX: 0,
    shapeStartY: 0,
    isDrawing: false,
    currentTool: 'highlight',
    currentColor: '#ff0000',
    currentTheme: 'light',
    overlayUI: null,
    canvas: null,
    ctx: null,
    baseImage: null,
    snapshotCanvas: null,
    strokePoints: [],
    undoStack: [],
    activeTextInput: null,
    textFontSize: 18,
    textBold: true,
    textItalic: false,
    qaCaptureState: null,
    customShortcut: null,
    activeKeys: new Set(),

    isSubtaskItem(item) {
      if (!item) return false;
      return Boolean(item.isSubtask || /\/task-\d+/i.test(item.url || '') || /\/subtasks/i.test(item.url || ''));
    },

    normalizeKeyEvent(e) {
      if (e.key === 'Control') return 'Ctrl';
      if (e.key === 'Alt') return 'Alt';
      if (e.key === 'Shift') return 'Shift';
      if (e.key === 'Meta') return 'Cmd';
      if (e.key === ' ') return 'Space';
      if (e.key.length === 1) return e.key.toUpperCase();
      return e.key;
    },

    isEditableTarget(target) {
      if (!target) return false;
      const tag = target.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
    },

    applyThemeClasses() {
      const themeClass = TS.currentTheme === 'dark' ? 'ts-theme-dark' : 'ts-theme-light';
      const removeClass = TS.currentTheme === 'dark' ? 'ts-theme-light' : 'ts-theme-dark';

      if (TS.overlayUI) {
        TS.overlayUI.classList.remove(removeClass);
        TS.overlayUI.classList.add(themeClass);
      }
      const banner = document.getElementById('ts-step2-banner');
      if (banner) {
        banner.classList.remove(removeClass);
        banner.classList.add(themeClass);
      }

      const modalBackdrop = document.getElementById('ts-modal-backdrop');
      if (modalBackdrop) {
        modalBackdrop.classList.remove(removeClass);
        modalBackdrop.classList.add(themeClass);
      }
      const modal = document.getElementById('ts-description-modal');
      if (modal) {
        modal.classList.remove(removeClass);
        modal.classList.add(themeClass);
      }
    },

    closeOverlayOnly() {
      if (typeof TS.commitActiveText === 'function') TS.commitActiveText();
      if (TS.overlayUI) {
        TS.overlayUI.remove();
        TS.overlayUI = null;
      }
      TS.canvas = null;
      TS.ctx = null;
      TS.baseImage = null;
      TS.snapshotCanvas = null;
      TS.undoStack = [];
      TS.strokePoints = [];
      TS.isDrawing = false;
      TS.extensionState = 'IDLE';
      TS.activeKeys.clear();
    },

    resetAllCaptureState() {
      TS.closeOverlayOnly();
      if (typeof TS.removeStep2Banner === 'function') TS.removeStep2Banner();
      TS.qaCaptureState = null;
      chrome.storage.local.remove('qaCaptureState');
    }
  });

  chrome.storage.sync.get(['customShortcut', 'theme'], (res) => {
    TS.customShortcut = res.customShortcut || null;
    TS.currentTheme = res.theme === 'dark' ? 'dark' : 'light';
    TS.applyThemeClasses();
  });

  chrome.storage.local.get(['qaCaptureState'], (res) => {
    TS.qaCaptureState = res.qaCaptureState || null;
    if (typeof TS.syncStep2Banner === 'function') TS.syncStep2Banner();
  });
})();
