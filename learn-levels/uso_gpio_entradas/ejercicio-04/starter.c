#include <stdio.h>
#include <stdint.h>
#include <stdbool.h>

/*
 * MISION 52: TOGGLE DE LED POR BOTON (COMBINADO)
 * ---------------------------------------------------
 * Integra M47 (led_toggle, ya resuelto) con la logica de anti-rebote
 * de M51: cada vez que debounce_update() valida una pulsacion, se
 * invierte el estado del LED.
 */

typedef struct {
    uint32_t CFGLOW, CFGHIG, IDATA, ODATA;
} GPIO_TypeDef;

#define LED_PIN 2

void led_toggle(GPIO_TypeDef *gpio) {
    gpio->ODATA ^= (1 << LED_PIN);
}

typedef enum { ST_IDLE, ST_DEBOUNCE, ST_PRESSED } DBState;
typedef enum { LVL_LOW, LVL_HIGH } PinLevel;

static DBState db_state = ST_IDLE;
static int stable_count = 0;
#define STABLE_THRESHOLD 3

bool debounce_update(PinLevel current_level) {
    bool event_detected = false;
    switch (db_state) {
        case ST_IDLE:
            if (current_level == LVL_HIGH) { db_state = ST_DEBOUNCE; stable_count = 0; }
            break;
        case ST_DEBOUNCE:
            if (current_level == LVL_HIGH) {
                stable_count++;
                if (stable_count >= STABLE_THRESHOLD) { db_state = ST_PRESSED; event_detected = true; }
            } else {
                db_state = ST_IDLE;
            }
            break;
        case ST_PRESSED:
            if (current_level == LVL_LOW) db_state = ST_IDLE;
            break;
    }
    return event_detected;
}

int main(void) {
    GPIO_TypeDef puerto = {0, 0, 0, 0};
    GPIO_TypeDef *GPIOB = &puerto;

    // 4 lecturas HIGH consecutivas por rafaga (ver M51: 1 para entrar a
    // DEBOUNCE + 3 mas para llegar a STABLE_THRESHOLD=3).
    PinLevel signal[] = {LVL_LOW, LVL_HIGH, LVL_HIGH, LVL_HIGH, LVL_HIGH, LVL_LOW, LVL_HIGH, LVL_HIGH, LVL_HIGH, LVL_HIGH, LVL_LOW};
    int n = sizeof(signal) / sizeof(signal[0]);

    for (int i = 0; i < n; i++) {
        // TODO: si debounce_update(signal[i]) valida un evento, llama a led_toggle(GPIOB)
        //       e imprime "Lectura %d: LED -> 0x%08X\n" con i y GPIOB->ODATA
    }

    return 0;
}
