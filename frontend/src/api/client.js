import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    const isLogin = err.config?.url?.includes('/auth/login');
    if (err.response?.status === 401 && !isLogin) {
      localStorage.removeItem('token');
      window.location.reload();
    }
    return Promise.reject(err);
  }
);

export const login = (username, password) =>
  api.post('/auth/login', new URLSearchParams({ username, password }), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
export const getMe = () => api.get('/auth/me');
export const changePassword = (payload) => api.post('/auth/change-password', payload);
export const updateProfile = (payload) => api.patch('/auth/me', payload);
export const uploadAvatar = (file) => {
  const form = new FormData();
  form.append('file', file);
  return api.post('/auth/me/avatar', form, { headers: { 'Content-Type': 'multipart/form-data' } });
};
export const deleteAvatar = () => api.delete('/auth/me/avatar');

export function userCan(user, perm) {
  const perms = user?.permissions;
  if (!Array.isArray(perms)) return false;
  return perms.includes("*") || perms.includes(perm);
}

export const getRpds = (params) => api.get('/rpd/', { params });
export const getRpd = (id) => api.get(`/rpd/${id}`);
export const createRpd = (data) => api.post('/rpd/', data);
export const updateRpd = (id, data) => api.patch(`/rpd/${id}`, data);
export const deleteRpd = (id) => api.delete(`/rpd/${id}`);
export const sendForApproval = (id) => api.post(`/rpd/${id}/send-approval`);
export const reviewRpd = (id, data) => api.post(`/rpd/${id}/review`, data);
export const getApprovals = (rpdId) => api.get(`/rpd/${rpdId}/approvals`);
export const getReviewers = () => api.get('/rpd/reviewers');
export const setApprovalRoute = (rpdId, reviewerIds) => api.put(`/rpd/${rpdId}/approval-route`, { reviewer_ids: reviewerIds });

export const addSection = (rpdId, data) => api.post(`/rpd/${rpdId}/sections`, data);
export const updateSection = (sectionId, data) => api.put(`/rpd/sections/${sectionId}`, data);
export const deleteSection = (sectionId) => api.delete(`/rpd/sections/${sectionId}`);

export const addTopic = (rpdId, data) => api.post(`/rpd/${rpdId}/topics`, data);
export const updateTopic = (topicId, data) => api.put(`/rpd/topics/${topicId}`, data);
export const deleteTopic = (topicId) => api.delete(`/rpd/topics/${topicId}`);

export const addLiterature = (rpdId, data) => api.post(`/rpd/${rpdId}/literature`, data);
export const updateLiterature = (litId, data) => api.put(`/rpd/literature/${litId}`, data);
export const deleteLiterature = (litId) => api.delete(`/rpd/literature/${litId}`);

export const addSoftware = (rpdId, data) => api.post(`/rpd/${rpdId}/software`, data);
export const updateSoftware = (swId, data) => api.put(`/rpd/software/${swId}`, data);
export const deleteSoftware = (swId) => api.delete(`/rpd/software/${swId}`);

export const addMaterialTech = (rpdId, data) => api.post(`/rpd/${rpdId}/material-tech`, data);
export const updateMaterialTech = (mtId, data) => api.put(`/rpd/material-tech/${mtId}`, data);
export const deleteMaterialTech = (mtId) => api.delete(`/rpd/material-tech/${mtId}`);

export const addDatabase = (rpdId, data) => api.post(`/rpd/${rpdId}/databases`, data);
export const updateDatabase = (dbId, data) => api.put(`/rpd/databases/${dbId}`, data);
export const deleteDatabase = (dbId) => api.delete(`/rpd/databases/${dbId}`);

export const addOutcome = (rpdId, data) => api.post(`/rpd/${rpdId}/outcomes`, data);
export const updateOutcome = (outcomeId, data) => api.put(`/rpd/outcomes/${outcomeId}`, data);
export const deleteOutcome = (outcomeId) => api.delete(`/rpd/outcomes/${outcomeId}`);

export const getOutcomesTable = (rpdId, bdId) =>
  api.get(`/rpd/${rpdId}/outcomes-table`, { params: bdId ? { bd_id: bdId } : {} });
export const upsertOutcome = (rpdId, data) => api.post(`/rpd/${rpdId}/outcomes/upsert`, data);
export const addManualOutcome = (rpdId, data) => api.post(`/rpd/${rpdId}/outcomes/manual`, data);
export const patchOutcomeSnapshot = (outcomeId, data) => api.patch(`/rpd/outcomes/${outcomeId}/snapshot`, data);
export const updateManualLink = (rpdId, data) => api.patch(`/rpd/${rpdId}/manual-link`, data);
export const updateRpdHeaderMeta = (rpdId, data) => api.patch(`/rpd/${rpdId}/header-meta`, data);

export const getAssessmentTools = () => api.get('/assessment-tools/');
export const createAssessmentTool = (name) => api.post('/assessment-tools/', { name });

export const getSuggestions = (kind, params) =>
  api.get(`/suggestions/${kind}`, { params: params || {} });

export const getDatabaseRefs = (params) =>
  api.get('/suggestions/database_name/refs', { params: params || {} });

export const adminListDictionary = (kind, params) =>
  api.get(`/admin/dictionary/${kind}`, { params: params || {} });
export const adminCreateDictionary = (kind, payload) =>
  api.post(`/admin/dictionary/${kind}`, payload);
export const adminUpdateDictionary = (idEntry, payload) =>
  api.patch(`/admin/dictionary/${idEntry}`, payload);
export const adminDeleteDictionary = (idEntry) =>
  api.delete(`/admin/dictionary/${idEntry}`);

export const adminListDisciplines = (params) =>
  api.get('/admin/disciplines/', { params: params || {} });
export const adminCreateDiscipline = (payload) =>
  api.post('/admin/disciplines/', payload);
export const adminUpdateDiscipline = (idDiscipline, payload) =>
  api.patch(`/admin/disciplines/${idDiscipline}`, payload);
export const adminDeleteDiscipline = (idDiscipline) =>
  api.delete(`/admin/disciplines/${idDiscipline}`);

export const adminListLlmPrompts = () => api.get('/admin/llm-prompts/');
export const adminListLlmLogs = () => api.get('/admin/llm-prompts/logs');
export const adminUpdateLlmPrompt = (idPrompt, data) =>
  api.patch(`/admin/llm-prompts/${idPrompt}`, data);

export const adminListGlobalDocuments = () =>
  api.get('/admin/documents/');
export const adminUploadGlobalDocument = (file) => {
  const form = new FormData();
  form.append('file', file);
  return api.post('/admin/documents/', form, { headers: { 'Content-Type': 'multipart/form-data' } });
};
export const adminDeleteGlobalDocument = (idDocument) =>
  api.delete(`/admin/documents/${idDocument}`);
export const adminGlobalDocumentDownloadUrl = (idDocument) =>
  `/api/admin/documents/${idDocument}/download`;
export const openDocument = async (idDocument) =>
  openBlob(await api.get(`/admin/documents/${idDocument}/download`, { responseType: 'blob' }));
export const adminListDocumentSections = (idDocument) =>
  api.get(`/admin/documents/${idDocument}/sections`);
export const adminReparseDocument = (idDocument) =>
  api.post(`/admin/documents/${idDocument}/reparse`);

export const fileUrl = (fileId) => `/api/files/${fileId}`;

const openBlob = (res) => {
  const url = URL.createObjectURL(res.data);
  window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 10000);
};

