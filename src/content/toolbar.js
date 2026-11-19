(() => {
  const TS = window.TSSnapper;

  TS.showToolbar = (rightX, bottomY) => {
    const toolbar = document.createElement('div');
    toolbar.id = 'ts-toolbar';

    const tools = [
      { id: 'pen', label: '✎ Pen', title: 'Freehand Pen' },
      { id: 'highlight', label: '🖍 Highlight', title: 'Highlighter (50% Opacity)' },
      { id: 'arrow', label: '↗ Arrow', title: 'Arrow' },
      { id: 'rectangle', label: '▭ Rect', title: 'Rectangle' },
      { id: 'circle', label: '◯ Circle', title: 'Circle / Oval' },
      { id: 'text', label: 'T Text', title: 'Add Text' }
    ];

    const toolButtons = [];
    tools.forEach((tool) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.innerText = tool.label;
      btn.title = tool.title;
      if (tool.id === TS.currentTool) btn.classList.add('active');

      btn.onclick = (e) => {
        e.stopPropagation();
        TS.commitActiveText();
        TS.currentTool = tool.id;
        toolButtons.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
      };

      toolButtons.push(btn);
      toolbar.appendChild(btn);
    });

    const colors = ['#ff0000', '#ffeb3b', '#00a8ff', '#00c853', '#111111'];
    const colorWrap = document.createElement('div');
    colorWrap.className = 'ts-color-group';

    const swatchButtons = [];
    colors.forEach((hex) => {
      const swatch = document.createElement('button');
      swatch.type = 'button';
      swatch.className = 'ts-color-swatch';
      swatch.style.setProperty('background', hex, 'important');
      swatch.style.setProperty('background-color', hex, 'important');
      swatch.title = `Color: ${hex}`;
      if (hex === TS.currentColor) swatch.classList.add('active');

      swatch.onclick = (e) => {
        e.stopPropagation();
        TS.currentColor = hex;
        swatchButtons.forEach((s) => s.classList.remove('active'));
        swatch.classList.add('active');
        if (TS.activeTextInput) {
          TS.activeTextInput.style.color = hex;
          TS.activeTextInput.dataset.color = hex;
        }
      };

      swatchButtons.push(swatch);
      colorWrap.appendChild(swatch);
    });
    toolbar.appendChild(colorWrap);

    const undoBtn = document.createElement('button');
    undoBtn.type = 'button';
    undoBtn.innerText = '↶ Undo';
    undoBtn.title = 'Undo (Ctrl+Z)';
    undoBtn.onclick = (e) => {
      e.stopPropagation();
      TS.undoAnnotation();
    };
    toolbar.appendChild(undoBtn);

    const checkBtn = document.createElement('button');
    checkBtn.type = 'button';
    checkBtn.className = 'ts-toolbar-check';
    checkBtn.innerText = TS.capturePhase === 'ACTUAL' ? '✓ Next (Expected)' : '✓ Done';
    checkBtn.title = TS.capturePhase === 'ACTUAL'
      ? 'Save Actual & Capture Expected Screenshot (Enter)'
      : 'Proceed to Task Details (Enter)';
    checkBtn.onclick = (e) => {
      e.stopPropagation();
      TS.confirmCurrentAnnotation();
    };
    toolbar.appendChild(checkBtn);

    const shortcutLabel = TS.customShortcut ? TS.customShortcut.display : 'Ctrl+Shift+E';
    const skipBtn = document.createElement('button');
    skipBtn.type = 'button';
    skipBtn.className = 'ts-toolbar-skip';
    skipBtn.innerText = '⏭ Skip';
    skipBtn.title = `Skip this screenshot (${shortcutLabel})`;
    skipBtn.onclick = (e) => {
      e.stopPropagation();
      TS.skipCurrentStep();
    };
    toolbar.appendChild(skipBtn);

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'ts-toolbar-close';
    closeBtn.innerText = '×';
    closeBtn.title = 'Cancel (Esc)';
    closeBtn.onclick = (e) => {
      e.stopPropagation();
      TS.resetAllCaptureState();
    };
    toolbar.appendChild(closeBtn);

    TS.overlayUI.appendChild(toolbar);

    const rect = toolbar.getBoundingClientRect();
    const leftPos = Math.max(10, Math.min(rightX - rect.width, window.innerWidth - rect.width - 10));
    const topPos = Math.min(bottomY + 10, window.innerHeight - rect.height - 10);
    toolbar.style.left = `${leftPos}px`;
    toolbar.style.top = `${topPos}px`;
  };
})();
