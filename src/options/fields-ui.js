import { FIELD_TYPE_LABELS } from '../shared/constants.js';
import { isSubtaskUrl } from '../shared/url-parser.js';

export function ensureMetadataAndAssignees(lists) {
  let changed = false;
  lists.forEach((list) => {
    const detectedSubtask = isSubtaskUrl(list.url);
    if (list.isSubtask !== detectedSubtask) {
      list.isSubtask = detectedSubtask;
      changed = true;
    }
    if (!Array.isArray(list.fields)) {
      list.fields = [];
      changed = true;
    }
    const existing = list.fields.find((f) => f.key === 'assigned');
    if (!existing) {
      list.fields.unshift({
        key: 'assigned',
        isCustom: false,
        label: 'Assignees',
        rawType: 'people',
        type: 'multi_select',
        options: [],
        enabled: false,
        defaultValue: []
      });
      changed = true;
    } else if (existing.label !== 'Assignees') {
      existing.label = 'Assignees';
      changed = true;
    }
  });
  return changed;
}

export function buildDefaultValueEditor(field, listName, onSaveDefault) {
  const box = document.createElement('div');
  box.className = 'field-default-box';

  const caption = document.createElement('span');
  caption.className = 'field-default-caption';
  caption.innerText = 'Default value (preselected in Step 3):';
  box.appendChild(caption);

  const notifySaved = () => onSaveDefault(`Saved default for "${field.label}" in "${listName}".`);

  if (field.type === 'dropdown') {
    const select = document.createElement('select');
    const noneOpt = document.createElement('option');
    noneOpt.value = '';
    noneOpt.innerText = `-- No default (${field.label}) --`;
    select.appendChild(noneOpt);

    (field.options || []).forEach((opt) => {
      const o = document.createElement('option');
      o.value = String(opt.id);
      o.innerText = opt.label;
      select.appendChild(o);
    });

    select.value = field.defaultValue !== undefined && field.defaultValue !== null ? String(field.defaultValue) : '';
    select.addEventListener('change', () => {
      field.defaultValue = select.value;
      notifySaved();
    });
    box.appendChild(select);
  } else if (field.type === 'multi_select') {
    const multiBox = document.createElement('div');
    multiBox.className = 'default-multiselect-box';

    if (!field.options || field.options.length === 0) {
      const empty = document.createElement('span');
      empty.style.fontSize = '12px';
      empty.style.color = 'var(--text-muted)';
      empty.innerText = 'No options loaded yet. Click "Refresh Fields" above to sync assignees/options.';
      multiBox.appendChild(empty);
    } else {
      const selectedSet = new Set(Array.isArray(field.defaultValue) ? field.defaultValue.map(String) : []);
      field.options.forEach((opt) => {
        const optLabel = document.createElement('label');
        optLabel.className = 'default-multiselect-option';

        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.value = String(opt.id);
        cb.checked = selectedSet.has(String(opt.id));
        cb.addEventListener('change', () => {
          if (cb.checked) selectedSet.add(String(opt.id));
          else selectedSet.delete(String(opt.id));
          field.defaultValue = Array.from(selectedSet);
          notifySaved();
        });

        optLabel.appendChild(cb);

        if (opt.color) {
          const dot = document.createElement('span');
          dot.className = 'option-color-dot';
          dot.style.backgroundColor = opt.color;
          optLabel.appendChild(dot);
        }

        const text = document.createElement('span');
        text.innerText = opt.label;
        optLabel.appendChild(text);
        multiBox.appendChild(optLabel);
      });
    }
    box.appendChild(multiBox);
  } else if (field.type === 'date') {
    const input = document.createElement('input');
    input.type = 'date';
    input.value = field.defaultValue || '';
    input.addEventListener('change', () => {
      field.defaultValue = input.value;
      notifySaved();
    });
    box.appendChild(input);
  } else if (field.type === 'duration') {
    const row = document.createElement('div');
    row.className = 'default-duration-row';

    const hrsInput = document.createElement('input');
    hrsInput.type = 'number';
    hrsInput.min = '0';
    hrsInput.placeholder = 'Default Hours';
    hrsInput.value = field.defaultValue?.hours ?? '';

    const minsInput = document.createElement('input');
    minsInput.type = 'number';
    minsInput.min = '0';
    minsInput.max = '59';
    minsInput.placeholder = 'Default Mins';
    minsInput.value = field.defaultValue?.mins ?? '';

    const updateDuration = () => {
      field.defaultValue = (!hrsInput.value && !minsInput.value)
        ? null
        : { hours: hrsInput.value || '0', mins: minsInput.value || '0' };
      notifySaved();
    };

    hrsInput.addEventListener('change', updateDuration);
    minsInput.addEventListener('change', updateDuration);
    row.append(hrsInput, minsInput);
    box.appendChild(row);
  } else if (field.type === 'checkbox') {
    const cbLabel = document.createElement('label');
    cbLabel.className = 'default-multiselect-option';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = Boolean(field.defaultValue);
    cb.addEventListener('change', () => {
      field.defaultValue = cb.checked;
      notifySaved();
    });
    const span = document.createElement('span');
    span.innerText = 'Checked by default';
    cbLabel.append(cb, span);
    box.appendChild(cbLabel);
  } else if (field.type === 'textarea') {
    const ta = document.createElement('textarea');
    ta.rows = 2;
    ta.placeholder = `Default ${field.label} (optional)...`;
    ta.value = field.defaultValue ?? '';
    ta.addEventListener('change', () => {
      field.defaultValue = ta.value;
      notifySaved();
    });
    box.appendChild(ta);
  } else {
    const input = document.createElement('input');
    input.type = field.type === 'number' ? 'number' : (field.type === 'url' ? 'url' : (field.type === 'email' ? 'email' : 'text'));
    if (field.type === 'number') input.step = 'any';
    input.placeholder = `Default ${field.label} (optional)...`;
    input.value = field.defaultValue ?? '';
    input.addEventListener('change', () => {
      field.defaultValue = input.value;
      notifySaved();
    });
    box.appendChild(input);
  }

  return box;
}

