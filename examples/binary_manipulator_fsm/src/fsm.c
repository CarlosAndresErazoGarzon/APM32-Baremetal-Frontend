#include "fsm.h"
#include "montaje.h"

typedef void (*Action)(BinManipFSM *fsm);

typedef struct {
    FsmState next;
    Action   act;
} Cell;

// Invierte el bit del valor binario en la posición actual del cursor
// (XOR con máscara 1<<cursor) y refleja el nuevo valor en los LEDs.
static void accion_toggle(BinManipFSM *fsm) {
    fsm->valor ^= (1U << fsm->cursor);
    actualizar_leds(fsm->valor);
}

// Pone el valor binario en 0 y apaga los 6 LEDs. El cursor vuelve a
// ST_POS0 por la tabla de transiciones (next state de EV_RESET), no aquí.
static void accion_reset(BinManipFSM *fsm) {
    fsm->valor = 0;
    actualizar_leds(0);
}

static const Cell TT[ST__N][EV__N] = {
    [ST_POS0] = { [EV_LEFT] = {ST_POS5, NULL}, [EV_RIGHT] = {ST_POS1, NULL}, [EV_TOGGLE] = {ST_POS0, accion_toggle}, [EV_RESET] = {ST_POS0, accion_reset} },
    [ST_POS1] = { [EV_LEFT] = {ST_POS0, NULL}, [EV_RIGHT] = {ST_POS2, NULL}, [EV_TOGGLE] = {ST_POS1, accion_toggle}, [EV_RESET] = {ST_POS0, accion_reset} },
    [ST_POS2] = { [EV_LEFT] = {ST_POS1, NULL}, [EV_RIGHT] = {ST_POS3, NULL}, [EV_TOGGLE] = {ST_POS2, accion_toggle}, [EV_RESET] = {ST_POS0, accion_reset} },
    [ST_POS3] = { [EV_LEFT] = {ST_POS2, NULL}, [EV_RIGHT] = {ST_POS4, NULL}, [EV_TOGGLE] = {ST_POS3, accion_toggle}, [EV_RESET] = {ST_POS0, accion_reset} },
    [ST_POS4] = { [EV_LEFT] = {ST_POS3, NULL}, [EV_RIGHT] = {ST_POS5, NULL}, [EV_TOGGLE] = {ST_POS4, accion_toggle}, [EV_RESET] = {ST_POS0, accion_reset} },
    [ST_POS5] = { [EV_LEFT] = {ST_POS4, NULL}, [EV_RIGHT] = {ST_POS0, NULL}, [EV_TOGGLE] = {ST_POS5, accion_toggle}, [EV_RESET] = {ST_POS0, accion_reset} },
};

// Estado inicial: cursor en la posición 0, binario en 0.
void fsm_init(BinManipFSM *fsm) {
    fsm->cursor = ST_POS0;
    fsm->valor = 0;
}

// Dispatcher table-driven: busca la celda [cursor][ev], actualiza el
// cursor al 'next' de esa celda y ejecuta su acción (si tiene) pasándole
// la FSM completa, para que la acción pueda leer/escribir cursor y valor.
// Descarta silenciosamente eventos o estados fuera de rango.
void fsm_dispatch(BinManipFSM *fsm, FsmEvent ev) {
    if (ev >= EV__N || fsm->cursor >= ST__N) return;

    const Cell *c = &TT[fsm->cursor][ev];

    fsm->cursor = c->next;
    if (c->act) {
        c->act(fsm);
    }
}
