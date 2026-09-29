# Market Radar PWA — V1

App personal, estática e instalable en Android. No requiere backend.

## Qué hace
- Sigue 10 bloques: MSCI World, S&P 500, World Value, EM Value, World IT, AI Infrastructure, Defense, Uranium/Nuclear, Strategic Metals y Gold.
- Descarga precios diarios de EODHD.
- Opcionalmente usa FRED para VIX, high-yield spread y curva 10Y-2Y.
- Calcula MA50/MA200, RSI, momentum, drawdown, tendencia y Opportunity Score.
- Genera ranking mensual y reparto indicativo del DCA.
- Guarda configuración y datos sólo en el navegador.

## Importante
La V1 NO incorpora todavía valoración histórica específica por índice ni breadth fiable. El score actual pondera 55% tendencia, 25% drawdown y 20% macro. Esto es deliberado: no se simulan datos que no tengamos.

Los tickers EODHD incluidos son proxies/listados de referencia y pueden requerir ajuste según la cobertura de tu plan EODHD. Si un ticker falla, edítalo en `ASSETS` dentro de app.js.

## Ejecutar localmente
Una PWA necesita HTTP(S), no abrir `index.html` como file://.

Con Python:
```
python -m http.server 8080
```
Luego abre http://localhost:8080

## Publicar gratis
Sube esta carpeta a Cloudflare Pages, Netlify, Vercel o GitHub Pages como sitio estático. No hay build step.

## Android
Abre la URL publicada en Chrome > menú > "Añadir a pantalla de inicio" / "Instalar aplicación".

## Próxima V2 recomendada
1. Validar tickers y cobertura EODHD de los 10 vehículos.
2. Añadir series de valoración histórica por índice/fondo.
3. Añadir breadth y sentimiento con fuentes estables.
4. Implementar backtest walk-forward/out-of-sample contra DCA y DCA+rebalanceo.
5. Sólo después recalibrar pesos y umbrales del score.
