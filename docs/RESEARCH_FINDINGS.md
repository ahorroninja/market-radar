# Evaluación de asignación y reserva — 6 de octubre de 2026

La evaluación no demuestra una ventaja consistente de Smart DCA. No se han modificado los pesos, las intensidades ni la configuración del usuario para mejorar el histórico. La herramienta incorpora costes y efectivo y hace visibles las nueve variantes y sus resultados temporales.

## Escenario neto con reserva

Hipótesis ilustrativas: 1.000 €/mes, 6.000 € disponibles al inicio, efectivo al 2% anual constante, 1 €/orden, comisión variable 0,05% y deslizamiento 0,05%. La referencia invierte los 6.000 € al inicio. La alternativa de reserva sigue el protocolo fijo, sin reponerla. Cada universo normaliza las proporciones originales de los activos incluidos; son carteras distintas y sus resultados no se comparan entre sí.

## core4

SWDA.L, CSPX.L, IWVL.L, EMVL.L. 2019-12-13 a 2026-10-02.

| Regla                       | Patrimonio final | Diferencia frente a DCA | Primer bloque: diferencia | Segundo bloque: diferencia | Ventanas favorables |
| --------------------------- | ---------------: | ----------------------: | ------------------------: | -------------------------: | ------------------: |
| DCA objetivo                |        171.391 € |                     0 € |                       0 € |                        0 € |                 0/4 |
| Rebalanceo por aportaciones |        171.980 € |                   589 € |                     143 € |                     -403 € |                 4/4 |
| Sólo caída                  |        171.504 € |                   112 € |                      13 € |                      -59 € |                 4/4 |
| Sólo infraponderación       |        171.533 € |                   142 € |                       7 € |                       11 € |                 3/4 |
| Smart DCA configurado       |        171.622 € |                   230 € |                      17 € |                      -41 € |                 4/4 |
| Caída suave (0,5)           |        171.580 € |                   189 € |                      12 € |                      -17 € |                 3/4 |
| Caída intensa (2)           |        171.704 € |                   313 € |                      26 € |                      -79 € |                 4/4 |
| DCA + reserva escalonada    |        172.919 € |                 1.528 € |                     724 € |                   -2.148 € |                 2/4 |
| Smart + reserva escalonada  |        173.176 € |                 1.785 € |                     747 € |                   -2.195 € |                 2/4 |

Los bloques temporales reinician el mismo capital; sus diferencias no suman la diferencia del período completo. Ventanas de tres años con paso anual, solapadas y descriptivas. Cuatro ventanas: muestra insuficiente.

## long3

SWDA.L, CSPX.L, IWVL.L. 2015-10-05 a 2026-10-02.

| Regla                       | Patrimonio final | Diferencia frente a DCA | Primer bloque: diferencia | Segundo bloque: diferencia | Ventanas favorables |
| --------------------------- | ---------------: | ----------------------: | ------------------------: | -------------------------: | ------------------: |
| DCA objetivo                |        323.242 € |                     0 € |                       0 € |                        0 € |                 0/8 |
| Rebalanceo por aportaciones |        325.750 € |                 2.508 € |                    -249 € |                       17 € |                 5/8 |
| Sólo caída                  |        323.247 € |                     5 € |                     -66 € |                      -71 € |                 3/8 |
| Sólo infraponderación       |        323.561 € |                   319 € |                     -12 € |                       43 € |                 4/8 |
| Smart DCA configurado       |        323.517 € |                   275 € |                     -64 € |                      -34 € |                 4/8 |
| Caída suave (0,5)           |        323.538 € |                   296 € |                     -38 € |                        1 € |                 4/8 |
| Caída intensa (2)           |        323.484 € |                   242 € |                    -110 € |                      -96 € |                 4/8 |
| DCA + reserva escalonada    |        322.446 € |                  -796 € |                    -383 € |                   -1.133 € |                 2/8 |
| Smart + reserva escalonada  |        322.736 € |                  -507 € |                    -436 € |                   -1.184 € |                 2/8 |

Los bloques temporales reinician el mismo capital; sus diferencias no suman la diferencia del período completo. Ventanas de tres años con paso anual, solapadas y descriptivas.

## Qué podemos concluir

- El beneficio de Smart DCA sobre DCA en el período completo es pequeño: unos 230 € en Core 4 y 275 € en el universo más largo, frente a patrimonios de 171.391 € y 323.242 €. Las diferencias son inferiores al 0,15% del patrimonio final y no se repiten en ambos bloques temporales.
- La inclinación por caída por sí sola aporta aproximadamente 112 € en Core 4 y 5 € en el histórico más largo, y pierde en el segundo bloque de ambos. No hay fundamento para intensificarla buscando mayor rentabilidad.
- El rebalanceo por aportaciones obtiene más diferencia en el período completo, pero tampoco supera a DCA en todos los bloques. Es una alternativa sencilla que merece seguimiento, no un ganador confirmado.
- La reserva escalonada mejora el ensayo iniciado en diciembre de 2019, antes de la caída de 2020, pero pierde en el universo largo y en el segundo bloque de ambos. Su resultado depende mucho del punto inicial. No se convierte en recomendación de mantener efectivo.
- Con reserva cero, las variantes de reserva deben coincidir con las correspondientes variantes inmediatas; el escenario sin costes confirma esta identidad. Todos los resultados, incluidos los de sensibilidad, se conservan en el JSON.
- No se incorporan tendencia, fundamentales o macro a Comprar sobre la base de estos resultados. El score completo sigue incompleto. No se prometen resultados más rentables.

## Comprobación y reproducción

El escenario neto incluye costes de la compra inicial; TWR cuenta también ese gasto cuando no hay capital anterior. El patrimonio incluye el efectivo y sus intereses. Tests con precios constantes, orden inasequible, reserva y caída en el día de ejecución verifican conservación del dinero y ausencia de anticipación.

Para repetir el estudio con un backup V3 de históricos Yahoo EUR:

```sh
node scripts/evaluate-research.mjs backup.json docs/RESEARCH_RESULTS.json
```

El script ignora posiciones, claves y ajustes privados del backup; usa proporciones originales y las hipótesis del protocolo. El SHA-256 del conjunto de históricos permite identificar si se usó el mismo input. Una descarga posterior de Yahoo puede contener revisiones y dar cifras distintas.

Resultados completos: [RESEARCH_RESULTS.json](RESEARCH_RESULTS.json). Reglas y límites: [RESEARCH_PROTOCOL.md](RESEARCH_PROTOCOL.md).

La evaluación es retrospectiva, no una prueba fuera de muestra verdaderamente desconocida. Yahoo aporta historia ajustada actual, el universo se eligió después de existir y varias ventanas se solapan. No se han modelado participaciones enteras, impuestos personales ni tipos históricos del efectivo.
