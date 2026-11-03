#include "apm32f10x.h"
#include "apm32_config.h"
#include "delay.h"

/* USER CODE BEGIN Includes */
/* USER CODE END Includes */

int main(void) {
    // Configures clocks and selected components (this also starts the IWDT --
    // from here on, the board resets itself in ~2s unless fed with IWDT->KEY = 0xAAAA)
    APM32_Init();

    /* USER CODE BEGIN Init */
    // RCM->CSTS keeps the reset cause latched across resets. If this flag is
    // set, we didn't just power on -- the watchdog actually bit us last time.
    if (RCM->CSTS_B.IWDTRSTFLG) {
        for (int i = 0; i < 3; i++) {
            GPIOA->ODATA |= (1 << 8);
            delay_ms(150);
            GPIOA->ODATA &= ~(1 << 8);
            delay_ms(150);
        }
        RCM->CSTS_B.RSTFLGCLR = 1; // clear it so the NEXT boot isn't confused by this one
    }

    uint32_t last_heartbeat = 0;
    const uint32_t HEARTBEAT_MS = 200;
    /* USER CODE END Init */

    while(1) {
        /* USER CODE BEGIN While */
        if ((msTicks - last_heartbeat) >= HEARTBEAT_MS) {
            last_heartbeat = msTicks;
            GPIOB->ODATA ^= (1 << 2);
        }

        IWDT->KEY = 0xAAAA; // feed the dog every pass

        // Holding PA10 simulates a firmware hang: a real infinite loop that
        // never comes back to feed the watchdog -- the IWDT resets the board
        // on its own about 2 seconds later.
        if (!(GPIOA->IDATA & (1 << 10))) {
            while (1);
        }
        /* USER CODE END While */
    }

    return 0;
}

/* USER CODE BEGIN Private Functions */
/* USER CODE END Private Functions */
