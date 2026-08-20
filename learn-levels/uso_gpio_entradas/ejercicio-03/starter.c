#include <stdio.h>
#include <stdbool.h>

/*
 * MISION 51: ANTI-REBOTE POR CONTEO DE ESTABILIDAD
 * ----------------------------------------------------
 * El ruido en los botones fisicos genera lecturas espurias. Esta
 * maquina de estados solo valida una pulsacion cuando la senal se
 * mantiene ESTABLE en HIGH durante STABLE_THRESHOLD lecturas seguidas.
 *
 *   ST_IDLE     -> primera lectura en HIGH, pasa a ST_DEBOUNCE
 *   ST_DEBOUNCE -> cuenta lecturas HIGH seguidas; si baja a LOW antes
 *                  de alcanzar el umbral, fue ruido y vuelve a ST_IDLE
 *   ST_PRESSED  -> evento validado; espera a que la senal baje a LOW
 *                  para volver a ST_IDLE
 */

typedef enum { ST_IDLE, ST_DEBOUNCE, ST_PRESSED } DBState;
typedef enum { LVL_LOW, LVL_HIGH } PinLevel;

static DBState db_state = ST_IDLE;
static int stable_count = 0;
#define STABLE_THRESHOLD 3

bool debounce_update(PinLevel current_level) {
    bool event_detected = false;

    switch (db_state) {
        case ST_IDLE:
            // TODO: si current_level es HIGH, pasa a ST_DEBOUNCE y reinicia stable_count
            break;

        case ST_DEBOUNCE:
            // TODO: si sigue HIGH, incrementa stable_count; al llegar al umbral,
            //       pasa a ST_PRESSED y marca event_detected = true.
            //       Si baja a LOW antes de tiempo, vuelve a ST_IDLE (fue ruido).
            break;

        case ST_PRESSED:
            if (current_level == LVL_LOW) {
                db_state = ST_IDLE;
            }
            break;
    }
    return event_detected;
}

int main(void) {
    // Entrar a DEBOUNCE cuenta como la 1a lectura HIGH; con
    // STABLE_THRESHOLD=3 hacen falta 3 lecturas HIGH MAS (4 en total,
    // consecutivas) para validar el evento -- por eso el rafagazo real
    // de HIGHs es de 4, no de 3.
    PinLevel signal[] = {LVL_LOW, LVL_HIGH, LVL_LOW, LVL_HIGH, LVL_HIGH, LVL_HIGH, LVL_HIGH, LVL_LOW};
    int n = sizeof(signal) / sizeof(signal[0]);

    for (int i = 0; i < n; i++) {
        if (debounce_update(signal[i])) {
            printf("Lectura %d: EVENTO VALIDADO\n", i);
        }
    }

    return 0;
}
