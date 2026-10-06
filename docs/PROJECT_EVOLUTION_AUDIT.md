# Market Radar — auditoría y reconstrucción 3.0

## Evidencia y alcance

Se contrastaron las ramas y el historial completo del repositorio, el backup del 30/09, el estado exportado, el contexto recuperado del chat y el Worker Yahoo en funcionamiento. No se ha accedido al historial privado de despliegues de Cloudflare. No hay un lanzamiento de aplicación independiente llamado 2.5.2 en Git: el número `252` corresponde al cache-busting de la 2.5.1.

## Evolución comprobada

| Etapa                 | Aportación útil                                                 | Problema observado en el código                                                                                                                                                                                        |
| --------------------- | --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| V1 / V2               | 10 bloques, indicadores, posiciones y reparto mensual           | Pesos suman 84; no se explica la base del reparto. Macro ausente se convierte en 50.                                                                                                                                   |
| V2.1                  | Histórico incremental y cálculo local                           | Se concatenan ajustes de proveedores/fechas sin garantizar homogeneidad de ajustes.                                                                                                                                    |
| V2.2                  | Yahoo mediante Worker Cloudflare                                | Solución correcta al acceso del navegador; se conserva.                                                                                                                                                                |
| V2.3 / V2.4           | Comparación de DCA, rebalanceo y Radar; TWR/XIRR y rolling      | El cierre de ejecución entra en el conjunto de decisión. Métricas de flujos y drawdown inconsistentes.                                                                                                                 |
| V2.5                  | Macro histórico y cuatro estrategias                            | La fecha de observación FRED se confunde con publicación. Series revisadas se usan como pasado; NFCI puede revisarse. El warm-up calculado no se entrega a la simulación.                                              |
| V2.5.1 (assets `252`) | Diagnósticos por activo; conserva caché si no hay vela nueva    | Sustituciones sucesivas de funciones globales; el renderer de backtest reemplaza el contenedor y puede perder navegación.                                                                                              |
| V2.6                  | Intento de aplicación independiente, rollback y numerosos gates | El `v26.js` conservado en main tiene expresiones como `$('#btUniverse']`, sintácticamente inválidas. No es una base reutilizable.                                                                                      |
| V3 RC1/RC2/RC3        | Motor modular y pruebas de invariantes                          | Stooq se introduce sin necesidad; vuelve Yahoo pero Ajustes sigue diciendo Stooq. Se pierden macro, rolling y métricas visibles; cambian pesos y ETFs. El drawdown pasa de 252 sesiones a máximo de todo el histórico. |

Las pruebas existentes verificaban contratos parciales, pero no la continuidad funcional con la 2.5.1. Por eso una suite verde no demostraba que el producto estuviera completo.

## Decisiones para 3.0

- Mantener la web, el Worker Yahoo y la PWA; cero Stooq y cero capas de parche global.
- Recuperar los 10 símbolos originales y las proporciones originales. Los 84 puntos se normalizan explícitamente al 100% del dinero dedicado a los ETFs del Radar. No se supone que el 16 restante sea efectivo.
- Recuperar configuración, posiciones, reserva y claves locales de `mr_state`/backups. No publicar datos personales ni claves en Git.
- No reutilizar series heredadas sin divisa/símbolo trazables. Se descargan de nuevo de Yahoo y se guardan en IndexedDB.
- RSI de Wilder 14 (la 2.5.1 usaba medias simples), medias 50/200, momentum 252 sesiones, drawdown desde máximo de 252 sesiones. Las diferencias de RSI respecto de 2.5.1 son deliberadas y se etiquetan.
- Precios ajustados por dividendos/splits, sin mezclar cierres sin ajustar cuando falta un dato ajustado; excluir la sesión que no ha terminado.
- Conversión histórica a EUR, incluida distinción GBP/GBp. Tipo de cambio igual o anterior a la observación, con máximo 7 días de antigüedad.
- Conservar la fórmula de tendencia técnica de la 2.5.1, etiquetándola como heurística. Score técnico = (55×tendencia + 25×draw-score)/80; con macro disponible, compuesto 55/25/20. No se presentan como valoración fundamental ni como probabilidades.
- Mantener el motor Smart DCA compartido entre Comprar y Backtest: objetivo como ancla, caída y déficit como ajustes, euros enteros, sin ventas. La reserva sólo entra si el usuario elige un importe extra.
- Comparar DCA objetivo, rebalanceo con aportaciones y Smart DCA. El cuarto ensayo macro exige vintages FRED; si no existen no se calcula con datos revisados ni con una macro ficticia de 50.
- Rolling por ventanas completas de 1/2/3 años, paso de 12 meses, mismo calentamiento y aviso de muestra inferior a 5/solapamiento.

## Límites explícitos

- Los datos Yahoo son la historia ajustada disponible hoy. No existe aquí una base de datos de precios vintage ni corrección por sesgo de supervivencia del universo elegido.
- El ensayo no incluye gastos, fiscalidad, intereses de la reserva o impacto de mercado.
- El componente macro opcional es experimental; no ha sido optimizado para ganar el backtest y está desactivado por defecto en las compras.
- Valoración fundamental y amplitud del índice requieren otras fuentes: se muestran ausentes, nunca sustituidas por drawdown/RSI.
- Para habilitar FRED desde el navegador, el Worker necesita la ruta `/macro`. El código actualizado está en `worker/src/index.js`; su disponibilidad se comprueba por `/health` (`version: 3.0.0`, `macro: true`).