export const openFile = async (fileId) =>
  openBlob(await api.get(`/files/${fileId}`, { responseType: 'blob' }));

export const getFosFiles = (rpdId) => api.get(`/rpd/${rpdId}/fos`);
export const uploadFosFile = (rpdId, file, role = "other", name = "", comment = "") => {
  const form = new FormData();
  form.append("file", file);
  form.append("role", role);
  if (name) form.append("name", name);
  if (comment) form.append("comment", comment);
  return api.post(`/rpd/${rpdId}/fos`, form, { headers: { "Content-Type": "multipart/form-data" } });
};
export const selectFosFile = (rpdId, payload) => api.post(`/rpd/${rpdId}/fos/select`, payload);
export const deleteFosLink = (fosId) => api.delete(`/rpd/fos/${fosId}`);
export const getFosLibrary = () => api.get(`/rpd/fos/library`);

export const adminListUsers = () => api.get('/admin/users');
export const adminCreateUser = (data) => api.post('/admin/users', data);
export const adminUpdateUser = (userId, data) => api.patch(`/admin/users/${userId}`, data);
export const adminDeactivateUser = (userId) => api.delete(`/admin/users/${userId}`);
export const adminListRoles = () => api.get('/admin/roles');
export const adminListDepartments = () => api.get('/admin/departments');
export const adminCreateDepartment = (data) => api.post('/admin/departments', data);
export const adminUpdateDepartment = (deptId, data) => api.patch(`/admin/departments/${deptId}`, data);
export const adminDeleteDepartment = (deptId) => api.delete(`/admin/departments/${deptId}`);
export const searchUsers = (q) => api.get('/admin/users/search', { params: { q } });

