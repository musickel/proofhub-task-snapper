(() => {
  const TS = window.TSSnapper;

  TS.renderDynamicFieldsForTasklist = (container, taskList, fieldGetters) => {
    container.innerHTML = '';
    fieldGetters.clear();

    if (!taskList || !Array.isArray(taskList.fields)) {
      container.style.display = 'none';
      return;
    }

    const isSubtask = TS.isSubtaskItem(taskList);
    const enabledFields = taskList.fields.filter((f) => Boolean(f.enabled) && !(isSubtask && f.key === 'stage'));
    if (enabledFields.length === 0) {
      container.style.display = 'none';
      return;
    }

    container.style.display = 'flex';

    enabledFields.forEach((field) => {
      const group = document.createElement('div');
      group.className = 'ts-dynamic-field-group';

      if (field.type === 'checkbox') {
        const row = document.createElement('label');
        row.className = 'ts-checkbox-row';
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = Boolean(field.defaultValue);
        cb.addEventListener('keydown', (e) => e.stopPropagation());
        const span = document.createElement('span');
        span.innerText = field.label;
        row.append(cb, span);
        group.appendChild(row);
        fieldGetters.set(field.key, () => cb.checked);
      } else {
        const label = document.createElement('label');
        label.className = 'ts-field-label';
        label.innerText = field.label;
        group.appendChild(label);

        if (field.type === 'dropdown') {
          const select = document.createElement('select');
          select.addEventListener('keydown', (e) => e.stopPropagation());

          const defaultOpt = document.createElement('option');
          defaultOpt.value = '';
          defaultOpt.innerText = `-- Select ${field.label} --`;
          select.appendChild(defaultOpt);

          (field.options || []).forEach((opt) => {
            const o = document.createElement('option');
            o.value = String(opt.id);
            o.innerText = opt.label;
            select.appendChild(o);
          });

          if (field.defaultValue !== undefined && field.defaultValue !== null && field.defaultValue !== '') {
            select.value = String(field.defaultValue);
          }

          group.appendChild(select);
          fieldGetters.set(field.key, () => select.value);
        } else if (field.type === 'multi_select') {
          const box = document.createElement('div');
          box.className = 'ts-multiselect-box';

          const defaultSelectedSet = new Set(Array.isArray(field.defaultValue) ? field.defaultValue.map(String) : []);
          const checkboxes = [];

          if (!field.options || field.options.length === 0) {
            const empty = document.createElement('span');
            empty.className = 'ts-empty-options-text';
            empty.innerText = 'No assignees/options found';
            box.appendChild(empty);
          } else {
            field.options.forEach((opt) => {
              const itemLabel = document.createElement('label');
              itemLabel.className = 'ts-multiselect-option';

              const cb = document.createElement('input');
              cb.type = 'checkbox';
              cb.value = String(opt.id);
              cb.checked = defaultSelectedSet.has(String(opt.id));
              cb.addEventListener('keydown', (e) => e.stopPropagation());

              itemLabel.appendChild(cb);

              if (opt.color) {
                const dot = document.createElement('span');
                dot.className = 'ts-option-color-dot';
                dot.style.backgroundColor = opt.color;
                itemLabel.appendChild(dot);
              }

              const text = document.createElement('span');
              text.innerText = opt.label;
              itemLabel.appendChild(text);

              checkboxes.push(cb);
              box.appendChild(itemLabel);
            });
          }

          group.appendChild(box);
          fieldGetters.set(field.key, () => checkboxes.filter((c) => c.checked).map((c) => c.value));
        } else if (field.type === 'date') {
          const input = document.createElement('input');
          input.type = 'date';
          if (field.defaultValue) input.value = String(field.defaultValue);
          input.addEventListener('keydown', (e) => e.stopPropagation());
          group.appendChild(input);
          fieldGetters.set(field.key, () => input.value);
        } else if (field.type === 'duration') {
          const row = document.createElement('div');
          row.className = 'ts-duration-row';

          const hrsInput = document.createElement('input');
          hrsInput.type = 'number';
          hrsInput.min = '0';
          hrsInput.placeholder = 'Hours';
          if (field.defaultValue && field.defaultValue.hours !== undefined) hrsInput.value = field.defaultValue.hours;
          hrsInput.addEventListener('keydown', (e) => e.stopPropagation());

          const minsInput = document.createElement('input');
          minsInput.type = 'number';
          minsInput.min = '0';
          minsInput.max = '59';
          minsInput.placeholder = 'Mins';
          if (field.defaultValue && field.defaultValue.mins !== undefined) minsInput.value = field.defaultValue.mins;
          minsInput.addEventListener('keydown', (e) => e.stopPropagation());

          row.append(hrsInput, minsInput);
          group.appendChild(row);
          fieldGetters.set(field.key, () => {
            if (!hrsInput.value && !minsInput.value) return null;
            return { hours: hrsInput.value || '0', mins: minsInput.value || '0' };
          });
        } else if (field.type === 'textarea') {
          const ta = document.createElement('textarea');
          ta.rows = 2;
          ta.className = 'ts-dynamic-textarea';
          ta.placeholder = `Enter ${field.label}...`;
          if (field.defaultValue !== undefined && field.defaultValue !== null) ta.value = String(field.defaultValue);
          ta.addEventListener('keydown', (e) => e.stopPropagation());
          group.appendChild(ta);
          fieldGetters.set(field.key, () => ta.value.trim());
        } else {
          const input = document.createElement('input');
          input.type = field.type === 'number' ? 'number' : (field.type === 'url' ? 'url' : (field.type === 'email' ? 'email' : 'text'));
          if (field.type === 'number') input.step = 'any';
          input.placeholder = `Enter ${field.label}...`;
          if (field.defaultValue !== undefined && field.defaultValue !== null) input.value = String(field.defaultValue);
          input.addEventListener('keydown', (e) => e.stopPropagation());
          group.appendChild(input);
          fieldGetters.set(field.key, () => input.value.trim());
        }
      }

      container.appendChild(group);
    });
  };
})();
