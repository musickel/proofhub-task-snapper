import { resolveProofhubEndpoints } from '../shared/url-parser.js';

function dataUrlToBlob(dataUrl) {
  const [header, base64] = dataUrl.split(',');
  const mime = header.match(/:(.*?);/)[1];
  const binary = atob(base64);
  const array = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    array[i] = binary.charCodeAt(i);
  }
  return new Blob([array], { type: mime });
}

function extractAttachmentUrl(item) {
  if (!item) return '';
  if (typeof item.url === 'string') return item.url;
  if (item.url && typeof item.url === 'object') {
    return item.url.view || item.url.display || item.url.download || '';
  }
  return item.file_url || item.download_url || item.src || '';
}

async function uploadProofhubAttachment(attachmentsUrl, baseHeaders, dataUrl, fileName) {
  try {
    const formData = new FormData();
    formData.append('file', dataUrlToBlob(dataUrl), fileName);

    const attachResp = await fetch(attachmentsUrl, {
      method: 'POST',
      headers: baseHeaders,
      body: formData
    });

    if (!attachResp.ok) return null;

    const raw = await attachResp.json();
    const item = Array.isArray(raw) ? raw[0] : (raw.attachment || raw.data || raw);
    const id = item && item.id;
    const fileUrl = extractAttachmentUrl(item);

    return id ? { id, fileName, fileUrl } : null;
  } catch (e) {
    return null;
  }
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildHtmlDescription({ expectedPageUrl, description, actualImgSrc, expectedImgSrc }) {
  const safeUrl = escapeHtml(expectedPageUrl);
  const safeDesc = escapeHtml(description).replace(/\r?\n/g, '<br>');
  const imgStyle = 'max-width: 100%; height: auto; border: 1px solid #d0d7de; border-radius: 4px; margin-top: 6px; display: block;';

  const sections = [
    `<p><strong>Page URL :</strong> <a href="${safeUrl}" target="_blank">${safeUrl}</a></p>`,
    `<p>${safeDesc}</p>`
  ];

  if (actualImgSrc) {
    sections.push(`<p><strong>Actual ScreenShot :</strong><br><img src="${actualImgSrc}" alt="Actual Screenshot" style="${imgStyle}"></p>`);
  }

  if (expectedImgSrc) {
    sections.push(`<p><strong>Expected Screenshot :</strong><br><img src="${expectedImgSrc}" alt="Expected Screenshot" style="${imgStyle}"></p>`);
  }

  return sections.join('<p><br></p>');
}

function applyDynamicFieldsToTaskBody(taskBody, dynamicFields, fieldDefs, isSubtask) {
  if (!dynamicFields || typeof dynamicFields !== 'object') return;
  const defsMap = new Map((fieldDefs || []).map((f) => [f.key, f]));
  const customFieldsPayload = {};

  Object.entries(dynamicFields).forEach(([key, val]) => {
    if (val === undefined || val === null || val === '') return;
    if (Array.isArray(val) && val.length === 0) return;

    const def = defsMap.get(key);

    if (key === 'assigned' && Array.isArray(val)) {
      taskBody.assigned = val.map((id) => (isNaN(Number(id)) ? id : Number(id)));
    } else if (key === 'labels' && Array.isArray(val)) {
      taskBody.labels = val.map((id) => (isNaN(Number(id)) ? id : Number(id)));
    } else if (key === 'stage' && !isSubtask) {
      taskBody.stage = isNaN(Number(val)) ? val : Number(val);
    } else if (key === 'start_date') {
      taskBody.start_date = String(val);
    } else if (key === 'due_date') {
      taskBody.due_date = String(val);
    } else if (key === 'estimated_time' && typeof val === 'object') {
      const hrs = parseInt(val.hours, 10);
      const mins = parseInt(val.mins, 10);
      if (!isNaN(hrs) && hrs >= 0) taskBody.estimated_hours = hrs;
      if (!isNaN(mins) && mins >= 0) taskBody.estimated_mins = mins;
    } else if (key.startsWith('cf_')) {
      const cfId = def?.customFieldId || key.replace(/^cf_/, '');
      if (def?.type === 'dropdown') {
        customFieldsPayload[cfId] = { value: [String(val)] };
      } else if (def?.type === 'multi_select') {
        customFieldsPayload[cfId] = { value: val.map(String) };
      } else if (def?.type === 'checkbox') {
        customFieldsPayload[cfId] = { value: val ? '1' : '0' };
      } else {
        customFieldsPayload[cfId] = { value: String(val) };
      }
    }
  });

  if (Object.keys(customFieldsPayload).length > 0) {
    taskBody.custom_fields = customFieldsPayload;
  }
}

export async function createProofhubTask(payload) {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['proofhubApiKey', 'taskLists'], (syncSettings) => {
      chrome.storage.local.get(['taskLists'], async (localSettings) => {
        try {
          const proofhubApiKey = syncSettings.proofhubApiKey;
          const taskLists =
            (Array.isArray(localSettings.taskLists) && localSettings.taskLists.length > 0)
              ? localSettings.taskLists
              : (syncSettings.taskLists || []);
          const selectedList = taskLists[Number(payload.taskListIndex)];

          if (!proofhubApiKey) {
            resolve({ success: false, error: 'ProofHub API key is missing. Add it in Settings.' });
            return;
          }

          if (!selectedList) {
            resolve({ success: false, error: 'No Task or Task List selected. Configure one in Settings.' });
            return;
          }

          const endpoints = resolveProofhubEndpoints(selectedList.url);
          if (!endpoints) {
            resolve({ success: false, error: 'Invalid ProofHub URL. Paste a valid Task List URL or Task URL in Settings.' });
            return;
          }

          const baseHeaders = {
            'X-API-KEY': proofhubApiKey,
            'User-Agent': 'ProofhubTaskSnapper/1.0'
          };

          const timestamp = Date.now();
          const attachmentsPayload = [];

          let actualUploaded = null;
          if (payload.actualImage) {
            actualUploaded = await uploadProofhubAttachment(
              endpoints.attachmentsUrl,
              baseHeaders,
              payload.actualImage,
              `actual-screenshot-${timestamp}.png`
            );
            if (actualUploaded) attachmentsPayload.push({ id: actualUploaded.id });
          }

          let expectedUploaded = null;
          if (payload.expectedImage) {
            expectedUploaded = await uploadProofhubAttachment(
              endpoints.attachmentsUrl,
              baseHeaders,
              payload.expectedImage,
              `expected-screenshot-${timestamp}.png`
            );
            if (expectedUploaded) attachmentsPayload.push({ id: expectedUploaded.id });
          }

          const actualImgSrc = payload.actualImage ? ((actualUploaded && actualUploaded.fileUrl) || payload.actualImage) : '';
          const expectedImgSrc = payload.expectedImage ? ((expectedUploaded && expectedUploaded.fileUrl) || payload.expectedImage) : '';

          const taskBody = {
            title: payload.title,
            description: buildHtmlDescription({
              expectedPageUrl: payload.expectedPageUrl,
              description: payload.description,
              actualImgSrc,
              expectedImgSrc
            })
          };

          if (attachmentsPayload.length > 0) taskBody.attachments = attachmentsPayload;
          applyDynamicFieldsToTaskBody(taskBody, payload.dynamicFields, selectedList.fields, endpoints.isSubtask);

          const response = await fetch(endpoints.createUrl, {
            method: 'POST',
            headers: { ...baseHeaders, 'Content-Type': 'application/json' },
            body: JSON.stringify(taskBody)
          });

          if (response.ok) {
            try {
              const createdItem = await response.json();
              const itemAttachments = createdItem && createdItem.attachments;
              if (Array.isArray(itemAttachments) && itemAttachments.length > 0 && createdItem.id) {
                const hostedActual = actualUploaded
                  ? extractAttachmentUrl(itemAttachments.find((a) => String(a.id) === String(actualUploaded.id)) || itemAttachments[0])
                  : '';
                const hostedExpected = expectedUploaded
                  ? extractAttachmentUrl(
                      itemAttachments.find((a) => String(a.id) === String(expectedUploaded.id)) ||
                      itemAttachments[actualUploaded ? 1 : 0]
                    )
                  : '';

                if ((hostedActual && hostedActual !== actualImgSrc) || (hostedExpected && hostedExpected !== expectedImgSrc)) {
                  const updatedHtml = buildHtmlDescription({
                    expectedPageUrl: payload.expectedPageUrl,
                    description: payload.description,
                    actualImgSrc: hostedActual || actualImgSrc,
                    expectedImgSrc: hostedExpected || expectedImgSrc
                  });

                  await fetch(`${endpoints.createUrl}/${createdItem.id}`, {
                    method: 'PUT',
                    headers: { ...baseHeaders, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ description: updatedHtml })
                  });
                }
              }
            } catch (e) {}

            chrome.storage.local.remove('qaCaptureState');
            resolve({ success: true, isSubtask: endpoints.isSubtask });
          } else {
            const errorText = await response.text();
            resolve({
              success: false,
              error: `ProofHub API Error (${response.status}): ${errorText || response.statusText}`
            });
          }
        } catch (error) {
          resolve({ success: false, error: error.message });
        }
      });
    });
  });
}
