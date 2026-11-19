import { resolveProofhubEndpoints } from '../shared/url-parser.js';

async function fetchJsonSafe(url, headers) {
  if (!url) return { ok: false, status: 0, data: null };
  try {
    const res = await fetch(url, { method: 'GET', headers });
    if (!res.ok) return { ok: false, status: res.status, data: null };
    const data = await res.json();
    return { ok: true, status: res.status, data };
  } catch (e) {
    return { ok: false, status: 0, data: null };
  }
}

function extractArray(data, keys = []) {
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object') {
    for (const k of keys) {
      if (Array.isArray(data[k])) return data[k];
    }
  }
  return [];
}

function mapCustomFieldType(rawType) {
  const t = String(rawType || 'text').toLowerCase();
  if (t === 'dropdown' || t === 'select' || t === 'single_select') return 'dropdown';
  if (t === 'tag' || t === 'tags' || t === 'multiselect' || t === 'multi_select') return 'multi_select';
  if (t === 'date' || t === 'datetime') return 'date';
  if (t === 'number' || t === 'numeric' || t === 'currency' || t === 'percentage' || t === 'decimal') return 'number';
  if (t === 'textarea' || t === 'long_text' || t === 'multiline') return 'textarea';
  if (t === 'checkbox' || t === 'boolean') return 'checkbox';
  if (t === 'url' || t === 'link') return 'url';
  if (t === 'email') return 'email';
  return 'text';
}

function normalizeOptionsList(rawOptions) {
  if (!Array.isArray(rawOptions)) return [];
  return rawOptions
    .map((opt) => {
      if (typeof opt === 'string' || typeof opt === 'number') {
        return { id: String(opt), label: String(opt) };
      }
      if (opt && typeof opt === 'object') {
        const id = opt.id ?? opt.value ?? opt.key ?? opt.name;
        const label = opt.name ?? opt.title ?? opt.label ?? opt.value ?? String(id);
        if (id !== undefined && id !== null) {
          return { id: String(id), label: String(label), color: opt.color || '' };
        }
      }
      return null;
    })
    .filter(Boolean);
}

