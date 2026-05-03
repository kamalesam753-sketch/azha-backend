/**
 * Wraps async route handlers to catch errors automatically.
 * Eliminates try/catch boilerplate in every controller.
 */
function asyncHandler(fn) {
  return function (req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = asyncHandler;
