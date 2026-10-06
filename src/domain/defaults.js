export const APP_VERSION = "3.0.7";
export const DEFAULT_SETTINGS = Object.freeze({
  monthlyContribution: 1000,
  holdings: {},
  reserve: 0,
  macroEnabled: true,
  credentials: { fredKey: "" },
  targetBasis:
    "Proporciones originales del Radar (84 puntos), normalizadas al 100% del dinero destinado a estos ETFs. Reserva fuera del reparto.",
  dataProvider: {
    type: "yahoo-worker",
    baseUrl: "https://market-radar.ahorradorninja.workers.dev",
    symbols: {},
  },
  smartDcaPolicy: {
    drawdownStrength: 1,
    underweightStrength: 0.35,
    maxContributionShare: 0.4,
    useMacro: false,
    macroStrength: 0.5,
  },
  assets: [
    {
      id: "world",
      name: "MSCI World",
      enabled: true,
      targetWeight: 25 / 84,
      symbols: { yahoo: "SWDA.L" },
    },
    {
      id: "sp500",
      name: "S&P 500",
      enabled: true,
      targetWeight: 5 / 84,
      symbols: { yahoo: "CSPX.L" },
    },
    {
      id: "value",
      name: "World Value",
      enabled: true,
      targetWeight: 15 / 84,
      symbols: { yahoo: "IWVL.L" },
    },
    {
      id: "em-value",
      name: "Emerging Markets Value",
      enabled: true,
      targetWeight: 10 / 84,
      symbols: { yahoo: "EMVL.L" },
    },
    {
      id: "world-tech",
      name: "World Information Technology",
      enabled: true,
      targetWeight: 5 / 84,
      symbols: { yahoo: "XDWT.L" },
    },
    {
      id: "ai-infra",
      name: "AI Infrastructure",
      enabled: true,
      targetWeight: 5 / 84,
      symbols: { yahoo: "AINF.L" },
    },
    {
      id: "defense",
      name: "Defense",
      enabled: true,
      targetWeight: 4 / 84,
      symbols: { yahoo: "DFNS.L" },
    },
    {
      id: "nuclear",
      name: "Nuclear / Uranium",
      enabled: true,
      targetWeight: 4 / 84,
      symbols: { yahoo: "NCLR.L" },
    },
    {
      id: "metals",
      name: "Strategic Metals",
      enabled: true,
      targetWeight: 3 / 84,
      symbols: { yahoo: "WENU.L" },
    },
    {
      id: "gold",
      name: "Gold",
      enabled: true,
      targetWeight: 8 / 84,
      symbols: { yahoo: "SGLN.L" },
    },
  ],
});
export function freshSettings() {
  return structuredClone(DEFAULT_SETTINGS);
}
