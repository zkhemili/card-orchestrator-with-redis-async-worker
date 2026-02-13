import { httpError, fetchTextSafe } from "./errors.js";

function safeKeyPath(assetKey) {
  return String(assetKey).split("/").map(encodeURIComponent).join("/");
}

export function createCcS3Client({ baseUrl, apiKey }) {
  async function json(path, method, body) {
    const url = `${baseUrl}${path}`;
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json", "x-api-key": apiKey },
      body: body ? JSON.stringify(body) : undefined
    });

    if (!res.ok) {
      const text = await fetchTextSafe(res);
      throw httpError(`${method} ${url} failed: ${res.status} ${res.statusText} ${text}`, 502);
    }
    return res.json();
  }

  async function getUploadUri(assetKey) {
    const data = await json("/assets", "POST", { keyName: assetKey });
    if (!data?.uploadUri) throw httpError(`POST /assets missing uploadUri (assetKey=${assetKey})`, 502);
    return data.uploadUri;
  }

  async function putToUploadUri(uploadUri, bytes, contentType) {
    const res = await fetch(uploadUri, {
      method: "PUT",
      headers: contentType ? { "Content-Type": contentType } : undefined,
      body: bytes
    });
    if (!res.ok) {
      const text = await fetchTextSafe(res);
      throw httpError(`PUT uploadUri failed: ${res.status} ${res.statusText} ${text}`, 502);
    }
  }

  async function getDownloadUri(assetKey) {
    const url = `${baseUrl}/assets/${safeKeyPath(assetKey)}`;
    const res = await fetch(url, { method: "GET", headers: { "x-api-key": apiKey } });
    if (!res.ok) {
      const text = await fetchTextSafe(res);
      throw httpError(`GET ${url} failed: ${res.status} ${res.statusText} ${text}`, 502);
    }
    const data = await res.json().catch(() => null);
    if (!data?.downloadUri) throw httpError(`Missing downloadUri (assetKey=${assetKey})`, 502);
    return data.downloadUri;
  }

  return { getUploadUri, putToUploadUri, getDownloadUri };
}