import { format } from "fast-csv";
import mime from "mime-types";

export async function buildOneRowCsvBuffer({ headers, rowObject }) {
  return await new Promise((resolve, reject) => {
    const chunks = [];
    const csvStream = format({ headers });

    csvStream.on("data", (chunk) => chunks.push(chunk));
    csvStream.on("end", () => resolve(Buffer.concat(chunks)));
    csvStream.on("error", reject);

    csvStream.write(rowObject);
    csvStream.end();
  });
}

export function guessContentType(assetKey) {
  return mime.lookup(assetKey) || "application/octet-stream";
}