#ifndef FSM_H
#define FSM_H

#include <stdint.h>

// Manipulador binario: un cursor invisible apunta a uno de los 6 LEDs;
// Toggle prende/apaga el LED en esa posición, armando un número binario
// de 6 bits (0-63) que se muestra también en el 7 segmentos.
typedef enum { ST_POS0, ST_POS1, ST_POS2, ST_POS3, ST_POS4, ST_POS5, ST__N } FsmState;
typedef enum { EV_LEFT, EV_RIGHT, EV_TOGGLE, EV_RESET, EV__N } FsmEvent;

typedef struct {
    FsmState cursor; // posición (0..5) que señala el cursor
    uint8_t  valor;  // número binario armado; bit i = LED i
} BinManipFSM;

void fsm_init(BinManipFSM *fsm);
void fsm_dispatch(BinManipFSM *fsm, FsmEvent ev);

#endif