export async function fetchProofhubTasklistFields(targetUrl, overrideApiKey) {
  const stored = await new Promise((resolve) => chrome.storage.sync.get(['proofhubApiKey'], resolve));
  const apiKey = (overrideApiKey || stored.proofhubApiKey || '').trim();

  if (!apiKey) {
    return { success: false, error: 'Please enter your ProofHub API Key first before adding a Task or Task List.' };
  }

  const endpoints = resolveProofhubEndpoints(targetUrl);
  if (!endpoints) {
    return {
      success: false,
      error: 'Invalid ProofHub URL. Paste a Task List URL (project-XXXX/list-XXXX) or Task URL (project-XXXX/list-XXXX/task-XXXX).'
    };
  }

  const headers = {
    'X-API-KEY': apiKey,
    'User-Agent': 'ProofhubTaskSnapper/1.0',
    'Content-Type': 'application/json'
  };

  const { isSubtask, baseUrl, projectId, listId, tasksUrl, parentTaskUrl, createUrl } = endpoints;

  const [
    projectRes,
    todolistRes,
    todolistsAllRes,
    parentTaskRes,
    subtasksSampleRes,
    projectCustomFieldsRes,
    globalCustomFieldsRes,
    projectPeopleRes,
    allPeopleRes,
    labelsRes,
    tasksSampleRes
  ] = await Promise.all([
    fetchJsonSafe(`${baseUrl}/api/v3/projects/${projectId}`, headers),
    fetchJsonSafe(`${baseUrl}/api/v3/projects/${projectId}/todolists/${listId}`, headers),
    fetchJsonSafe(`${baseUrl}/api/v3/projects/${projectId}/todolists`, headers),
    isSubtask ? fetchJsonSafe(parentTaskUrl, headers) : Promise.resolve({ ok: false, data: null }),
    isSubtask ? fetchJsonSafe(`${createUrl}?limit=25`, headers) : Promise.resolve({ ok: false, data: null }),
    fetchJsonSafe(`${baseUrl}/api/v3/projects/${projectId}/custom_fields`, headers),
    fetchJsonSafe(`${baseUrl}/api/v3/custom_fields`, headers),
    fetchJsonSafe(`${baseUrl}/api/v3/projects/${projectId}/people`, headers),
    fetchJsonSafe(`${baseUrl}/api/v3/people`, headers),
    fetchJsonSafe(`${baseUrl}/api/v3/labels`, headers),
    fetchJsonSafe(`${tasksUrl}?limit=25`, headers)
  ]);

  if (
    (projectRes.status === 401 || projectRes.status === 403) &&
    (tasksSampleRes.status === 401 || tasksSampleRes.status === 403)
  ) {
    return { success: false, error: 'ProofHub API Key was rejected (401/403). Check your API key.' };
  }

  const allTodolists = extractArray(todolistsAllRes.data, ['todolists', 'data']);
  const matchedTodolistFromAll = allTodolists.find((tl) => String(tl?.id) === String(listId));
  const todolistObj =
    (todolistRes.data && typeof todolistRes.data === 'object' && !Array.isArray(todolistRes.data)
      ? (todolistRes.data.todolist || todolistRes.data)
      : null) ||
    matchedTodolistFromAll ||
    {};

  const parentTaskObj =
    parentTaskRes.data && typeof parentTaskRes.data === 'object' && !Array.isArray(parentTaskRes.data)
      ? (parentTaskRes.data.task || parentTaskRes.data)
      : {};

  // Build directory of user ID -> full name
  const peopleDirectory = new Map();
  const registerPerson = (p) => {
    if (!p || typeof p !== 'object') return;
    const rawId = p.id ?? p.user_id ?? p.person_id;
    if (rawId === undefined || rawId === null) return;
    const id = String(rawId);
    const fullName =
      [p.first_name, p.last_name].filter(Boolean).join(' ').trim() ||
      p.name ||
      p.full_name ||
      p.title ||
      p.email;
    if (fullName && !peopleDirectory.has(id)) {
      peopleDirectory.set(id, { id, label: String(fullName) });
    }
  };

  const projectPeopleList = extractArray(projectPeopleRes.data, ['people', 'users', 'data']);
  projectPeopleList.forEach(registerPerson);
  extractArray(projectRes.data?.assigned, ['people', 'users', 'data']).forEach(registerPerson);
  extractArray(allPeopleRes.data, ['people', 'users', 'data']).forEach(registerPerson);

  const sampleTasks = extractArray(tasksSampleRes.data, ['tasks', 'data']);
  const sampleSubtasks = extractArray(subtasksSampleRes.data, ['subtasks', 'tasks', 'data']);
  [...sampleTasks, ...sampleSubtasks, parentTaskObj].forEach((t) => {
    if (Array.isArray(t?.assigned)) t.assigned.forEach(registerPerson);
  });

  // Scope assignees to those added to the specific task/tasklist
  const scopedAssignedRaw = [
    ...(isSubtask && Array.isArray(parentTaskObj.assigned) ? parentTaskObj.assigned : []),
    ...(Array.isArray(todolistObj.assigned) ? todolistObj.assigned : []),
    ...(Array.isArray(matchedTodolistFromAll?.assigned) ? matchedTodolistFromAll.assigned : []),
    ...(Array.isArray(todolistObj.subscribers) ? todolistObj.subscribers : []),
    ...(Array.isArray(todolistObj.members) ? todolistObj.members : [])
  ];

  const scopedAssignedIds = new Set();
  scopedAssignedRaw.forEach((entry) => {
    if (typeof entry === 'number' || typeof entry === 'string') {
      scopedAssignedIds.add(String(entry));
    } else if (entry && typeof entry === 'object') {
      registerPerson(entry);
      const id = entry.id ?? entry.user_id ?? entry.person_id;
      if (id !== undefined && id !== null) scopedAssignedIds.add(String(id));
    }
  });

  let peopleOptions = [];
  if (scopedAssignedIds.size > 0) {
    scopedAssignedIds.forEach((id) => {
      peopleOptions.push(peopleDirectory.get(id) || { id, label: `User #${id}` });
    });
  } else if (projectPeopleList.length > 0) {
    projectPeopleList.forEach((p) => {
      const id = String(p.id ?? p.user_id ?? '');
      if (id && peopleDirectory.has(id)) peopleOptions.push(peopleDirectory.get(id));
    });
  } else {
    peopleOptions = Array.from(peopleDirectory.values());
  }
  peopleOptions.sort((a, b) => a.label.localeCompare(b.label));

  // Labels & Stages
  const labelOptions = normalizeOptionsList(extractArray(labelsRes.data, ['labels', 'data']));
  const stageMap = new Map();
  if (!isSubtask) {
    const workflowStages = todolistObj?.workflow?.stages || todolistObj?.stages || [];
    if (Array.isArray(workflowStages)) {
      workflowStages.forEach((st) => {
        if (st && st.id && st.name) stageMap.set(String(st.id), String(st.name));
      });
    }
    sampleTasks.forEach((t) => {
      if (t?.stage?.id && t?.stage?.name) stageMap.set(String(t.stage.id), String(t.stage.name));
    });
  }
  const stageOptions = Array.from(stageMap.entries()).map(([id, label]) => ({ id, label }));

  // Custom Fields
  const customFieldMap = new Map();
  const ingestCustomFields = (rawList) => {
    const list = extractArray(rawList, ['custom_fields', 'data']);
    list.forEach((cf) => {
      if (!cf || typeof cf !== 'object' || !cf.id) return;
      if (Array.isArray(cf.projects) && cf.projects.length > 0) {
        if (!cf.projects.some((p) => String(p.id ?? p) === String(projectId))) return;
      }
      const id = String(cf.id);
      const label = cf.name || cf.title || cf.label || `Custom Field ${id}`;
      const rawType = cf.type || cf.field_type || cf.data_type || 'text';
      const mappedType = mapCustomFieldType(rawType);
      const options = normalizeOptionsList(cf.options || cf.values || cf.items || cf.choices);
      const existing = customFieldMap.get(id);

      customFieldMap.set(id, {
        key: `cf_${id}`,
        customFieldId: id,
        isCustom: true,
        label,
        rawType,
        type: options.length > 0 && mappedType === 'text' ? 'dropdown' : mappedType,
        options: options.length > 0 ? options : (existing?.options || []),
        enabled: false,
        defaultValue: null
      });
    });
  };

  ingestCustomFields(todolistObj?.custom_fields);
  ingestCustomFields(projectCustomFieldsRes.data);
  ingestCustomFields(projectRes.data?.custom_fields);
  ingestCustomFields(globalCustomFieldsRes.data);

  [...sampleTasks, ...sampleSubtasks, parentTaskObj].forEach((task) => {
    if (task?.custom_fields && typeof task.custom_fields === 'object') {
      Object.entries(task.custom_fields).forEach(([cfId, cfObj]) => {
        if (!customFieldMap.has(String(cfId)) && cfObj && typeof cfObj === 'object') {
          const label = cfObj.name || cfObj.title || cfObj.label || `Field #${cfId}`;
          const mappedType = mapCustomFieldType(cfObj.type || (Array.isArray(cfObj.value) ? 'dropdown' : 'text'));
          const options = normalizeOptionsList(cfObj.options || cfObj.values);
          customFieldMap.set(String(cfId), {
            key: `cf_${cfId}`,
            customFieldId: String(cfId),
            isCustom: true,
            label,
            rawType: cfObj.type || 'text',
            type: mappedType,
            options,
            enabled: false,
            defaultValue: null
          });
        }
      });
    }
  });

  const fields = [
    {
      key: 'assigned',
      isCustom: false,
      label: 'Assignees',
      rawType: 'people',
      type: 'multi_select',
      options: peopleOptions,
      enabled: false,
      defaultValue: []
    }
  ];

  customFieldMap.forEach((field) => fields.push(field));

  if (stageOptions.length > 0) {
    fields.push({
      key: 'stage',
      isCustom: false,
      label: 'Stage',
      rawType: 'dropdown',
      type: 'dropdown',
      options: stageOptions,
      enabled: false,
      defaultValue: ''
    });
  }

  if (labelOptions.length > 0) {
    fields.push({
      key: 'labels',
      isCustom: false,
      label: 'Labels',
      rawType: 'labels',
      type: 'multi_select',
      options: labelOptions,
      enabled: false,
      defaultValue: []
    });
  }

  fields.push(
    { key: 'start_date', isCustom: false, label: 'Start Date', rawType: 'date', type: 'date', options: [], enabled: false, defaultValue: '' },
    { key: 'due_date', isCustom: false, label: 'Due Date', rawType: 'date', type: 'date', options: [], enabled: false, defaultValue: '' },
    { key: 'estimated_time', isCustom: false, label: 'Estimated Time (Hours / Mins)', rawType: 'duration', type: 'duration', options: [], enabled: false, defaultValue: null }
  );

  return { success: true, isSubtask, fields };
}
