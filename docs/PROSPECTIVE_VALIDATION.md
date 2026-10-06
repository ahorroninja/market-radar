# Seguimiento prospectivo DCA vs rebalanceo

Protocolo `paper-dca-rebalance-1`, introducido en 3.0.3. Es un seguimiento virtual local, no operaciones de inversión ni un registro externo independiente.

## Reglas antes de observar resultados futuros

- El usuario inicia el seguimiento en Backtest. Se seleccionan los activos habilitados con más de cinco años útiles tras 252 sesiones de calentamiento. Se fijan sus símbolos, proporciones relativas, aportación mensual, capital disponible y costes indicados en el formulario. La cartera real no se utiliza.
- Se comparan DCA por pesos y rebalanceo sólo con aportaciones. Ambos reciben el mismo capital inicial y cada nueva aportación. No hay ventas ni reserva táctica. Los asignadores y la ejecución con costes son los mismos del backtest.
- La fecha de decisión utiliza Europe/Madrid. Al pulsar iniciar se guarda la hora real del dispositivo, el último cierre común conocido y los presupuestos por activo de ambos modelos. El precio común conocido no puede tener más de siete días.
- La ejecución virtual usa el primer cierre diario común disponible de fecha estrictamente posterior al día de registro. Nunca el cierre ya conocido o un cierre anterior elegido en el formulario del backtest. Si falta ese cierre, la orden permanece pendiente.
- Al actualizar los precios se liquidan las órdenes pendientes y, si corresponde, se registra una decisión del mes actual. No se registra más de una por mes ni mientras la anterior sigue pendiente. No se reconstruyen aportaciones o decisiones de meses omitidos; se cuentan explícitamente. No hay tarea en segundo plano cuando la aplicación está cerrada.
- Cada modelo calcula su rebalanceo desde su propia cartera virtual, valorada con información conocida al registrar la decisión. Cambiar los ajustes normales posteriormente no modifica las reglas fijadas ni las órdenes anteriores.
- La comisión fija, la proporcional y el deslizamiento se pagan dentro del presupuesto. Las órdenes demasiado pequeñas permanecen en efectivo. El efectivo y su interés supuesto forman parte del patrimonio.

## Qué se conserva

El registro incluye fecha/hora de creación, versión de aplicación, universo, pesos, hipótesis, fecha de última información, precios conocidos, presupuestos y fecha/precios de ejecución observados. Se guarda junto al estado local de forma atómica y se incluye en las copias de seguridad. Restaurar o editar una copia puede modificar un registro local; no se presenta como un sello independiente ni como protección contra manipulación del reloj.

Los símbolos originales deben seguir disponiendo de históricos EUR para valorar el seguimiento. Si faltan o se cambian, se conserva el registro y se señala el problema en vez de sustituir instrumentos.

## Cómo leer el resultado

Antes de la primera ejecución no hay rendimiento prospectivo que mostrar. Después se compara el patrimonio total neto, aportaciones, gastos, efectivo y diferencia frente a DCA. Es un contraste hacia adelante desde las decisiones registradas, no una prueba inmediata de superioridad. No se recalibran parámetros con los resultados recogidos.

Los precios Yahoo son series ajustadas de retorno total. La valoración rebasa las unidades sintéticas a la historia homogénea disponible en cada actualización, conservando las órdenes monetarias y sus entradas originales. Si Yahoo revisa cierres ajustados de ejecución, se informa de la revisión; no se mantienen unidades calculadas en una base antigua frente a precios de otra base. Esto no reproduce participaciones enteras, cobros de dividendos reales o fiscalidad personal.

La muestra será pequeña y dependiente de un único recorrido de mercado durante bastante tiempo. El rebalanceo seguirá siendo un candidato experimental; DCA es la referencia fija. El score original de cinco bloques no queda validado por este seguimiento.