export function renderTaskLists({ container, taskLists, onRefreshList, onRemoveList, onPersist }) {
  container.innerHTML = '';

  if (taskLists.length === 0) {
    container.innerHTML = '<p style="color:var(--text-muted); font-size:13px; margin: 0 0 14px 0;">No Task Lists or Parent Tasks added yet. Add one below to get started.</p>';
    return;
  }

  taskLists.forEach((list, listIndex) => {
    const isSubtask = Boolean(list.isSubtask || isSubtaskUrl(list.url));

    const div = document.createElement('div');
    div.className = 'task-list-item';

    const header = document.createElement('div');
    header.className = 'task-list-header';

    const info = document.createElement('div');
    const titleRow = document.createElement('div');
    titleRow.className = 'task-list-title-row';

    const titleEl = document.createElement('span');
    titleEl.className = 'task-list-title';
    titleEl.innerText = `${list.projectName} — ${list.name}`;

    const kindBadge = document.createElement('span');
    kindBadge.className = `target-kind-badge ${isSubtask ? 'subtask' : 'tasklist'}`;
    kindBadge.innerText = isSubtask ? 'Parent Task (Creates Subtasks)' : 'Task List (Creates Tasks)';

    titleRow.append(titleEl, kindBadge);

    const urlEl = document.createElement('span');
    urlEl.className = 'task-list-url';
    urlEl.innerText = list.url;

    info.append(titleRow, urlEl);

    const actions = document.createElement('div');
    actions.className = 'task-list-actions';

    const refreshBtn = document.createElement('button');
    refreshBtn.type = 'button';
    refreshBtn.className = 'secondary small';
    refreshBtn.innerText = 'Refresh Fields';
    refreshBtn.addEventListener('click', () => onRefreshList(list, refreshBtn));

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'danger small';
    removeBtn.innerText = 'Remove';
    removeBtn.addEventListener('click', () => onRemoveList(listIndex));

    actions.append(refreshBtn, removeBtn);
    header.append(info, actions);
    div.appendChild(header);

    const fieldsSection = document.createElement('div');
    fieldsSection.className = 'fields-section';

    const fieldsTitle = document.createElement('span');
    fieldsTitle.className = 'fields-section-title';
    fieldsTitle.innerText = `Available ${isSubtask ? 'Subtask' : 'Task'} Fields (Check fields to show in Step 3 & configure defaults):`;
    fieldsSection.appendChild(fieldsTitle);

    if (!Array.isArray(list.fields) || list.fields.length === 0) {
      const emptyMsg = document.createElement('div');
      emptyMsg.style.fontSize = '12px';
      emptyMsg.style.color = 'var(--text-muted)';
      emptyMsg.innerText = 'No fields loaded yet. Click "Refresh Fields" above to load fields from ProofHub.';
      fieldsSection.appendChild(emptyMsg);
    } else {
      const listWrap = document.createElement('div');
      listWrap.className = 'fields-list';

      list.fields.forEach((field) => {
        const card = document.createElement('div');
        card.className = `field-card${field.enabled ? ' enabled' : ''}`;

        const label = document.createElement('label');
        label.className = 'field-checkbox-label';

        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = !!field.enabled;

        const nameSpan = document.createElement('span');
        nameSpan.innerText = field.label;

        const badge = document.createElement('span');
        badge.className = 'field-type-badge';
        badge.innerText = FIELD_TYPE_LABELS[field.type] || field.type;

        label.append(cb, nameSpan, badge);
        card.appendChild(label);

        let defaultEditor = null;
        if (field.enabled) {
          defaultEditor = buildDefaultValueEditor(field, list.name, onPersist);
          card.appendChild(defaultEditor);
        }

        cb.addEventListener('change', () => {
          field.enabled = cb.checked;
          card.classList.toggle('enabled', cb.checked);

          if (cb.checked && !defaultEditor) {
            defaultEditor = buildDefaultValueEditor(field, list.name, onPersist);
            card.appendChild(defaultEditor);
          } else if (!cb.checked && defaultEditor) {
            defaultEditor.remove();
            defaultEditor = null;
          }

          const activeCount = list.fields.filter((f) => f.enabled).length;
          onPersist(`Saved: ${activeCount} field(s) selected for "${list.name}".`);
        });

        listWrap.appendChild(card);
      });

      fieldsSection.appendChild(listWrap);
    }

    div.appendChild(fieldsSection);
    container.appendChild(div);
  });
}
