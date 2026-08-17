#include <stdio.h>

/*
 * MISION 41: INTERRUPTOR DE BALIZA
 * ---------------------------------
 * Completa la tabla de transicion TT para una maquina de 2 estados:
 *   - En ST_OFF, el evento EV_BTN pasa a ST_ON  y ejecuta led_on.
 *   - En ST_ON,  el evento EV_BTN pasa a ST_OFF y ejecuta led_off.
 *   - El evento EV_NONE nunca cambia de estado ni ejecuta nada (NULL).
 *
 * El main() ya simula 4 pulsaciones de boton -- solo falta la tabla.
 */

typedef enum { ST_OFF, ST_ON, ST__N } State;
typedef enum { EV_NONE, EV_BTN, EV__N } Event;
typedef void (*Action)(void);

typedef struct {
    State next;
    Action act;
} Cell;

static void led_on(void)  { printf("LED: ON\n"); }
static void led_off(void) { printf("LED: OFF\n"); }

// TODO: completa la tabla usando inicializadores designados
// [ST_OFF] = { [EV_NONE] = {ST_OFF, NULL}, [EV_BTN] = {ST_ON,  led_on} },
// [ST_ON]  = { [EV_NONE] = {ST_ON,  NULL}, [EV_BTN] = {ST_OFF, led_off} }
static const Cell TT[ST__N][EV__N] = {

};

static State current_state = ST_OFF;

void fsm_dispatch(Event ev) {
    if (ev >= EV__N || current_state >= ST__N) return;
    const Cell *c = &TT[current_state][ev];
    if (c->act != NULL) c->act();
    current_state = c->next;
}

int main(void) {
    fsm_dispatch(EV_BTN);
    fsm_dispatch(EV_BTN);
    fsm_dispatch(EV_BTN);
    fsm_dispatch(EV_BTN);
    return 0;
}
