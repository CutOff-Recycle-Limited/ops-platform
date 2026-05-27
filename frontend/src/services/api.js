const BASE_URL = import.meta.env.VITE_API_URL || '/api';

function getToken() {
  return localStorage.getItem('ops_token');
}

async function request(path, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const err = new Error(data.error || `Request failed: ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

export const auth = {
  login: (email, password) => request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  register: (data) => request('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  me: () => request('/auth/me'),
  users: () => request('/auth/users'),
  forgotPassword: (email) => request('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),
  resetPassword: (token, password) => request('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, password }) }),
};

export const operations = {
  list: () => request('/operations'),
  get: (id) => request(`/operations/${id}`),
  create: (data) => request('/operations', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => request(`/operations/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id) => request(`/operations/${id}`, { method: 'DELETE' }),
  addMember: (id, data) => request(`/operations/${id}/members`, { method: 'POST', body: JSON.stringify(data) }),
  removeMember: (id, userId) => request(`/operations/${id}/members/${userId}`, { method: 'DELETE' }),
  getWorkflow: (id) => request(`/operations/${id}/workflow`),
};

export const tasks = {
  all: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/tasks${qs ? '?' + qs : ''}`);
  },
  today: () => request('/tasks/today'),
  createGeneral: (data) => request('/tasks', { method: 'POST', body: JSON.stringify(data) }),
  list: (operationId, params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/operations/${operationId}/tasks${qs ? '?' + qs : ''}`);
  },
  get: (id) => request(`/tasks/${id}`),
  create: (operationId, data) => request(`/operations/${operationId}/tasks`, { method: 'POST', body: JSON.stringify(data) }),
  patch: (id, data) => request(`/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  update: (id, data) => request(`/tasks/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  transition: (id, status_id) => request(`/tasks/${id}/transition`, { method: 'PATCH', body: JSON.stringify({ status_id }) }),
  timeEntries: (id) => request(`/tasks/${id}/time-entries`),
  createTimeEntry: (id, data) => request(`/tasks/${id}/time-entries`, { method: 'POST', body: JSON.stringify(data) }),
  updateTimeEntry: (id, entryId, data) => request(`/tasks/${id}/time-entries/${entryId}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteTimeEntry: (id, entryId) => request(`/tasks/${id}/time-entries/${entryId}`, { method: 'DELETE' }),
  delete: (id) => request(`/tasks/${id}`, { method: 'DELETE' }),
};

export const comments = {
  create: (taskId, content) => request(`/tasks/${taskId}/comments`, { method: 'POST', body: JSON.stringify({ content }) }),
  update: (id, content) => request(`/comments/${id}`, { method: 'PUT', body: JSON.stringify({ content }) }),
  delete: (id) => request(`/comments/${id}`, { method: 'DELETE' }),
};

export const dashboard = {
  get: () => request('/dashboard'),
};

export const users = {
  list: () => request('/users'),
  updateRole: (id, role) => request(`/users/${id}/role`, { method: 'PUT', body: JSON.stringify({ role }) }),
  platformRoles: (id) => request(`/users/${id}/platform-roles`),
  updatePlatformRole: (id, platform, role) => request(`/users/${id}/platform-roles`, { method: 'PUT', body: JSON.stringify({ platform, role }) }),
  deletePlatformRole: (id, platform) => request(`/users/${id}/platform-roles/${platform}`, { method: 'DELETE' }),
  disable: (id) => request(`/users/${id}/disable`, { method: 'PATCH' }),
  enable: (id) => request(`/users/${id}/enable`, { method: 'PATCH' }),
  delete: (id) => request(`/users/${id}`, { method: 'DELETE' }),
};

export const invites = {
  create: (role) => request('/invites', { method: 'POST', body: JSON.stringify({ role }) }),
  list: () => request('/invites'),
  validate: (token) => request('/invites/validate', { method: 'POST', body: JSON.stringify({ token }) }),
};
