(() => {
  const TS = window.TSSnapper;

  TS.showDescriptionBox = (actualImage, expectedImage, actualPageUrl) => {
    if (document.getElementById('ts-description-modal')) return;
    TS.extensionState = 'MODAL';

    const phaseBadge = document.getElementById('ts-phase-badge');
    if (phaseBadge) phaseBadge.style.display = 'none';
    const topCloseBtn = document.getElementById('ts-close-overlay-btn');
    if (topCloseBtn) topCloseBtn.style.display = 'none';
    const toolbar = document.getElementById('ts-toolbar');
    if (toolbar) toolbar.style.display = 'none';

    const pageUrl = actualPageUrl || window.location.href;

    const themeClass = TS.currentTheme === 'dark' ? 'ts-theme-dark' : 'ts-theme-light';

    const backdrop = document.createElement('div');
    backdrop.id = 'ts-modal-backdrop';
    backdrop.className = themeClass;

    const modal = document.createElement('div');
    modal.id = 'ts-description-modal';
    modal.className = themeClass;

    const headerRow = document.createElement('div');
    headerRow.id = 'ts-modal-header';

    const headerTitleWrap = document.createElement('div');
    headerTitleWrap.id = 'ts-modal-title-wrap';

    const logoBadge = document.createElement('span');
    logoBadge.id = 'ts-modal-logo-badge';
    logoBadge.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;

    const heading = document.createElement('h3');
    heading.innerText = 'Add Task to ProofHub';
    headerTitleWrap.append(logoBadge, heading);

    const modalCloseBtn = document.createElement('button');
    modalCloseBtn.id = 'ts-modal-close-btn';
    modalCloseBtn.type = 'button';
    modalCloseBtn.title = 'Close & Cancel (Esc)';
    modalCloseBtn.innerText = '×';
    modalCloseBtn.onclick = TS.resetAllCaptureState;
    headerRow.append(headerTitleWrap, modalCloseBtn);

    const modalBody = document.createElement('div');
    modalBody.id = 'ts-modal-body';

    const previewGrid = document.createElement('div');
    previewGrid.id = 'ts-preview-grid';

    const buildPreviewCard = (labelText, imgSrc) => {
      const box = document.createElement('div');
      box.className = 'ts-preview-card';
      const lbl = document.createElement('span');
      lbl.innerText = labelText;
      box.appendChild(lbl);

      if (imgSrc) {
        const imgEl = document.createElement('img');
        imgEl.src = imgSrc;
        box.appendChild(imgEl);
      } else {
        const skippedDiv = document.createElement('div');
        skippedDiv.className = 'ts-preview-skipped';
        skippedDiv.innerText = 'Skipped';
        box.appendChild(skippedDiv);
      }
      return box;
    };

    previewGrid.append(
      buildPreviewCard('1. Actual Screenshot', actualImage),
      buildPreviewCard('2. Expected Screenshot', expectedImage)
    );

    const urlBadge = document.createElement('div');
    urlBadge.id = 'ts-expected-url-preview';
    urlBadge.title = pageUrl;
    const urlPrefix = document.createElement('strong');
    urlPrefix.innerText = 'Page URL: ';
    const urlText = document.createElement('span');
    urlText.innerText = pageUrl;
    urlBadge.append(urlPrefix, urlText);

    const titleGroup = document.createElement('div');
    titleGroup.className = 'ts-dynamic-field-group';
    const titleLabel = document.createElement('label');
    titleLabel.className = 'ts-field-label';
    titleLabel.innerText = 'Title *';
    const titleInput = document.createElement('input');
    titleInput.id = 'ts-task-title-input';
    titleInput.type = 'text';
    titleInput.placeholder = 'Enter title...';
    titleGroup.append(titleLabel, titleInput);

    const descGroup = document.createElement('div');
    descGroup.className = 'ts-dynamic-field-group';
    const descLabel = document.createElement('label');
    descLabel.className = 'ts-field-label';
    descLabel.innerText = 'Description';
    const descInput = document.createElement('textarea');
    descInput.id = 'ts-task-desc-input';
    descInput.rows = 3;
    descInput.placeholder = 'Enter description...';
    descGroup.append(descLabel, descInput);

    const listGroup = document.createElement('div');
    listGroup.className = 'ts-dynamic-field-group';
    const listLabel = document.createElement('label');
    listLabel.className = 'ts-field-label';
    listLabel.innerText = 'Target Task List / Parent Task';
    const select = document.createElement('select');
    select.id = 'ts-tasklist-select';
    listGroup.append(listLabel, select);

    const dynamicFieldsContainer = document.createElement('div');
    dynamicFieldsContainer.id = 'ts-dynamic-fields-container';
    const fieldGetters = new Map();
    let storedTaskLists = [];

    const submitBtn = document.createElement('button');
    submitBtn.id = 'ts-submit-btn';
    submitBtn.type = 'button';
    submitBtn.innerText = 'Add Task';

    const syncSelectedTargetUI = () => {
      const selectedItem = storedTaskLists[Number(select.value)];
      const subtaskMode = TS.isSubtaskItem(selectedItem);
      heading.innerText = subtaskMode ? 'Add Subtask to ProofHub' : 'Add Task to ProofHub';
      submitBtn.innerText = subtaskMode ? 'Add Subtask' : 'Add Task';
      titleInput.placeholder = subtaskMode ? 'Enter subtask title...' : 'Enter task title...';
      TS.renderDynamicFieldsForTasklist(dynamicFieldsContainer, selectedItem, fieldGetters);
    };

    const populateTaskListsDropdown = (lists, savedIndex) => {
      storedTaskLists = Array.isArray(lists) ? lists : [];
      select.innerHTML = '';
      storedTaskLists.forEach((list, index) => {
        const option = document.createElement('option');
        option.value = String(index);
        const prefix = TS.isSubtaskItem(list) ? '[Subtask]' : '[Task]';
        option.innerText = `${prefix} ${list.projectName} — ${list.name}`;
        select.appendChild(option);
      });

      if (storedTaskLists.length > 0) {
        const idx = Number(savedIndex);
        const validIdx = (!isNaN(idx) && idx >= 0 && idx < storedTaskLists.length) ? idx : 0;
        select.value = String(validIdx);
        syncSelectedTargetUI();
      }
    };

    chrome.storage.local.get(['taskLists', 'selectedTaskListIndex'], (localRes) => {
      if (Array.isArray(localRes.taskLists) && localRes.taskLists.length > 0) {
        populateTaskListsDropdown(localRes.taskLists, localRes.selectedTaskListIndex);
      } else {
        chrome.storage.sync.get(['taskLists'], (syncRes) => {
          populateTaskListsDropdown(syncRes.taskLists || [], localRes.selectedTaskListIndex);
        });
      }
    });

    select.addEventListener('change', () => {
      chrome.storage.local.set({ selectedTaskListIndex: Number(select.value) });
      syncSelectedTargetUI();
    });

    modalBody.append(previewGrid, urlBadge, titleGroup, descGroup, listGroup, dynamicFieldsContainer);

    const footerRow = document.createElement('div');
    footerRow.id = 'ts-modal-footer';

    const handleSubmit = () => {
      if (!titleInput.value.trim()) {
        alert('Please enter a title.');
        titleInput.focus();
        return;
      }

      const selectedItem = storedTaskLists[Number(select.value)];
      const subtaskMode = TS.isSubtaskItem(selectedItem);
      const dynamicFields = {};
      fieldGetters.forEach((getter, key) => {
        dynamicFields[key] = getter();
      });

      submitBtn.innerText = (actualImage || expectedImage) ? 'Uploading...' : 'Creating...';
      submitBtn.disabled = true;

      chrome.runtime.sendMessage({
        action: 'create_task',
        payload: {
          expectedPageUrl: pageUrl,
          title: titleInput.value.trim(),
          description: descInput.value,
          taskListIndex: Number(select.value),
          actualImage: actualImage || null,
          expectedImage: expectedImage || null,
          dynamicFields
        }
      }, (response) => {
        TS.resetAllCaptureState();
        const successLabel = (response?.isSubtask || subtaskMode)
          ? 'Subtask created successfully!'
          : 'Task created successfully!';
        alert(response && response.success ? successLabel : (response?.error || 'Failed to create item.'));
      });
    };

    submitBtn.onclick = handleSubmit;

    titleInput.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSubmit();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        TS.resetAllCaptureState();
      }
    });

    descInput.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleSubmit();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        TS.resetAllCaptureState();
      }
    });

    footerRow.append(submitBtn);
    modal.append(headerRow, modalBody, footerRow);
    backdrop.appendChild(modal);
    TS.overlayUI.appendChild(backdrop);
    titleInput.focus();
  };
})();
