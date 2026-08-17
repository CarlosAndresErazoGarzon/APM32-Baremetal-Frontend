#include <stdio.h>

/*
 * MISION 43: MAQUINA ANTI-REBOTE (DEBOUNCE)
 * --------------------------------------------
 * Un boton "rebota" al presionarse: la lectura cruda oscila entre 0 y 1
 * varias veces antes de estabilizarse. Esta maquina de 3 estados filtra
 * el ruido:
 *
 *   ST_IDLE      -> si lee 1, pasa a ST_DEBOUNCE (empieza a contar).
 *   ST_DEBOUNCE  -> si sigue leyendo 1, cuenta lecturas consecutivas.
 *                   Al llegar a 3 lecturas estables, imprime
 *                   "Boton PRESIONADO (estable)" y pasa a ST_PRESSED.
 *                   Si en algun punto lee 0, se cancela: vuelve a ST_IDLE.
 *   ST_PRESSED   -> si lee 0, imprime "Boton LIBERADO" y vuelve a ST_IDLE.
 *
 * Completa el caso ST_DEBOUNCE del switch.
 */

typedef enum { ST_IDLE, ST_DEBOUNCE, ST_PRESSED } State;

int main(void) {
    int lecturas[] = {0, 1, 0, 1, 1, 1, 1, 0, 1, 1};
    int n = 10;
    int contador_estable = 0;
    State estado = ST_IDLE;

    for (int i = 0; i < n; i++) {
        int leido = lecturas[i];

        switch (estado) {
            case ST_IDLE:
                if (leido == 1) {
                    estado = ST_DEBOUNCE;
                    contador_estable = 1;
                }
                break;

            case ST_DEBOUNCE:
                // TODO: si leido == 1, incrementa contador_estable;
                //       si contador_estable llega a 3, imprime
                //       "Boton PRESIONADO (estable)\n" y pasa a ST_PRESSED.
                //       si leido == 0, cancela: vuelve a ST_IDLE y pon
                //       contador_estable en 0.
                break;

            case ST_PRESSED:
                if (leido == 0) {
                    printf("Boton LIBERADO\n");
                    estado = ST_IDLE;
                }
                break;
        }
    }

    return 0;
}
