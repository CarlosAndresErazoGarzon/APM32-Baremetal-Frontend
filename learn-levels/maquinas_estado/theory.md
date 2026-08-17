# MANUAL // UNIDAD 11: MAQUINAS DE ESTADO (FSM)

---

## 11.1 Que es una Maquina de Estado

Una Maquina de Estado Finita (FSM) es un modelo con un numero limitado de
**estados** posibles, donde el sistema solo puede estar en uno a la vez, y
se mueve de un estado a otro cuando ocurre un **evento**. En firmware es el
patron mas usado para controlar botones, protocolos de comunicacion,
secuencias de arranque y cualquier cosa que "recuerde en que paso va".

Tres piezas la definen:

- **Estados** (`State`): los "modos" posibles (`ST_OFF`, `ST_ON`, ...).
- **Eventos** (`Event`): lo que puede disparar un cambio (`EV_BTN`, ...).
- **Tabla de transicion**: para cada combinacion (estado, evento), define a
  que estado se pasa y que accion se ejecuta.

## 11.2 La Tabla de Transicion como Matriz

En vez de encadenar `if`/`else` (que crece imposible de mantener), la
tabla de transicion se modela como una matriz 2D indexada por estado y
evento -- exactamente lo que ya usaste en la Unidad 9 con arreglos
bidimensionales:

```c
typedef enum { ST_OFF, ST_ON, ST__N } State;   // _N = cantidad de estados
typedef enum { EV_NONE, EV_BTN, EV__N } Event; // _N = cantidad de eventos
typedef void (*Action)(void);                   // puntero a funcion

typedef struct {
    State next;   // a que estado se pasa
    Action act;   // que funcion se ejecuta (o NULL si ninguna)
} Cell;

static const Cell TT[ST__N][EV__N] = {
    [ST_OFF] = { [EV_NONE] = {ST_OFF, NULL}, [EV_BTN] = {ST_ON,  led_on} },
    [ST_ON]  = { [EV_NONE] = {ST_ON,  NULL}, [EV_BTN] = {ST_OFF, led_off} }
};
```

`[ST_OFF] = { [EV_NONE] = ... }` es un **inicializador designado**: llena
la celda `TT[ST_OFF][EV_NONE]` sin tener que escribir cada posicion en
orden. Si una combinacion no se especifica, C la deja en cero (estado 0,
accion `NULL`).

## 11.3 El Motor de Despacho (Dispatch Engine)

Con la tabla ya armada, el motor que la recorre es siempre el mismo,
sin importar cuantos estados o eventos tenga la maquina:

```c
static State current_state = ST_OFF;

void fsm_dispatch(Event ev) {
    if (ev >= EV__N || current_state >= ST__N) return; // guarda de seguridad

    const Cell *c = &TT[current_state][ev];

    if (c->act != NULL) {
        c->act();          // ejecuta la accion de la transicion
    }

    current_state = c->next; // actualiza el estado
}
```

Este patron -- **tabla de datos + un motor generico que la recorre** -- es
la base de casi todo el firmware de eventos: protocolos UART, maquinas de
carga de bateria, controladores de motor paso a paso, y el propio
bootloader del microcontrolador.

## 11.4 Multiples Instancias, Un Solo Motor

Si necesitas varias maquinas corriendo al mismo tiempo (un LED y un motor,
por ejemplo), no duplicas el motor -- le pasas la instancia por puntero,
usando exactamente lo que aprendiste en Apuntadores a Estructuras:

```c
typedef struct {
    const char* nombre;
    State estado;
    const Cell (*tabla)[EV__N]; // puntero a la tabla de ESTA instancia
} FSM;

void fsm_dispatch(FSM *fsm, Event ev) {
    const Cell *c = &fsm->tabla[fsm->estado][ev];
    if (c->act) c->act(fsm->nombre);
    fsm->estado = c->next;
}
```

Cada instancia (`FSM led`, `FSM motor`) guarda su propio estado; el motor
de despacho es el mismo codigo para todas.

## El reto

Las 4 misiones de esta unidad van de una maquina de 2 estados hecha con
variables globales, hasta el despachador multi-instancia con apuntadores a
struct -- el mismo camino que recorriste en las unidades anteriores, ahora
aplicado a maquinas de estado.
