#include <stdio.h>
#include <stdint.h>
#include <stdbool.h>
#include <stddef.h>

/*
 * MISION 54: DESPACHADOR MULTI-EVENTO CON DEBOUNCE INTEGRADO
 * -----------------------------------------------------------------
 * Une TODO lo de esta unidad: una senal de boton con ruido pasa por el
 * anti-rebote de M51, y solo las pulsaciones YA VALIDADAS se despachan
 * como EV_BTN hacia la maquina de estados de M53.
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

typedef enum { DB_IDLE, DB_DEBOUNCE, DB_PRESSED } DBState;
typedef enum { LVL_LOW, LVL_HIGH } PinLevel;

static DBState db_state = DB_IDLE;
static int stable_count = 0;
#define STABLE_THRESHOLD 3

bool debounce_update(PinLevel current_level) {
    bool event_detected = false;
    switch (db_state) {
        case DB_IDLE:
            if (current_level == LVL_HIGH) { db_state = DB_DEBOUNCE; stable_count = 0; }
            break;
        case DB_DEBOUNCE:
            if (current_level == LVL_HIGH) {
                stable_count++;
                if (stable_count >= STABLE_THRESHOLD) { db_state = DB_PRESSED; event_detected = true; }
            } else {
                db_state = DB_IDLE;
            }
            break;
        case DB_PRESSED:
            if (current_level == LVL_LOW) db_state = DB_IDLE;
            break;
    }
    return event_detected;
}

int main(void) {
    // Dos pulsaciones con ruido: sube-baja-rafaga de 4 HIGH (valida), baja,
    // luego otra rafaga de 4 HIGH (valida), baja. 4 HIGHs consecutivos por
    // rafaga: 1 para entrar a DEBOUNCE + 3 mas para llegar a
    // STABLE_THRESHOLD=3 (ver M51).
    PinLevel signal[] = {
        LVL_LOW, LVL_HIGH, LVL_LOW, LVL_HIGH, LVL_HIGH, LVL_HIGH, LVL_HIGH, LVL_LOW,
        LVL_HIGH, LVL_HIGH, LVL_HIGH, LVL_HIGH, LVL_LOW
    };
    int n = sizeof(signal) / sizeof(signal[0]);

    for (int i = 0; i < n; i++) {
        // TODO: si debounce_update(signal[i]) valida el evento, despacha
        //       fsm_dispatch(EV_BTN) y luego imprime
        //       "Lectura %d: Estado %d | ODATA 0x%08X\n" con i, current_state, GPIOA->ODATA
    }

    return 0;
}
