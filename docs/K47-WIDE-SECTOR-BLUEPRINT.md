# K-47 · Outer Array — blueprint del desembarco grande

**Decisión de diseño · 22 de noviembre de 2026.** Referencia de ritmo y legibilidad: operaciones isométricas de escuadrón de principios de los 2000, especialmente *Star Trek: Away Team*, **sin copiar** mapas, personajes, misiones ni assets. Este repositorio público contiene solo geografía y ficción originales.

## El problema que resolvemos

La superficie jugable actual es **18 × 12 = 216 casillas**, con las instalaciones y la mayoría de objetivos concentrados alrededor de la zona inicial. La cámara y la animación han mejorado, pero no existe aún un viaje táctico suficientemente largo entre partes distintas de una misión. Ampliar solo el lienzo sería crear desierto decorativo.

**Propuesta de un primer mapa amplio:** **32 × 20 = 640 casillas**, casi **2,96 veces** la superficie actual, pero distribuida en **seis sectores interconectados** con obstáculos y dos aproximaciones al objetivo remoto. No es una región procedural infinita: es un único recinto de misión cuidadosamente diseñado. El archivo fuente de referencia es `content/scenes/k47-wide-plan.json`.

## Plano de misión

Las letras representan *sectores conceptuales*, no ocupación ni colisiones exactas; las coordenadas y las paredes verdaderas están en el JSON y se validan con el motor:

```text
                    NORTE  ·  y=0
      x=0                         x=17                    x=31
    ┌──────────────────────────────────────────────────────────┐
    │  A — CABEZA DE PLAYA   │ B — CINTURÓN  │ C — CORDILLERA  │
    │  [nave / escuadrón]    │ INDUSTRIAL    │    · uplink     │
    │  Ciencia / socorro     │ hangares      │    · cobertura  │
    │  Baliza / archivo      │  ↗ puerta N   │  → laboratorio  │
    │                        │  ↘ puerta E   │                 │
    ├───────────┬────────────┴───────────────┴─────────────────┤
    │ F — PASO  │ D — PATIOS DE CARGA        │ E — LAB REMOTO  │
    │   SUR     │ · relé de energía         │ · evidencia     │
    │  desvío   │ · evac. civiles / carga   │ 2 entradas     │
    │           │ · extracción secundaria   │ N / S reales   │
    └───────────┴───────────────────────────┴─────────────────┘
                        SUR  ·  y=19
```

| Sector | Región de coordenadas | Función en la misión |
| --- | --- | --- |
| A · Cabeza de playa | x1–8, y1–10 | Desembarco y cinco objetos de misión **ya existentes**, incluidos extracción, sonda y socorro |
| B · Cinturón industrial | x9–17, y1–10 | Transición entre colonia existente, acceso norte y vías de servicio |
| C · Cordillera de sensores | x18–30, y1–9 | Reconocimiento y ruta exterior más expuesta; relieve y visibilidad condicionan aproximación |
| D · Patios de carga | x9–22, y11–18 | Ruta sur alternativa, logística, energización, evacuación |
| E · Laboratorio remoto | x23–30, y10–18 | Destino profundo con **dos huecos transitables**; investigación y dilema final |
| F · Paso sur | x1–8, y12–18 | Rampa de aproximación secundaria y conexión de retorno |

Hay **seis aperturas reales** en la antigua frontera (x17:y4,y8,y10 y y11:x10,x13,x15). El laboratorio tiene accesos reales en (27,10) y (27,15). Las restantes paredes y el terreno no transitable pertenecen al mapa, no a un falso decorado. Se cierra asimismo una bolsa inaccesible preexistente en (1–3,8), de modo que el mapa ampliado pueda exigir **100 % de suelo transitable conectado** y un perímetro cerrado sin salidas falsas.

## Bucle jugable y decisiones

**Inicio → inspección local → elección de aproximación → contacto/descubrimiento → investigación remota → extracción.** El equipo ya puede desplazarse continuamente y formarse en el motor experimental; el mapa amplio conservará esos comandos y permitirá órdenes por sectores sin encoger los personajes a hormigas.

**Ruta norte:** cabeza de playa → industria → cordillera → reconocimiento → entrada superior al laboratorio. Compensa si el jugador valora información antes del contacto. **Ruta sur:** cabeza de playa → patios de carga → relé y evacuados → entrada inferior del laboratorio. Compensa si prioriza logística y protección de personas. Ambas deben seguir siendo recorribles **aunque se cierren todas las puertas de la otra aproximación**, salvo que una misión futura cambie explícitamente el estado del mundo.

Puntos de interés **previstos, todavía NO interactivos**:

