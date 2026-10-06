# Estudio con activos de histórico útil superior a cinco años

Fecha: 6 de octubre de 2026. Mismo input Yahoo EUR y protocolo allocation-reserve-1 del estudio anterior. Se seleccionan por duración real tras 252 sesiones de calentamiento, no por rentabilidad obtenida. No se modifican los pesos de la cartera real.

## Selección

| Activo                       | Símbolo | Primer precio EUR | Inicio utilizable después de 252 sesiones | Incluido >5 años |
| ---------------------------- | ------- | ----------------- | ----------------------------------------- | ---------------- |
| MSCI World                   | SWDA.L  | 2009-09-25        | 2010-09-24                                | Sí               |
| S&P 500                      | CSPX.L  | 2010-09-15        | 2011-09-14                                | Sí               |
| World Value                  | IWVL.L  | 2014-10-06        | 2015-10-05                                | Sí               |
| Emerging Markets Value       | EMVL.L  | 2018-12-06        | 2019-12-13                                | Sí               |
| World Information Technology | XDWT.L  | 2010-11-22        | 2011-11-29                                | Sí               |
| AI Infrastructure            | AINF.L  | 2024-12-09        | 2025-12-08                                | No               |
| Defense                      | DFNS.L  | 2023-03-31        | 2024-04-03                                | No               |
| Nuclear / Uranium            | NCLR.L  | 2025-03-10        | 2026-03-09                                | No               |
| Strategic Metals             | WENU.L  | 2025-01-07        | 2026-01-06                                | No               |
| Gold                         | SGLN.L  | 2011-04-08        | 2012-04-10                                | Sí               |

Último cierre del snapshot: 2026-10-02. La divisa y los peniques se normalizaron antes del estudio. Se mantienen las proporciones originales entre los activos incluidos, normalizadas al 100% del capital del ensayo.

## Resultados netos

Hipótesis ilustrativas idénticas: 1.000 €/mes, 6.000 € disponibles desde el inicio, interés del efectivo del 2% constante, comisión fija de 1 €/orden, comisión variable de 0,05% y deslizamiento de 0,05%. No son posiciones privadas ni tarifas reales del bróker.

### useful-over5

Símbolos: SWDA.L, CSPX.L, IWVL.L, EMVL.L, XDWT.L, SGLN.L.

Período común: 2019-12-13 a 2026-10-02.

| Regla                       | Patrimonio final neto | Diferencia frente a DCA | Primer bloque | Segundo bloque | Ventanas favorables de 3 años |
| --------------------------- | --------------------: | ----------------------: | ------------: | -------------: | ----------------------------: |
| DCA objetivo                |             174.888 € |                     0 € |           0 € |            0 € |                           0/4 |
| Rebalanceo por aportaciones |             176.234 € |                 1.346 € |         284 € |          128 € |                           4/4 |
| Sólo caída                  |             175.143 € |                   255 € |          58 € |          -10 € |                           4/4 |
| Sólo infraponderación       |             175.069 € |                   181 € |          17 € |           25 € |                           4/4 |
| Smart DCA configurado       |             175.265 € |                   377 € |          71 € |            8 € |                           4/4 |
| Caída suave (0,5)           |             175.172 € |                   284 € |          44 € |           17 € |                           4/4 |
| Caída intensa (2)           |             175.429 € |                   541 € |         115 € |           -1 € |                           4/4 |
| DCA + reserva escalonada    |             175.743 € |                   856 € |         416 € |       -2.264 € |                           2/4 |
| Smart + reserva escalonada  |             176.136 € |                 1.248 € |         496 € |       -2.260 € |                           2/4 |

Las ventanas se solapan. Cada bloque reinicia el mismo capital, por lo que las diferencias de los bloques no suman la del período completo.

### useful-over10

Símbolos: SWDA.L, CSPX.L, IWVL.L, XDWT.L, SGLN.L.

Período común: 2015-10-05 a 2026-10-02.

