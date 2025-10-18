const formatDate = (d) => {
  if (!d) return null;
  const dt = new Date(d);
  return dt.toISOString().replace('T', ' ').replace('Z', '');
};

const paginate = (page = 1, limit = 20) => {
  const p = Math.max(1, parseInt(page, 10) || 1);
  const l = Math.max(1, parseInt(limit, 10) || 20);
  return { offset: (p - 1) * l, limit: l };
};

const respond = (res, data, status = 200) => res.status(status).json({ data });

module.exports = { formatDate, paginate, respond };
