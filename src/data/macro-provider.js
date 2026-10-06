import { MACRO_IDS } from "../core/macro.js";
export async function fetchMacroHistories(settings, fetchImpl = fetch) {
  const url = settings.dataProvider.baseUrl.replace(/\/$/, "") + "/macro";
  const apiKey = settings.credentials?.fredKey || "";
  const histories = {};
  for (const seriesId of MACRO_IDS) {
    const res = await fetchImpl(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ seriesId, apiKey }),
      signal: AbortSignal.timeout(45000),
    });
    if (!res.ok)
      throw new Error(
        `Macro FRED: HTTP ${res.status}. El Worker debe incluir la ruta /macro de V3.`,
      );
    const payload = await res.json();
    if (
      payload.seriesId !== seriesId ||
      !["vintage", "revised"].includes(payload.basis) ||
      !Array.isArray(payload.points) ||
      !payload.points.length
    )
      throw new Error("Serie macro inválida.");
    histories[seriesId] = payload;
  }
  return histories;
}
