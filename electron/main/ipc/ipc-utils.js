/**
 * Wraps an IPC handler function so that all responses use a consistent
 * { success, data, error } envelope. Exceptions are caught and returned
 * as { success: false, error: message } rather than crashing the handler.
 *
 * @param {Function} fn  The handler implementation to wrap
 * @returns {Function}   An async function returning { success, data?, error? }
 */
function wrapHandler(fn) {
  return async (...args) => {
    try {
      const data = await fn(...args);
      return { success: true, data: data ?? null };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[IPC] Handler error:', message, err instanceof Error ? err.stack : '');
      return { success: false, error: message };
    }
  };
}

module.exports = { wrapHandler };
