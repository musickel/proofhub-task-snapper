(() => {
  const TS = window.TSSnapper;

  TS.getCanvasScale = () => {
    if (!TS.canvas) return { scaleX: 1, scaleY: 1 };
    const rect = TS.canvas.getBoundingClientRect();
    return {
      scaleX: rect.width > 0 ? TS.canvas.width / rect.width : 1,
      scaleY: rect.height > 0 ? TS.canvas.height / rect.height : 1
    };
  };

  TS.getSelectionBounds = () => ({
    left: Math.min(TS.startX, TS.endX),
    top: Math.min(TS.startY, TS.endY),
    right: Math.max(TS.startX, TS.endX),
    bottom: Math.max(TS.startY, TS.endY),
    width: Math.abs(TS.endX - TS.startX),
    height: Math.abs(TS.endY - TS.startY)
  });

  TS.isInsideSelection = (x, y) => {
    const b = TS.getSelectionBounds();
    return x >= b.left && x <= b.right && y >= b.top && y <= b.bottom;
  };

  TS.clipToSelection = () => {
    const b = TS.getSelectionBounds();
    TS.ctx.beginPath();
    TS.ctx.rect(b.left, b.top, b.width, b.height);
    TS.ctx.clip();
  };

  TS.renderSelectionRegion = (drawBorder) => {
    if (!TS.ctx || !TS.baseImage || !TS.baseImage.complete) return;
    const b = TS.getSelectionBounds();
    const { scaleX, scaleY } = TS.getCanvasScale();

    const sx = Math.max(0, Math.round(b.left * scaleX));
    const sy = Math.max(0, Math.round(b.top * scaleY));
    const sw = Math.min(TS.canvas.width - sx, Math.max(0, Math.round(b.width * scaleX)));
    const sh = Math.min(TS.canvas.height - sy, Math.max(0, Math.round(b.height * scaleY)));

    TS.ctx.save();
    TS.ctx.setTransform(1, 0, 0, 1, 0, 0);
    TS.ctx.imageSmoothingEnabled = false;

    TS.ctx.clearRect(0, 0, TS.canvas.width, TS.canvas.height);
    TS.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    TS.ctx.fillRect(0, 0, TS.canvas.width, TS.canvas.height);

    if (sw > 0 && sh > 0) {
      TS.ctx.drawImage(TS.baseImage, sx, sy, sw, sh, sx, sy, sw, sh);
      if (drawBorder) {
        TS.ctx.strokeStyle = '#1d6ce0';
        TS.ctx.lineWidth = Math.max(1, Math.round(1.5 * scaleX));
        TS.ctx.strokeRect(sx + 0.5, sy + 0.5, Math.max(0, sw - 1), Math.max(0, sh - 1));
      }
    }
    TS.ctx.restore();
  };

  TS.getCroppedSelectionDataUrl = () => {
    const b = TS.getSelectionBounds();
    const { scaleX, scaleY } = TS.getCanvasScale();
    const cropX = Math.max(0, Math.round(b.left * scaleX));
    const cropY = Math.max(0, Math.round(b.top * scaleY));
    const cropW = Math.min(TS.canvas.width - cropX, Math.max(1, Math.round(b.width * scaleX)));
    const cropH = Math.min(TS.canvas.height - cropY, Math.max(1, Math.round(b.height * scaleY)));

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = cropW;
    tempCanvas.height = cropH;

    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.imageSmoothingEnabled = false;
    tempCtx.drawImage(TS.canvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
    return tempCanvas.toDataURL('image/png');
  };

  TS.captureSnapshot = () => {
    const snap = document.createElement('canvas');
    snap.width = TS.canvas.width;
    snap.height = TS.canvas.height;
    const snapCtx = snap.getContext('2d');
    snapCtx.imageSmoothingEnabled = false;
    snapCtx.drawImage(TS.canvas, 0, 0);
    return snap;
  };

  TS.restoreSnapshot = (snap) => {
    if (!snap || !TS.ctx) return;
    TS.ctx.save();
    TS.ctx.setTransform(1, 0, 0, 1, 0, 0);
    TS.ctx.imageSmoothingEnabled = false;
    TS.ctx.clearRect(0, 0, TS.canvas.width, TS.canvas.height);
    TS.ctx.drawImage(snap, 0, 0);
    TS.ctx.restore();
  };

  TS.pushUndoState = () => {
    if (!TS.canvas) return;
    TS.undoStack.push(TS.captureSnapshot());
    if (TS.undoStack.length > 25) TS.undoStack.shift();
  };

  TS.undoAnnotation = () => {
    TS.commitActiveText();
    if (TS.undoStack.length === 0) return;
    TS.restoreSnapshot(TS.undoStack.pop());
  };

  TS.commitActiveText = () => {
    if (!TS.activeTextInput || !TS.ctx) return;
    const textarea = TS.activeTextInput;
    const text = textarea.value.trim();
    const x = parseFloat(textarea.dataset.x);
    const y = parseFloat(textarea.dataset.y);
    const color = textarea.dataset.color;
    const fontSize = parseInt(textarea.dataset.fontSize, 10) || 18;
    const fontWeight = textarea.dataset.bold === 'true' ? 'bold' : 'normal';
    const fontStyle = textarea.dataset.italic === 'true' ? 'italic' : 'normal';

    if (textarea.editorWrapper) textarea.editorWrapper.remove();
    else textarea.remove();
    TS.activeTextInput = null;
    if (!text) return;

    TS.pushUndoState();
    const { scaleX, scaleY } = TS.getCanvasScale();
    TS.ctx.save();
    TS.ctx.setTransform(scaleX, 0, 0, scaleY, 0, 0);
    TS.clipToSelection();
    TS.ctx.fillStyle = color;
    TS.ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px Arial, sans-serif`;
    TS.ctx.textBaseline = 'top';

    text.split('\n').forEach((line, i) => {
      TS.ctx.fillText(line, x, y + i * (fontSize * 1.25));
    });
    TS.ctx.restore();
  };

  TS.spawnTextInput = (x, y) => {
    TS.commitActiveText();

    const bounds = TS.getSelectionBounds();
    x = Math.max(bounds.left, Math.min(x, bounds.right - 180));
    y = Math.max(bounds.top, Math.min(y, bounds.bottom - 48));

    const wrapper = document.createElement('div');
    wrapper.id = 'ts-text-editor';
    wrapper.style.left = `${x}px`;
    wrapper.style.top = `${y}px`;

    const dragHandle = document.createElement('div');
    dragHandle.className = 'ts-text-drag-handle';
    dragHandle.title = 'Drag text box';
    dragHandle.innerHTML = '••••';

    const textarea = document.createElement('textarea');
    textarea.id = 'ts-inline-text-input';
    textarea.rows = 1;
    textarea.placeholder = 'Type text...';
    textarea.style.color = TS.currentColor;
    textarea.dataset.x = x;
    textarea.dataset.y = y;
    textarea.dataset.color = TS.currentColor;
    textarea.dataset.fontSize = TS.textFontSize;
    textarea.dataset.bold = TS.textBold;
    textarea.dataset.italic = TS.textItalic;
    textarea.editorWrapper = wrapper;

    const controls = document.createElement('div');
    controls.className = 'ts-text-format-controls';

    const sizeSelect = document.createElement('select');
    sizeSelect.title = 'Text size';
    sizeSelect.setAttribute('aria-label', 'Text size');
    [14, 18, 24, 30].forEach((size) => {
      const option = document.createElement('option');
      option.value = size;
      option.textContent = `${size}`;
      if (size === TS.textFontSize) option.selected = true;
      sizeSelect.appendChild(option);
    });

    const boldBtn = document.createElement('button');
    boldBtn.type = 'button';
    boldBtn.className = 'ts-text-format-btn';
    boldBtn.textContent = 'B';
    boldBtn.title = 'Bold';
    boldBtn.classList.toggle('active', TS.textBold);

    const italicBtn = document.createElement('button');
    italicBtn.type = 'button';
    italicBtn.className = 'ts-text-format-btn';
    italicBtn.textContent = 'I';
    italicBtn.title = 'Italic';
    italicBtn.classList.toggle('active', TS.textItalic);

    const preventBlur = (e) => {
      e.preventDefault();
      e.stopPropagation();
      textarea.focus();
    };

    sizeSelect.addEventListener('mousedown', preventBlur);
    sizeSelect.addEventListener('change', () => {
      TS.textFontSize = parseInt(sizeSelect.value, 10);
      textarea.dataset.fontSize = TS.textFontSize;
      textarea.style.fontSize = `${TS.textFontSize}px`;
      textarea.style.lineHeight = `${TS.textFontSize * 1.25}px`;
      textarea.focus();
    });

    boldBtn.addEventListener('mousedown', preventBlur);
    boldBtn.addEventListener('click', () => {
      TS.textBold = !TS.textBold;
      textarea.dataset.bold = TS.textBold;
      boldBtn.classList.toggle('active', TS.textBold);
      textarea.style.fontWeight = TS.textBold ? '700' : '400';
      textarea.focus();
    });

    italicBtn.addEventListener('mousedown', preventBlur);
    italicBtn.addEventListener('click', () => {
      TS.textItalic = !TS.textItalic;
      textarea.dataset.italic = TS.textItalic;
      italicBtn.classList.toggle('active', TS.textItalic);
      textarea.style.fontStyle = TS.textItalic ? 'italic' : 'normal';
      textarea.focus();
    });

    controls.append(sizeSelect, boldBtn, italicBtn);
    wrapper.append(dragHandle, textarea, controls);

    textarea.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        TS.commitActiveText();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        wrapper.remove();
        TS.activeTextInput = null;
      }
    });

    let dragStart = null;
    dragHandle.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const rect = wrapper.getBoundingClientRect();
      dragStart = { offsetX: e.clientX - rect.left, offsetY: e.clientY - rect.top };
      wrapper.setPointerCapture?.(e.pointerId);
    });
    dragHandle.addEventListener('pointermove', (e) => {
      if (!dragStart) return;
      const selection = TS.getSelectionBounds();
      const left = Math.max(selection.left, Math.min(e.clientX - dragStart.offsetX, selection.right - wrapper.offsetWidth));
      const top = Math.max(selection.top, Math.min(e.clientY - dragStart.offsetY, selection.bottom - wrapper.offsetHeight));
      wrapper.style.left = `${left}px`;
      wrapper.style.top = `${top}px`;
      textarea.dataset.x = left;
      textarea.dataset.y = top;
    });
    dragHandle.addEventListener('pointerup', (e) => {
      dragStart = null;
      wrapper.releasePointerCapture?.(e.pointerId);
    });

    textarea.style.fontSize = `${TS.textFontSize}px`;
    textarea.style.lineHeight = `${TS.textFontSize * 1.25}px`;
    textarea.style.fontWeight = TS.textBold ? '700' : '400';
    textarea.style.fontStyle = TS.textItalic ? 'italic' : 'normal';

    TS.overlayUI.appendChild(wrapper);
    TS.activeTextInput = textarea;
    setTimeout(() => textarea.focus(), 0);
  };

  TS.drawAnnotationShape = (x1, y1, x2, y2, points) => {
    const { scaleX, scaleY } = TS.getCanvasScale();
    const ctx = TS.ctx;
    ctx.save();
    ctx.setTransform(scaleX, 0, 0, scaleY, 0, 0);
    TS.clipToSelection();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (TS.currentTool === 'highlight') {
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = TS.currentColor === '#ff0000' ? '#ffeb3b' : TS.currentColor;
      ctx.lineWidth = 18;
      if (points.length > 0) {
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
        ctx.stroke();
      }
    } else if (TS.currentTool === 'pen') {
      ctx.globalAlpha = 1.0;
      ctx.strokeStyle = TS.currentColor;
      ctx.lineWidth = 3;
      if (points.length > 0) {
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
        ctx.stroke();
      }
    } else if (TS.currentTool === 'rectangle') {
      ctx.globalAlpha = 1.0;
      ctx.strokeStyle = TS.currentColor;
      ctx.lineWidth = 3;
      ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
    } else if (TS.currentTool === 'circle') {
      ctx.globalAlpha = 1.0;
      ctx.strokeStyle = TS.currentColor;
      ctx.lineWidth = 3;
      const cx = (x1 + x2) / 2;
      const cy = (y1 + y2) / 2;
      ctx.beginPath();
      ctx.ellipse(cx, cy, Math.abs(x2 - x1) / 2, Math.abs(y2 - y1) / 2, 0, 0, 2 * Math.PI);
      ctx.stroke();
    } else if (TS.currentTool === 'arrow') {
      ctx.globalAlpha = 1.0;
      ctx.strokeStyle = TS.currentColor;
      ctx.fillStyle = TS.currentColor;
      ctx.lineWidth = 3;
      const headLen = 15;
      const angle = Math.atan2(y2 - y1, x2 - x1);

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(x2, y2);
      ctx.lineTo(x2 - headLen * Math.cos(angle - Math.PI / 6), y2 - headLen * Math.sin(angle - Math.PI / 6));
      ctx.lineTo(x2 - headLen * Math.cos(angle + Math.PI / 6), y2 - headLen * Math.sin(angle + Math.PI / 6));
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();
  };
})();
