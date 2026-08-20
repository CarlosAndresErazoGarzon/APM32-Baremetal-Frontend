#include <stdio.h>

/*
 * MISION 42: SEMAFORO DE ESTADO DEL SISTEMA
 * -------------------------------------------
 * La tabla de transicion de 3 estados ya esta completa. Solo falta
 * escribir el cuerpo de las 3 funciones de accion que ella invoca:
 *
 *   on_ready() -> imprime: Sistema en linea
 *   on_error() -> imprime: FALLO detectado
 *   on_reset() -> imprime: Sistema reiniciado
 */

typedef enum { ST_INIT, ST_RUN, ST_FAULT, ST__N } State;
typedef enum { EV_READY, EV_ERROR, EV_RESET, EV__N } Event;
typedef void (*Action)(void);

typedef struct { State next; Action act; } Cell;

// TODO: define aqui on_ready, on_error y on_reset (void -> void)
static void on_ready(void) { /* TODO: imprime "Sistema en linea" */ }
static void on_error(void) { /* TODO: imprime "FALLO detectado" */ }
static void on_reset(void) { /* TODO: imprime "Sistema reiniciado" */ }


static const Cell TT[ST__N][EV__N] = {
    [ST_INIT]  = { [EV_READY] = {ST_RUN, on_ready}, [EV_ERROR] = {ST_INIT, NULL}, [EV_RESET] = {ST_INIT, NULL} },
    [ST_RUN]   = { [EV_READY] = {ST_RUN, NULL}, [EV_ERROR] = {ST_FAULT, on_error}, [EV_RESET] = {ST_RUN, NULL} },
    [ST_FAULT] = { [EV_READY] = {ST_FAULT, NULL}, [EV_ERROR] = {ST_FAULT, NULL}, [EV_RESET] = {ST_INIT, on_reset} }
};

static State estado = ST_INIT;

void fsm_dispatch(Event ev) {
    if (ev >= EV__N || estado >= ST__N) return;
    const Cell *c = &TT[estado][ev];
    if (c->act) c->act();
    estado = c->next;
}

int main(void) {
    fsm_dispatch(EV_READY);
    fsm_dispatch(EV_ERROR);
    fsm_dispatch(EV_RESET);
    fsm_dispatch(EV_READY);
    return 0;
}
