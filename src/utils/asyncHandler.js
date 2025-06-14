const asyncHandler = (fn) => async (req, res, next) => {
  try {
    await fn(req, res, next);
  } catch (error) {
    // Check if error.statusCode is a valid HTTP status code (between 100-999)
    const statusCode = error.statusCode || error.status || 500;
    res.status(statusCode).json({
      success: false,
      message: error.message || "Internal Server Error",
    });
  }
};

export default asyncHandler;
