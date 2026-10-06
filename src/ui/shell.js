export const NAV_ITEMS = Object.freeze([
  { id: "radar", label: "Radar", icon: "◉" },
  { id: "buy", label: "Comprar", icon: "+" },
  { id: "backtest", label: "Backtest", icon: "↺" },
  { id: "settings", label: "Ajustes", icon: "⚙" },
]);
export function normalizeRoute(route) {
  return NAV_ITEMS.some((x) => x.id === route) ? route : "radar";
}
export function createShell(
  root,
  { initialRoute = "radar", onRouteChange = () => {} } = {},
) {
  if (!(root instanceof Element))
    throw new TypeError("Shell root must be a DOM Element");
  root.innerHTML = `<div class="app-shell"><header class="topbar"><div><strong>Market Radar</strong><small>V3</small></div><span id="app-status" aria-live="polite"></span></header><main id="view-outlet" class="view-outlet"></main><nav class="bottom-nav" aria-label="Navegación principal">${NAV_ITEMS.map((x) => `<button type="button" data-route="${x.id}" aria-label="${x.label}"><span class="nav-icon" aria-hidden="true">${x.icon}</span><span>${x.label}</span></button>`).join("")}</nav></div>`;
  const outlet = root.querySelector("#view-outlet"),
    buttons = [...root.querySelectorAll("[data-route]")];
  let route = normalizeRoute(initialRoute);
  function select(next) {
    route = normalizeRoute(next);
    for (const b of buttons) {
      const active = b.dataset.route === route;
      b.classList.toggle("active", active);
      b.setAttribute("aria-current", active ? "page" : "false");
    }
    onRouteChange(route, outlet);
  }
  for (const b of buttons)
    b.addEventListener("click", () => select(b.dataset.route));
  select(route);
  return {
    get route() {
      return route;
    },
    outlet,
    navigate: select,
    setStatus(text = "") {
      root.querySelector("#app-status").textContent = text;
    },
    destroy() {
      root.innerHTML = "";
    },
  };
}
