# MANUAL // UNIDAD 14: CAPSTONE - FSM + GPIO

---

## 14.1 La Misma Tabla, Ahora con Hardware Real

En la Unidad 11 construiste una maquina de estados tabular donde las
acciones solo imprimian texto. Esta unidad reutiliza exactamente el mismo
motor (`fsm_dispatch`, tabla `TT[ST__N][EV__N]`), pero ahora las funciones
de accion escriben de verdad sobre un registro `ODATA` simulado:

```c
#include <stdio.h>
#include <stdint.h>
#include <stddef.h>

typedef struct {
    uint32_t CFGLOW, CFGHIG, IDATA, ODATA;
} GPIO_TypeDef;

#define LED_PIN 5

static GPIO_TypeDef puerto = {0, 0, 0, 0};
static GPIO_TypeDef *GPIOA = &puerto;

typedef enum { ST_OFF, ST_ON, ST__N } State;
typedef enum { EV_NONE, EV_BTN, EV__N } Event;
typedef void (*Action)(void);
typedef struct { State next; Action act; } Cell;

static void led_on(void)  { GPIOA->ODATA |= (1 << LED_PIN); }
static void led_off(void) { GPIOA->ODATA &= ~(1 << LED_PIN); }

static const Cell TT[ST__N][EV__N] = {
    [ST_OFF] = { [EV_NONE] = {ST_OFF, NULL}, [EV_BTN] = {ST_ON,  led_on} },
    [ST_ON]  = { [EV_NONE] = {ST_ON,  NULL}, [EV_BTN] = {ST_OFF, led_off} }
};

static State current_state = ST_OFF;

void fsm_dispatch(Event ev) {
    if (ev >= EV__N || current_state >= ST__N) return;
    const Cell *c = &TT[current_state][ev];
    if (c->act != NULL) c->act();
    current_state = c->next;
}
```

Nada cambia en el motor de despacho -- solo lo que las funciones `act`
hacen por dentro. Esa es la ventaja real del patron tabular: la logica de
"que estado sigue" queda completamente separada de "que hace el
hardware", y se puede probar cada una por su lado.

## 14.2 El Despachador Completo: Debounce -> FSM

En un firmware real, los eventos de una FSM casi nunca vienen directo de
un pin crudo -- vienen filtrados por algo como el anti-rebote de la
Unidad 13. El patron final conecta las tres piezas de esta super unidad:

```
IDATA (lectura cruda) --> debounce_update() --> fsm_dispatch(EV_BTN) --> ODATA
```

```c
// Solo cuando debounce_update() valida una pulsacion real (no ruido) se
// despacha el evento hacia la maquina de estados:
if (debounce_update(signal[i])) {
    fsm_dispatch(EV_BTN);
    printf("Lectura %d: Estado %d | ODATA 0x%08X\n",
           i, current_state, GPIOA->ODATA);
}
```

Cada capa tiene una sola responsabilidad: `debounce_update()` decide SI
paso algo real; `fsm_dispatch()` decide QUE estado sigue y ejecuta la
accion; `ODATA` es el efecto final visible en el hardware. Esta
separacion en capas -- lectura, filtrado, logica de estados, salida -- es
el mismo esqueleto que usaras en el proyecto final del curso.
