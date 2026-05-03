/**
 * Standardized API response helpers.
 * Every API response passes through these for consistency.
 */

function success(res, data, message, statusCode) {
  return res.status(statusCode || 200).json({
    success: true,
    message: message || "OK",
    data: data !== undefined ? data : null
  });
}

function fail(res, message, statusCode, errors) {
  const body = {
    success: false,
    message: message || "Request failed"
  };
  if (errors) body.errors = errors;
  return res.status(statusCode || 400).json(body);
}

function paginated(res, data, total, page, limit) {
  return res.status(200).json({
    success: true,
    data,
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit)
    }
  });
}

module.exports = { success, fail, paginated };
