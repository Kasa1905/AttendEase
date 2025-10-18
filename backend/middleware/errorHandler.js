module.exports = function (err, req, res, next) {
  console.error(err);
  if (res.headersSent) return next(err);
  const status = err.status || 500;
  const response = { message: err.message || 'Internal Server Error' };
  if (process.env.NODE_ENV !== 'production') response.stack = err.stack;
  res.status(status).json({ error: response });
};
