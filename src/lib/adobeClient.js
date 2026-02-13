import querystring from "querystring";
import { httpError, fetchTextSafe } from "./errors.js";

const INDESIGN_MERGE_URL = "https://indesign.adobe.io/v3/merge-data";

export function createAdobeClient({ clientId, clientSecret }) {
  async function getAccessToken() {
    const tokenUrl = "https://ims-na1.adobelogin.com/ims/token/v3";

    const body = querystring.stringify({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
      scope:
        "openid,AdobeID,session,additional_info,read_organizations,firefly_api,ff_apis,indesign_services,cc_files,cc_libraries,creative_cloud,creative_sdk,indesign_sdk"
    });

    const res = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body
    });

    if (!res.ok) {
      const text = await fetchTextSafe(res);
      throw httpError(`Token request failed: ${res.status} ${res.statusText} ${text}`, 502);
    }

    const data = await res.json().catch(() => null);
    if (!data?.access_token) throw httpError("Token response missing access_token", 502);
    return data.access_token;
  }

  async function submitMerge({ assets, params, accessToken }) {
    const payload = { assets, params };

    const res = await fetch(INDESIGN_MERGE_URL, {
      method: "POST",
      headers: {
        "x-api-key": clientId,
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const text = await fetchTextSafe(res);
      throw httpError(`Data merge submit failed: ${res.status} ${res.statusText} ${text}`, 502);
    }

    const data = await res.json().catch(() => null);
    if (!data?.statusUrl) throw httpError("Merge response missing statusUrl", 502);

    return { jobId: data.jobId, statusUrl: data.statusUrl, cancelUrl: data.cancelUrl };
  }

  async function pollStatus(statusUrl, accessToken, { intervalMs, timeoutMs }) {
    const start = Date.now();

    while (true) {
      const res = await fetch(statusUrl, {
        method: "GET",
        headers: {
          "x-api-key": clientId,
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`
        }
      });

      if (!res.ok) {
        const text = await fetchTextSafe(res);
        throw httpError(`Failed to fetch job status: ${res.status} ${res.statusText} ${text}`, 502);
      }

      const data = await res.json().catch(() => null);
      const status = data?.status;

      if (status === "succeeded" || status === "failed") return data;

      if (Date.now() - start > timeoutMs) throw httpError("Job polling timed out", 504);

      await new Promise((r) => setTimeout(r, intervalMs));
    }
  }

  return { getAccessToken, submitMerge, pollStatus };
}