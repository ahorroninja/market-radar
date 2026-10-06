# Market Radar 3.0

PWA personal para ETFs e índices. Frontend estático, información del usuario local y precios Yahoo Finance mediante el Worker existente. No utiliza Stooq.

- Radar: cierres ajustados en EUR, medias 50/200, RSI de Wilder 14, momentum 252 y drawdown de 252 sesiones. Scores técnicos heurísticos con desglose de fuentes ausentes.
- Comprar: pesos objetivo, caída e infraponderación; cantidades enteras que suman exactamente la aportación. Reserva extra sólo a elección del usuario; nunca ventas.
- Backtest: DCA objetivo, rebalanceo con nuevas aportaciones y el mismo Smart DCA de producción. Decisión antes del cierre de ejecución, capital y flujos separados, TWR/XIRR/drawdown del rendimiento/volatilidad/Sharpe, ledger y ventanas móviles.
- Ajustes: cartera, símbolos, pesos, política y copias completas. Migración del estado antiguo sin publicar posiciones o credenciales.
- Histórico en IndexedDB; caché offline de los módulos. Actualización al abrir si la última descarga supera 20 horas, o manual.

## Ejecutar y comprobar

```sh
npm test
python -m http.server 5173
```

## Worker

`worker/src/index.js` mantiene `/chart` (Yahoo) y añade `/macro` (FRED). FRED sin clave entrega series revisadas sólo para contexto actual; con la clave local se solicitan observaciones con períodos de vigencia históricos. Las claves viajan en el cuerpo de la petición al Worker del usuario, no en URLs, Git o archivos de configuración publicados. No se almacenan en el Worker.

El ensayo macro se bloquea si no dispone de datos vintage adecuados. La ventaja histórica de una política no demuestra su superioridad futura.

Ver [auditoría de evolución](docs/PROJECT_EVOLUTION_AUDIT.md) y [contratos actuales](docs/PRODUCT_SPEC_V3.md).