| Regla                       | Patrimonio final neto | Diferencia frente a DCA | Primer bloque | Segundo bloque | Ventanas favorables de 3 años |
| --------------------------- | --------------------: | ----------------------: | ------------: | -------------: | ----------------------------: |
| DCA objetivo                |             348.571 € |                     0 € |           0 € |            0 € |                           0/8 |
| Rebalanceo por aportaciones |             347.976 € |                  -595 € |        -331 € |          644 € |                           6/8 |
| Sólo caída                  |             348.595 € |                    24 € |         -44 € |          127 € |                           6/8 |
| Sólo infraponderación       |             348.872 € |                   302 € |           2 € |           48 € |                           6/8 |
| Smart DCA configurado       |             348.837 € |                   266 € |         -46 € |          159 € |                           6/8 |
| Caída suave (0,5)           |             348.858 € |                   287 € |         -22 € |          102 € |                           6/8 |
| Caída intensa (2)           |             348.789 € |                   218 € |         -99 € |          263 € |                           6/8 |
| DCA + reserva escalonada    |             347.193 € |                -1.378 € |        -568 € |       -1.328 € |                           2/8 |
| Smart + reserva escalonada  |             347.510 € |                -1.061 € |        -605 € |       -1.190 € |                           2/8 |

Las ventanas se solapan. Cada bloque reinicia el mismo capital, por lo que las diferencias de los bloques no suman la del período completo.

## Interpretación

- Los seis activos con más de cinco años permiten un período común de casi siete años. Emerging Markets Value limita el inicio a diciembre de 2019. No se puede probar 2008 con estos mismos ETFs sin emplear otras series, cosa que este estudio no hace.
- Smart DCA mejora 377 € respecto de 174.888 € del DCA: aproximadamente 0,22% del patrimonio final acumulado, no una ventaja anual de 0,22%. Sus dos bloques tienen diferencias positivas, pero pequeñas: 71 € y 8 €. Sólo hay cuatro ventanas completas de tres años, insuficientes para una conclusión robusta.
- El rebalanceo por aportaciones mejora 1.346 € en el período completo, gana en los dos bloques y las cuatro ventanas. Es el candidato sencillo más prometedor en este universo, pero no una superioridad confirmada.
- Para comprobar un horizonte mayor se publica además el subconjunto que tiene más de diez años útiles: cinco activos, sin Emerging Markets Value, desde octubre de 2015. Esta es otra cartera y otro período; no se comparan sus rentabilidades con las del universo de seis como si se aislase una única causa.
- En ese subconjunto largo, el rebalanceo queda 595 € por debajo de DCA en el período completo pese a ganar en seis de ocho ventanas. Smart DCA añade 266 €, pero pierde en el primer bloque. El signo depende de cartera, período y métrica; no se selecciona un ganador por número de ventanas.
- La reserva escalonada vuelve a perder en los segundos bloques: unos 2.264 € con los seis activos y 1.328 € en el subconjunto largo para DCA. No se justifica recomendar mantener reserva con esta regla.
- El filtro mejora la calidad temporal del estudio, pero no completa ni valida el score de cinco bloques. No se han aumentado las intensidades para que el gráfico gane.

## Reproducción

```sh
node scripts/evaluate-research.mjs backup.json docs/LONG_HISTORY_RESULTS.json long-history
```

El script selecciona automáticamente los universos >5 y >10 años útiles usando las proporciones originales y descarta ajustes, claves y posiciones privadas. El JSON incluye los nueve candidatos de todos los escenarios, incluidos los ensayos sin costes ni reserva, bloques, ventanas y hash del input.

[Resultados completos](LONG_HISTORY_RESULTS.json) · [Protocolo](RESEARCH_PROTOCOL.md)

Resultados retrospectivos, universo actual y precios ajustados revisables. No incluyen impuestos personales ni participaciones enteras. La remuneración del efectivo es una hipótesis constante. Las ventanas se solapan; los bloques temporales no son una prueba prospectiva desconocida.
