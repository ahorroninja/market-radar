import test from "node:test";
import assert from "node:assert/strict";
import { fetchMacroHistories } from "../../src/data/macro-provider.js";
const settings = { dataProvider: { baseUrl: "https://example.test" } };
test("macro HTTP diagnostics distinguish route, key and temporary failures", async () => {
  for (const [status, error, message] of [
    [404, null, /ruta \/macro/],
    [422, "FRED_KEY_REJECTED", /clave API/],
    [502, "FRED_TEMPORARY", /histórico anterior/],
    [502, "FRED_RATE_LIMIT", /limita las consultas/],
    [502, null, /no ha podido responder/],
  ]) {
    await assert.rejects(
      () =>
        fetchMacroHistories(settings, async () =>
          Response.json({ error }, { status }),
        ),
      (e) => message.test(e.message) && e.message.includes("VIXCLS"),
    );
  }
});
