/**
 * Request validation middleware factory.
 * Validates req.body, req.query, or req.params against simple schema objects.
 *
 * Schema format: { fieldName: { required, type, min, max, enum, pattern } }
 */
const { AppError } = require("./errorHandler");

function validate(schema, source) {
  source = source || "body";

  return function (req, _res, next) {
    const data = req[source] || {};
    const errors = [];

    for (const [field, rules] of Object.entries(schema)) {
      const value = data[field];
      const strValue = String(value || "").trim();

      if (rules.required && (!value || strValue === "")) {
        errors.push(`${field} is required`);
        continue;
      }

      if (value === undefined || value === null || strValue === "") continue;

      if (rules.type === "string" && typeof value !== "string") {
        errors.push(`${field} must be a string`);
      }

      if (rules.min && strValue.length < rules.min) {
        errors.push(`${field} must be at least ${rules.min} characters`);
      }

      if (rules.max && strValue.length > rules.max) {
        errors.push(`${field} must be at most ${rules.max} characters`);
      }

      if (rules.enum && !rules.enum.includes(strValue)) {
        errors.push(`${field} must be one of: ${rules.enum.join(", ")}`);
      }

      if (rules.pattern && !rules.pattern.test(strValue)) {
        errors.push(`${field} format is invalid`);
      }
    }

    if (errors.length > 0) {
      return next(new AppError(errors[0], 400));
    }

    next();
  };
}

module.exports = validate;
