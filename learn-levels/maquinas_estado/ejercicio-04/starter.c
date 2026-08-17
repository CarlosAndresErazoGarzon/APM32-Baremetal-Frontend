#include <stdio.h>

/*
 * MISION 44: DESPACHADOR MULTI-MAQUINA
 * ---------------------------------------
 * Dos maquinas (un LED y un MOTOR) comparten la misma tabla de
 * transicion, pero cada una guarda su PROPIO estado en su propia
 * instancia. Un solo motor de despacho genérico las atiende a ambas
 * recibiendo un puntero a la instancia -- el mismo patron que usaste
 * con "Apuntadores a Estructuras".
 *
 * Completa fsm_dispatch(FSM *fsm, Event ev):
 *   - Busca la celda de la tabla de ESA instancia: fsm->tabla[fsm->estado][ev]
 *   - Si la celda tiene una accion, ejecutala pasando fsm->nombre
 *   - Actualiza fsm->estado con el siguiente estado de la celda
 */

typedef enum { ST_A, ST_B, ST__N } State;
typedef enum { EV_NONE, EV_SIG, EV__N } Event;
typedef void (*Action)(const char*);

typedef struct { State next; Action act; } Cell;

typedef struct {
    const char* nombre;
    State estado;
    const Cell (*tabla)[EV__N];
} FSM;

static void accion(const char* nombre) { printf("[%s] transicion ejecutada\n", nombre); }

static const Cell TABLA[ST__N][EV__N] = {
    [ST_A] = { [EV_NONE] = {ST_A, NULL}, [EV_SIG] = {ST_B, accion} },
    [ST_B] = { [EV_NONE] = {ST_B, NULL}, [EV_SIG] = {ST_A, accion} }
};

void fsm_dispatch(FSM *fsm, Event ev) {
    // TODO: implementa el despacho generico usando fsm->tabla, fsm->estado
    //       y fsm->nombre (recuerda: fsm es un puntero, usa ->)
}

int main(void) {
    FSM led = { "LED", ST_A, TABLA };
    FSM motor = { "MOTOR", ST_A, TABLA };

    fsm_dispatch(&led, EV_SIG);
    fsm_dispatch(&motor, EV_SIG);
    fsm_dispatch(&led, EV_SIG);

    printf("LED estado final: %c\n", led.estado == ST_A ? 'A' : 'B');
    printf("MOTOR estado final: %c\n", motor.estado == ST_A ? 'A' : 'B');
    return 0;
}
