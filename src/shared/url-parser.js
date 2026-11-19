export function isSubtaskUrl(url) {
  return /\/task-\d+/i.test(url || '') || /\/subtasks/i.test(url || '');
}

export function isSubtaskItem(item) {
  if (!item) return false;
  return Boolean(item.isSubtask || isSubtaskUrl(item.url));
}

export function resolveProofhubEndpoints(rawUrl) {
  const cleanUrl = (rawUrl || '').trim();

  // 1. Task URL -> Creates Subtasks inside that task
  const webTaskMatch = cleanUrl.match(/^(https?:\/\/[^/]+).*?project-(\d+)\/list-(\d+)\/task-(\d+)/i);
  if (webTaskMatch) {
    const [, baseUrl, projectId, listId, taskId] = webTaskMatch;
    const parentTaskUrl = `${baseUrl}/api/v3/projects/${projectId}/todolists/${listId}/tasks/${taskId}`;
    return {
      isSubtask: true,
      baseUrl,
      projectId,
      listId,
      taskId,
      attachmentsUrl: `${baseUrl}/api/v3/attachments`,
      parentTaskUrl,
      tasksUrl: `${baseUrl}/api/v3/projects/${projectId}/todolists/${listId}/tasks`,
      createUrl: `${parentTaskUrl}/subtasks`
    };
  }

  // Direct API v3 Subtasks URL
  const apiSubtaskMatch = cleanUrl.match(/^(https?:\/\/[^/]+)\/api\/v3\/projects\/(\d+)\/todolists\/(\d+)\/tasks\/(\d+)\/subtasks/i);
  if (apiSubtaskMatch) {
    const [, baseUrl, projectId, listId, taskId] = apiSubtaskMatch;
    const parentTaskUrl = `${baseUrl}/api/v3/projects/${projectId}/todolists/${listId}/tasks/${taskId}`;
    return {
      isSubtask: true,
      baseUrl,
      projectId,
      listId,
      taskId,
      attachmentsUrl: `${baseUrl}/api/v3/attachments`,
      parentTaskUrl,
      tasksUrl: `${baseUrl}/api/v3/projects/${projectId}/todolists/${listId}/tasks`,
      createUrl: cleanUrl
    };
  }

  // 2. Task List URL -> Creates Tasks inside that task list
  const webListMatch = cleanUrl.match(/^(https?:\/\/[^/]+).*?project-(\d+)\/list-(\d+)/i);
  if (webListMatch) {
    const [, baseUrl, projectId, listId] = webListMatch;
    const tasksUrl = `${baseUrl}/api/v3/projects/${projectId}/todolists/${listId}/tasks`;
    return {
      isSubtask: false,
      baseUrl,
      projectId,
      listId,
      taskId: null,
      attachmentsUrl: `${baseUrl}/api/v3/attachments`,
      parentTaskUrl: null,
      tasksUrl,
      createUrl: tasksUrl
    };
  }

  // Direct API v3 Tasks URL
  const apiListMatch = cleanUrl.match(/^(https?:\/\/[^/]+)\/api\/v3\/projects\/(\d+)\/todolists\/(\d+)\/tasks/i);
  if (apiListMatch) {
    const [, baseUrl, projectId, listId] = apiListMatch;
    return {
      isSubtask: false,
      baseUrl,
      projectId,
      listId,
      taskId: null,
      attachmentsUrl: `${baseUrl}/api/v3/attachments`,
      parentTaskUrl: null,
      tasksUrl: cleanUrl,
      createUrl: cleanUrl
    };
  }

  return null;
}