export const adminListDirections = () => api.get('/admin/directions/');
export const adminCreateDirection = (payload) => api.post('/admin/directions/', payload);
export const adminDeleteDirection = (directionId) => api.delete(`/admin/directions/${directionId}`);
export const adminUpdateDirection = (directionId, payload) => api.patch(`/admin/directions/${directionId}`, payload);
export const adminAddDirectionProgram = (directionId, payload) => api.post(`/admin/directions/${directionId}/programs`, payload);
export const adminUpdateDirectionProgram = (programId, payload) => api.patch(`/admin/directions/programs/${programId}`, payload);
export const adminDeleteDirectionProgram = (programId) => api.delete(`/admin/directions/programs/${programId}`);
export const adminUploadFgos = (directionId, file) => {
  const form = new FormData();
  form.append('file', file);
  return api.post(`/admin/directions/${directionId}/fgos`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};
export const adminRemoveFgos = (directionId) => api.delete(`/admin/directions/${directionId}/fgos`);

export const addDeveloper = (rpdId, userId) => api.post(`/rpd/${rpdId}/developers?user_id=${userId}`);
export const removeDeveloper = (devId) => api.delete(`/rpd/developers/${devId}`);

export const getCompetencies = (directionId) => api.get('/competencies/', { params: { direction_id: directionId } });
export const getCompetenciesByDiscipline = (disciplineId) => api.get(`/competencies/by-discipline/${disciplineId}`);

export const generateSection = (rpdId, data, config) => api.post(`/llm/${rpdId}/generate`, data, config);
export const getLlmLogs = (rpdId) => api.get(`/llm/${rpdId}/logs`);

export const uploadDocument = (rpdId, file) => {
  const form = new FormData();
  form.append('file', file);
  return api.post(`/upload/${rpdId}`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
};
export const getDocuments = (rpdId) => api.get(`/upload/${rpdId}`);
export const deleteDocument = (docId) => api.delete(`/upload/${docId}`);
export const getDocumentSections = (docId) => api.get(`/upload/doc/${docId}/sections`);
export const deleteDocumentSection = (chunkId) => api.delete(`/upload/section/${chunkId}`);

export const exportPdf = (rpdId, bdId) =>
  api.get(`/export/${rpdId}/pdf`, {
    responseType: 'blob',
    params: bdId ? { bd_id: bdId } : {},
  });
export const fetchPdfInline = (rpdId, config = {}, bdId) => {
  const { params, ...rest } = config;
  return api.get(`/export/${rpdId}/pdf-inline`, {
    responseType: 'blob',
    ...rest,
    params: { ...(params || {}), ...(bdId ? { bd_id: bdId } : {}) },
  });
};

export const getDirections = () => api.get('/rpd/directions');

export const getDisciplines = (params) => api.get('/rpd/disciplines', { params });

export const getDirectionSuggestions = () => api.get('/rpd/direction-suggestions');

export const getNotifications = () => api.get('/notifications/');
export const getUnreadCount = () => api.get('/notifications/unread-count');
export const markNotificationRead = (id) => api.post(`/notifications/${id}/read`);
export const readAllNotifications = () => api.post('/notifications/read-all');


export const attachBupDiscipline = (rpdId, bdId) => api.post(`/rpd/${rpdId}/bup-disciplines/${bdId}`);
export const detachBupDiscipline = (rpdId, bdId) => api.delete(`/rpd/${rpdId}/bup-disciplines/${bdId}`);

export const getBups = (directionId) => api.get('/bups/', { params: { direction_id: directionId } });
export const getBup = (id) => api.get(`/bups/${id}`);
export const getBupDisciplines = (bupId) => api.get(`/bups/${bupId}/disciplines`);
export const getBupDiscipline = (bdId) => api.get(`/bups/disciplines/${bdId}`);

export const getBupDisciplinesByDiscipline = (disciplineId) =>
  api.get('/bups/disciplines', { params: { id_discipline: disciplineId } });
export const getCompetenciesByBupDiscipline = (bdId) =>
  api.get(`/competencies/by-bup-discipline/${bdId}`);

export const adminListBups = (directionId) =>
  api.get('/admin/bups/', { params: { direction_id: directionId } });
export const adminGetBup = (id) => api.get(`/admin/bups/${id}`);
export const adminCreateBup = (data) => api.post('/admin/bups/', data);
export const adminUpdateBup = (id, data) => api.patch(`/admin/bups/${id}`, data);
export const adminDeleteBup = (id) => api.delete(`/admin/bups/${id}`);
export const adminImportBupXls = (file, year, nameOverride) => {
  const form = new FormData();
  form.append('file', file);
  if (year != null && year !== '') form.append('year', String(year));
  if (nameOverride) form.append('name_override', nameOverride);
  return api.post('/admin/bups/import-xls', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};
export const adminAddBupDiscipline = (bupId, data) =>
  api.post(`/admin/bups/${bupId}/disciplines`, data);
export const adminUpdateBupDiscipline = (bdId, data) =>
  api.patch(`/admin/bups/disciplines/${bdId}`, data);
export const adminDeleteBupDiscipline = (bdId) =>
  api.delete(`/admin/bups/disciplines/${bdId}`);
export const adminDownloadBupSourceUrl = (bupId) => `/api/admin/bups/${bupId}/source-file`;

export const getHealth = () => api.get('/health');

export const adminGetLlmModel = () => api.get('/admin/system/llm-model');
export const adminSetLlmModel = (model) => api.patch('/admin/system/llm-model', { model });

export const adminGetApprover = () => api.get('/admin/system/approver');
export const adminSetApprover = (position, name) => api.patch('/admin/system/approver', { position, name });

export default api;
