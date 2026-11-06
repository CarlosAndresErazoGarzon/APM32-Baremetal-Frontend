#include "apm32f10x.h"
#include "apm32_config.h"
#include "delay.h"

/* USER CODE BEGIN Includes */
// Table-driven FSM pattern: the "events" come from a debounced button
// instead of stdin, and the "actions" drive PB2 instead of puts().
#define DEBOUNCE_MS 15

typedef enum { ST_OFF, ST_ON, ST__N } State;
typedef enum { EV_NONE, EV_BTN, EV__N } Event;
typedef void (*Action)(void);
typedef struct { State next; Action act; } Cell;

static void led_on(void)  { GPIOB->ODATA |= (1 << 2); }
static void led_off(void) { GPIOB->ODATA &= ~(1 << 2); }

static const Cell TT[ST__N][EV__N] = {
    /*             EV_NONE          EV_BTN          */
    /* ST_OFF */ { {ST_OFF, NULL}, {ST_ON,  led_on}  },
    /* ST_ON  */ { {ST_ON,  NULL}, {ST_OFF, led_off} }
};

static State s = ST_OFF;

static void fsm_dispatch(Event ev) {
    const Cell *c = &TT[s][ev];
    s = c->next;
    if (c->act) c->act();
}

// Returns 1 exactly once per press (debounced falling edge), 0 otherwise.
static uint8_t button_pressed(void) {
    static uint8_t last_level = 1; // pull-up: 1 = released
    static uint32_t last_change = 0;
    uint8_t current = (GPIOA->IDATA & (1 << 10)) ? 1 : 0;

    if (current != last_level && (msTicks - last_change) >= DEBOUNCE_MS) {
        last_change = msTicks;
        uint8_t falling_edge = (last_level == 1 && current == 0);
        last_level = current;
        return falling_edge;
    }
    return 0;
}
/* USER CODE END Includes */

int main(void) {
    // Configures clocks and selected components
    APM32_Init();

    /* USER CODE BEGIN Init */
    /* USER CODE END Init */

    while(1) {
        /* USER CODE BEGIN While */
        if (button_pressed()) {
            fsm_dispatch(EV_BTN);
        }
        /* USER CODE END While */
    }

    return 0;
}

/* USER CODE BEGIN Private Functions */
/* USER CODE END Private Functions */
