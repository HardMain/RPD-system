import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

// Attach token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// 401 → redirect to login
api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.reload();
    }
    return Promise.reject(err);
  }
);

// Auth
export const login = (username, password) =>
  api.post('/auth/login', new URLSearchParams({ username, password }), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
export const getMe = () => api.get('/auth/me');

// RPD
export const getRpds = (params) => api.get('/rpd/', { params });
export const getRpd = (id) => api.get(`/rpd/${id}`);
export const createRpd = (data) => api.post('/rpd/', data);
export const updateRpd = (id, data) => api.patch(`/rpd/${id}`, data);
export const deleteRpd = (id) => api.delete(`/rpd/${id}`);
export const sendForApproval = (id) => api.post(`/rpd/${id}/send-approval`);
export const reviewRpd = (id, data) => api.post(`/rpd/${id}/review`, data);
export const getApprovals = (rpdId) => api.get(`/rpd/${rpdId}/approvals`);

// Sections
export const addSection = (rpdId, data) => api.post(`/rpd/${rpdId}/sections`, data);
export const updateSection = (sectionId, data) => api.put(`/rpd/sections/${sectionId}`, data);
export const deleteSection = (sectionId) => api.delete(`/rpd/sections/${sectionId}`);

// Topics
export const addTopic = (sectionId, data) => api.post(`/rpd/sections/${sectionId}/topics`, data);
export const updateTopic = (topicId, data) => api.put(`/rpd/topics/${topicId}`, data);
export const deleteTopic = (topicId) => api.delete(`/rpd/topics/${topicId}`);

// Literature
export const addLiterature = (rpdId, data) => api.post(`/rpd/${rpdId}/literature`, data);
export const updateLiterature = (litId, data) => api.put(`/rpd/literature/${litId}`, data);
export const deleteLiterature = (litId) => api.delete(`/rpd/literature/${litId}`);

// Software
export const addSoftware = (rpdId, data) => api.post(`/rpd/${rpdId}/software`, data);
export const updateSoftware = (swId, data) => api.put(`/rpd/software/${swId}`, data);
export const deleteSoftware = (swId) => api.delete(`/rpd/software/${swId}`);

// Material-Tech
export const addMaterialTech = (rpdId, data) => api.post(`/rpd/${rpdId}/material-tech`, data);
export const updateMaterialTech = (mtId, data) => api.put(`/rpd/material-tech/${mtId}`, data);
export const deleteMaterialTech = (mtId) => api.delete(`/rpd/material-tech/${mtId}`);

// Databases (БД и ИСС)
export const addDatabase = (rpdId, data) => api.post(`/rpd/${rpdId}/databases`, data);
export const updateDatabase = (dbId, data) => api.put(`/rpd/databases/${dbId}`, data);
export const deleteDatabase = (dbId) => api.delete(`/rpd/databases/${dbId}`);

// Learning Outcomes
export const addOutcome = (rpdId, data) => api.post(`/rpd/${rpdId}/outcomes`, data);
export const updateOutcome = (outcomeId, data) => api.put(`/rpd/outcomes/${outcomeId}`, data);
export const deleteOutcome = (outcomeId) => api.delete(`/rpd/outcomes/${outcomeId}`);
export const getOutcomesTable = (rpdId) => api.get(`/rpd/${rpdId}/outcomes-table`);
export const upsertOutcome = (rpdId, data) => api.post(`/rpd/${rpdId}/outcomes/upsert`, data);

// Assessment tools (справочник средств оценки)
export const getAssessmentTools = () => api.get('/assessment-tools/');
export const createAssessmentTool = (name) => api.post('/assessment-tools/', { name });

// Файлы (общий просмотр любых stored_files по id)
export const fileUrl = (fileId) => `/api/files/${fileId}`;

// ФОС — файлы фонда оценочных средств у РПД
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

// Направления (админ) — управление ФГОС-файлом
export const adminListDirections = () => api.get('/admin/directions/');
export const adminUploadFgos = (directionId, file) => {
  const form = new FormData();
  form.append('file', file);
  return api.post(`/admin/directions/${directionId}/fgos`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};
export const adminRemoveFgos = (directionId) => api.delete(`/admin/directions/${directionId}/fgos`);

// Developers
export const addDeveloper = (rpdId, userId) => api.post(`/rpd/${rpdId}/developers?user_id=${userId}`);
export const removeDeveloper = (devId) => api.delete(`/rpd/developers/${devId}`);

// Competencies
export const getCompetencies = (directionId) => api.get('/competencies/', { params: { direction_id: directionId } });
export const getCompetenciesByDiscipline = (disciplineId) => api.get(`/competencies/by-discipline/${disciplineId}`);

// LLM
export const generateSection = (rpdId, data) => api.post(`/llm/${rpdId}/generate`, data);
export const getLlmLogs = (rpdId) => api.get(`/llm/${rpdId}/logs`);

// Upload
export const uploadDocument = (rpdId, file) => {
  const form = new FormData();
  form.append('file', file);
  return api.post(`/upload/${rpdId}`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
};
export const getDocuments = (rpdId) => api.get(`/upload/${rpdId}`);
export const deleteDocument = (docId) => api.delete(`/upload/${docId}`);

// Export
export const exportPdf = (rpdId) =>
  api.get(`/export/${rpdId}/pdf`, { responseType: 'blob' });
export const fetchPdfInline = (rpdId, config = {}) =>
  api.get(`/export/${rpdId}/pdf-inline`, { responseType: 'blob', ...config });

// Directions & Disciplines
export const getDirections = () => api.get('/rpd/directions');
export const getDisciplines = (directionId) => api.get('/rpd/disciplines', { params: { direction_id: directionId } });

// Notifications
export const getNotifications = () => api.get('/notifications/');
export const getUnreadCount = () => api.get('/notifications/unread-count');
export const markNotificationRead = (id) => api.post(`/notifications/${id}/read`);
export const readAllNotifications = () => api.post('/notifications/read-all');

// Admin
export const getUsers = () => api.get('/admin/users');
export const createUser = (data) => api.post('/admin/users', data);
export const updateUser = (id, data) => api.patch(`/admin/users/${id}`, data);
export const deactivateUser = (id) => api.delete(`/admin/users/${id}`);
export const searchUsers = (q) => api.get('/admin/users/search', { params: { q } });
export const getRoles = () => api.get('/admin/roles');
export const getDepartments = () => api.get('/admin/departments');

// Привязки РПД ↔ дисциплины БУПа (multi-БУП РПД)
export const attachBupDiscipline = (rpdId, bdId) => api.post(`/rpd/${rpdId}/bup-disciplines/${bdId}`);
export const detachBupDiscipline = (rpdId, bdId) => api.delete(`/rpd/${rpdId}/bup-disciplines/${bdId}`);

// БУПы (read-only, доступно всем)
export const getBups = (directionId) => api.get('/bups/', { params: { direction_id: directionId } });
export const getBup = (id) => api.get(`/bups/${id}`);
export const getBupDisciplines = (bupId) => api.get(`/bups/${bupId}/disciplines`);
export const getBupDiscipline = (bdId) => api.get(`/bups/disciplines/${bdId}`);
export const getCompetenciesByBupDiscipline = (bdId) =>
  api.get(`/competencies/by-bup-discipline/${bdId}`);

// БУПы (админ)
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

// Health
export const getHealth = () => api.get('/health');

export default api;
