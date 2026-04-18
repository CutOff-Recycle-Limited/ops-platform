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

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const err = new Error(data.error || `Request failed: ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}

// ─── Auth ────────────────────────────────────────────────────────
export const auth = {
  login: (email, password) => request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  register: (data) => request('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  me: () => request('/auth/me'),
  users: () => request('/auth/users'),
};

// ─── Operations ──────────────────────────────────────────────────
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

// ─── Tasks ───────────────────────────────────────────────────────
export const tasks = {
  list: (operationId, params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/operations/${operationId}/tasks${qs ? '?' + qs : ''}`);
  },
  get: (id) => request(`/tasks/${id}`),
  create: (operationId, data) => request(`/operations/${operationId}/tasks`, { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => request(`/tasks/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  transition: (id, status_id) => request(`/tasks/${id}/transition`, { method: 'PATCH', body: JSON.stringify({ status_id }) }),
  delete: (id) => request(`/tasks/${id}`, { method: 'DELETE' }),
};

// ─── Comments ────────────────────────────────────────────────────
export const comments = {
  create: (taskId, content) => request(`/tasks/${taskId}/comments`, { method: 'POST', body: JSON.stringify({ content }) }),
  update: (id, content) => request(`/comments/${id}`, { method: 'PUT', body: JSON.stringify({ content }) }),
  delete: (id) => request(`/comments/${id}`, { method: 'DELETE' }),
};

// ─── Dashboard ───────────────────────────────────────────────────
export const dashboard = {
  get: () => request('/dashboard'),
};
