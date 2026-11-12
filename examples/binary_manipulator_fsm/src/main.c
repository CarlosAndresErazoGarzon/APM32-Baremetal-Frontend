#include "apm32f10x.h"
#include "apm32_config.h"
#include "delay.h"
#include "uart.h"
#include "montaje.h"
#include "fsm.h"
#include <stdio.h>

// Imprime por UART el cursor y el número binario tras cada cambio de
// estado de la FSM, para seguir su evolución sin mirar el hardware.
static void reportar_estado(const BinManipFSM *fsm) {
    printf("\r\nEstado: cursor=%d | Numero: %u\r\n", fsm->cursor, fsm->valor);
}

// Despacha el evento en la FSM y reporta el nuevo estado; único punto de
// entrada tanto para los botones físicos como para el teclado por UART.
static void manejar_evento(BinManipFSM *fsm, FsmEvent ev) {
    fsm_dispatch(fsm, ev);
    reportar_estado(fsm);
}

// Traduce una tecla recibida por UART al evento equivalente de un botón.
// Devuelve 1 y escribe 'ev' si la tecla es válida, 0 si no reconoce la tecla.
static uint8_t tecla_a_evento(uint8_t c, FsmEvent *ev) {
    switch (c) {
        case 'a': case 'A': *ev = EV_LEFT;   return 1;
        case 'd': case 'D': *ev = EV_RIGHT;  return 1;
        case 't': case 'T': *ev = EV_TOGGLE; return 1;
        case 'r': case 'R': *ev = EV_RESET;  return 1;
        default: return 0;
    }
}

int main(void) {
    APM32_Init();

    printf("\r\n==================================\r\n");
    printf("   APM32 MANIPULADOR BINARIO       \r\n");
    printf("==================================\r\n");
    printf("Botones -- Izquierda/Derecha mueven el cursor, Toggle prende/apaga el LED, Borrar reinicia.\r\n");
    printf("Teclado -- 'a'=Izquierda 'd'=Derecha 't'=Toggle 'r'=Borrar\r\n");

    BinManipFSM fsm;
    fsm_init(&fsm);

    while (1) {
        mostrar_numero(fsm.valor); // refresco continuo del 7 segmentos

        if (fue_presionado(&botones[0])) manejar_evento(&fsm, EV_LEFT);
        if (fue_presionado(&botones[1])) manejar_evento(&fsm, EV_RIGHT);
        if (fue_presionado(&botones[2])) manejar_evento(&fsm, EV_TOGGLE);
        if (fue_presionado(&botones[3])) manejar_evento(&fsm, EV_RESET);

        if (UART_Available()) {
            FsmEvent ev;
            if (tecla_a_evento(UART_Rx(), &ev)) manejar_evento(&fsm, ev);
        }
    }

    return 0;
}
