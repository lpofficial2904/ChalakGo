import { Router as ExpressRouter } from "express";

// Express 4 needs rejected async handlers forwarded to error middleware.
export function Router() {
  const router = ExpressRouter();
  for (const method of ["get", "post", "put", "patch", "delete"]) {
    const register = router[method].bind(router);
    router[method] = (path, ...handlers) =>
      register(
        path,
        ...handlers.flat().map((handler) => (req, res, next) => {
          try {
            Promise.resolve(handler(req, res, next)).catch(next);
          } catch (error) {
            next(error);
          }
        }),
      );
  }
  return router;
}

export function apiErrorHandler(error, _req, res, next) {
  if (res.headersSent) return next(error);
  if (error.code === 11000)
    return res
      .status(409)
      .json({
        message: "This value already exists. Use a unique slug or identifier.",
      });
  if (error.name === "CastError" || error.name === "ValidationError")
    return res
      .status(400)
      .json({
        message:
          error.name === "CastError"
            ? "Invalid record ID or field value. Refresh the page and try again."
            : error.message,
      });
  const status =
    Number.isInteger(error.status) && error.status >= 400 && error.status < 600
      ? error.status
      : 500;
  res
    .status(status)
    .json({
      message:
        status === 500
          ? "Unable to complete the request. Please retry."
          : error.message,
    });
}
