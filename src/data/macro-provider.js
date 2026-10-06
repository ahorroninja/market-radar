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
    if (!res.ok) {
      let error;
      try {
        error = (await res.json()).error;
      } catch {}
      const detail =
        error === "FRED_KEY_REJECTED"
          ? "FRED rechaza la clave API. Revisa la clave en Ajustes."
          : error === "FRED_RATE_LIMIT"
            ? "FRED limita las consultas. Vuelve a intentarlo más tarde."
            : error === "FRED_REQUEST_REJECTED"
              ? "FRED rechaza la consulta; revisa la configuración de la API."
              : res.status === 404
                ? "No se encuentra la ruta /macro. Revisa la URL del Worker en Ajustes."
                : res.status === 400
                  ? "Petición o formato de clave inválido. Revisa Ajustes."
                  : "FRED no ha podido responder. Vuelve a actualizar; el histórico anterior se conserva.";
      throw new Error(
        `Macro FRED (${seriesId}): HTTP ${res.status}. ${detail}`,
      );
    }
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
