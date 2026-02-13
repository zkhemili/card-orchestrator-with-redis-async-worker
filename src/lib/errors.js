export function httpError(message, statusCode = 500, details) {
  const err = new Error(message);
  err.statusCode = statusCode;
  if (details !== undefined) err.details = details;
  return err;
}

export function getStatusCode(err) {
  const code = Number(err?.statusCode);
  return Number.isFinite(code) ? code : 500;
}

export async function fetchTextSafe(res) {
  try {
    return await res.text();
  } catch {
    return "";
  }
}