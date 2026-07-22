/** Client-facing REST API paths (v1). */

export const API_V1 = {
  warzoneTasks: '/api/v1/warzone/tasks',
  warzoneTask: id => `/api/v1/warzone/tasks/${encodeURIComponent(id)}`,
  calendarHolidays: year =>
    `/api/v1/calendar/holidays?year=${encodeURIComponent(year)}`,
  authMe: '/api/v1/auth/me',
};

export function warzoneTasksQuery({ department, bucket } = {}) {
  const params = new URLSearchParams();
  if (department) params.set('department', department);
  if (bucket) params.set('bucket', bucket);
  const qs = params.toString();
  return qs ? `${API_V1.warzoneTasks}?${qs}` : API_V1.warzoneTasks;
}

/** Parse v1 `{ data }` or legacy `{ tasks|task }` bodies. */
export function unwrapData(body, legacyKey) {
  if (body?.data !== undefined) return body.data;
  if (legacyKey && body?.[legacyKey] !== undefined) return body[legacyKey];
  return body;
}
