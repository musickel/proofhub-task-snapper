(() => {
  const TS = window.TSSnapper;

  TS.removeStep2Banner = () => {
    const existing = document.getElementById('ts-step2-banner');
    if (existing) existing.remove();
  };

  TS.syncStep2Banner = () => {
    if (
      document.hidden ||
      TS.extensionState !== 'IDLE' ||
      !TS.qaCaptureState ||
      TS.qaCaptureState.step !== 'AWAITING_EXPECTED'
    ) {
      TS.removeStep2Banner();
      return;
    }

    if (document.getElementById('ts-step2-banner')) return;

    const banner = document.createElement('div');
    banner.id = 'ts-step2-banner';
    banner.className = TS.currentTheme === 'dark' ? 'ts-theme-dark' : 'ts-theme-light';

    if (TS.qaCaptureState.actualImage) {
      const thumb = document.createElement('img');
      thumb.src = TS.qaCaptureState.actualImage;
      thumb.alt = 'Actual Screenshot';
      banner.appendChild(thumb);
    }

    const info = document.createElement('div');
    info.className = 'ts-step2-info';

    const title = document.createElement('strong');
    title.innerText = TS.qaCaptureState.actualImage
      ? '✓ Actual Screenshot Saved (1/2)'
      : '⏭ Actual Screenshot Skipped (1/2)';

    const shortcutLabel = TS.customShortcut ? TS.customShortcut.display : 'Ctrl+Shift+E';
    const sub = document.createElement('span');
    sub.innerText = `Navigate to Expected page (if different), then press Enter / ${shortcutLabel} or choose below:`;

    const actions = document.createElement('div');
    actions.className = 'ts-step2-actions';

    const captureExpectedBtn = document.createElement('button');
    captureExpectedBtn.type = 'button';
    captureExpectedBtn.className = 'ts-step2-capture-btn';
    captureExpectedBtn.innerText = 'Capture Expected (2/2)';
    captureExpectedBtn.onclick = () => {
      TS.removeStep2Banner();
      chrome.runtime.sendMessage({ action: 'trigger_capture_from_shortcut' });
    };

    const skipExpectedBtn = document.createElement('button');
    skipExpectedBtn.type = 'button';
    skipExpectedBtn.className = 'ts-step2-skip-btn';
    skipExpectedBtn.innerText = '⏭ Skip Expected';
    skipExpectedBtn.onclick = () => {
      TS.removeStep2Banner();
      const actualImg = TS.qaCaptureState ? TS.qaCaptureState.actualImage : null;
      const actualUrl = TS.qaCaptureState ? TS.qaCaptureState.actualPageUrl : null;
      TS.openStandaloneModal(actualImg, null, actualUrl);
    };

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'ts-step2-cancel-btn';
    cancelBtn.innerText = '×';
    cancelBtn.title = 'Cancel';
    cancelBtn.onclick = () => TS.resetAllCaptureState();

    actions.append(captureExpectedBtn, skipExpectedBtn, cancelBtn);
    info.append(title, sub, actions);
    banner.appendChild(info);
    document.body.appendChild(banner);
  };
})();
