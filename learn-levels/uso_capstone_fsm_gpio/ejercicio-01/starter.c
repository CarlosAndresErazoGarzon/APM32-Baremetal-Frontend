#include <stdio.h>
#include <stdint.h>
#include <stddef.h>

/*
 * MISION 53: TABLA DE TRANSICION SOBRE GPIO REAL
 * ----------------------------------------------------
 * La misma maquina de estados tabular de la Unidad 11 (M41-M44), pero
 * esta vez las acciones de cada transicion escriben de verdad sobre
 * un registro ODATA simulado en vez de solo imprimir texto.
 */

typedef struct {
    uint32_t CFGLOW, CFGHIG, IDATA, ODATA;
} GPIO_TypeDef;

#define LED_PIN 5

static GPIO_TypeDef puerto = {0, 0, 0, 0};
static GPIO_TypeDef *GPIOA = &puerto;

typedef enum { ST_OFF, ST_ON, ST__N } State;
typedef enum { EV_NONE, EV_BTN, EV__N } Event;
typedef void (*Action)(void);

typedef struct {
    State next;
    Action act;
} Cell;

static void led_on(void)  { GPIOA->ODATA |= (1 << LED_PIN); }
static void led_off(void) { GPIOA->ODATA &= ~(1 << LED_PIN); }

// TODO: completa la matriz de transicion TT[ST__N][EV__N]:
//   en ST_OFF, EV_BTN lleva a ST_ON  y ejecuta led_on
//   en ST_ON,  EV_BTN lleva a ST_OFF y ejecuta led_off
//   EV_NONE en cualquier estado se queda en el mismo estado, sin accion
static const Cell TT[ST__N][EV__N] = {
    [ST_OFF] = {
        [EV_NONE] = {ST_OFF, NULL},
    },
    [ST_ON] = {
        [EV_NONE] = {ST_ON, NULL},
    }
};

static State current_state = ST_OFF;

void fsm_dispatch(Event ev) {
    if (ev >= EV__N || current_state >= ST__N) return;
    const Cell *c = &TT[current_state][ev];
    if (c->act != NULL) c->act();
    current_state = c->next;
}

int main(void) {
    Event events[] = {EV_BTN, EV_NONE, EV_BTN, EV_NONE, EV_BTN};
    int n = sizeof(events) / sizeof(events[0]);

    for (int i = 0; i < n; i++) {
        fsm_dispatch(events[i]);
        printf("Evento %d -> Estado: %d | ODATA: 0x%08X\n", i, current_state, GPIOA->ODATA);
    }

    return 0;
}