| Prioridad | Coordenada | Objetivo propuesto | Consecuencia exigida antes de activarlo |
| --- | --- | --- | --- |
| Principal | (18,15) | Reponer energía | Estado real de soporte vital/comunicaciones |
| Principal | (27,13) | Analizar muestras del laboratorio | Evidencia en el diario y decisión de desenlace |
| Opcional | (26,4) | Reconocimiento de la cordillera | Intel verificable, sin revelar niebla a distancia |
| Opcional | (10,16) | Reagrupar evacuados | Recuento de civiles y decisión de rescate |
| Opcional | (12,18) | Señalizar extracción alternativa | Ruta de salida habilitada por evento auténtico |

Ninguno se introduce como una `station` activa en el JSON del mundo: **un marcador que simula una misión inexistente sería peor que un terreno vacío**. La vertiente diplomática/científica ha de permitir resolver el episodio sin combatir obligatoriamente; la recolección de pruebas puede entrar en conflicto con la evacuación, pero sus consecuencias deberán ser mecánicas y auditables, no un párrafo decorativo.

## Arquitectura que se conservará

- **El desembarco 18×12 sigue siendo el predeterminado.** El archivo de referencia y el compilador `composeGroundExpansion` devuelven otro mundo; no modifican `meridian.json`, los saves v1 ni el diario de comandos.
- **No mover los tres GLB originales** ni desbloquear sus paredes: la galería oeste, las utilidades científicas y la nave industrial del sur conservan exactamente las huellas publicadas. La decoración posterior se diseñará para los sectores nuevos y se validará en 390/1280 px.
- **Movilidad y visión reales:** 640 centros seleccionables, obstáculos topológicos, line-of-sight radio 3, exploración gradual y `F5` con posiciones fraccionarias. Nunca convertir la niebla en decoración que revela instalaciones futuras.
- **Reutilización:** `wallRuns` define líneas horizontales/verticales de obstáculos, `openings` puertas verdaderas; las coordenadas se compilan en un mapa aparte. Los siguientes mapas podrán reaprovechar este contrato, prefabs visuales de roca/industria/vegetación y lógica de carga de sectores.
- **Cámara:** seguimiento del escuadrón con nivel de detalle útil. El mapa completo pasa a ser inspección estratégica, no la forma habitual de ordenar movimientos; el selector de sectores debe crecer desde los tres genéricos actuales hasta seis sectores basados en el terreno conocido.
- **Rendimiento:** se deben medir escenas reales con 640 celdas en Chromium a 360/390/430/1280. Evitar cargar o renderizar decoración compleja fuera de la vista; no declarar 60 FPS sin medición.
- **Identidad y guardado:** antes de permitir jugar un segundo mapa hay que añadir una identidad estable de misión y aislar el estado guardado y el fog de cada instancia. No aceptar nunca un sidecar de la zona antigua como si fuera un recorrido de 32×20.

## Entrega incremental y puertas de calidad

**PR 1 — este blueprint, no un lanzamiento jugable.** Archivo declarativo 32×20, compilador puro y tests que demuestran las 640 casillas, **412 transitables y conectadas**, las dos alternativas, objetivos accesibles, huellas GLB bloqueadas, rutas continuas reales, niebla y serialización v2 en memoria. No activa un menú ni modifica el desembarco actual.

**PR 2 — mapa seleccionable en una misión de prueba, separado de partidas existentes.** Adaptar renderer y picking de SVG/3D a tamaño de escena, frame derivado y seis sectores sin coordenadas hardcodeadas. Señal visual de «prototipo», F5 aislado, recorrido punta a punta y capturas 390/1280 reales **antes** de merge.

**PR 3 — roles y objetivos auténticos.** Añadir los dos eventos principales y al menos un opcional con mutaciones de campaña, diarios, estación adyacente, evidencia, guardado y salida. Probar una resolución científica/no violenta. No llamar al terreno «misión completa» antes de ello.

**PR 4 — autoría visual de cada zona.** Terreno y arquitectura reutilizables por familias semánticas, auténticos materiales originales, grandes volúmenes que justifican paredes y puertas verdaderas. Accesos y cubiertas deben coincidir con la colisión. QA Chrome, sombras, occlusión, touch y sin horizontales desbordados.

**PR 5 — aceptación completa.** E2E automatizado que *juegue* las dos rutas hasta un desenlace, regrese a la nave, recargue a mitad, y mida tiempo de desplazamiento, errores de selección, solapamiento de UI y recuperación ante fallos. Solo entonces se considera sustituir el tamaño de misión por defecto.

## Resultado que buscamos

Un desembarco que dé la sensación de **operación terrestre con recorrido, exploración y decisiones**, no de un tablero pequeño decorado con edificios muy bonitos. La referencia es la densidad táctica y el ritmo, no reproducir recursos licenciados. **Más mapa, pero sobre todo más misión.**
