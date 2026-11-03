#include "apm32f10x.h"
#include "apm32_config.h"
#include "delay.h"

/* USER CODE BEGIN Includes */
#define DEBOUNCE_MS 15
/* USER CODE END Includes */

int main(void) {
    // Configures clocks and selected components
    APM32_Init();

    /* USER CODE BEGIN Init */
    uint32_t last_heartbeat = 0;
    const uint32_t HEARTBEAT_MS = 500;
    /* USER CODE END Init */

    while(1) {
        /* USER CODE BEGIN While */
        // This is the whole point of the example: the main loop never polls
        // the button. It is free to do its own non-blocking work (this
        // heartbeat on PA8) while PB2 is toggled entirely from the EINT ISR
        // below, the instant the edge happens -- no polling latency at all.
        if ((msTicks - last_heartbeat) >= HEARTBEAT_MS) {
            last_heartbeat = msTicks;
            GPIOA->ODATA ^= (1 << 8);
        }
        /* USER CODE END While */
    }

    return 0;
}

/* USER CODE BEGIN Private Functions */
// Fires on every falling edge on PA10 (EINT line 10). Interrupts don't
// remove contact bounce -- we still debounce, just with a time check here
// instead of polling IDATA in the main loop.
void EINT15_10_IRQHandler(void) {
    if (EINT->IPEND & (1 << 10)) {
        static uint32_t last_event = 0;

        if ((msTicks - last_event) >= DEBOUNCE_MS) {
            last_event = msTicks;
            GPIOB->ODATA ^= (1 << 2);
        }

        EINT->IPEND = (1 << 10); // write 1 to clear -- mandatory, or this fires forever
    }
}
/* USER CODE END Private Functions */
