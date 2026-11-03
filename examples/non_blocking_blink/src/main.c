#include "apm32f10x.h"
#include "apm32_config.h"
#include "delay.h"

/* USER CODE BEGIN Includes */
/* USER CODE END Includes */

int main(void) {
    // Configures clocks and selected components
    APM32_Init();

    /* USER CODE BEGIN Init */
    uint32_t last_toggle = 0;
    const uint32_t INTERVAL_MS = 500;
    /* USER CODE END Init */

    while(1) {
        /* USER CODE BEGIN While */
        if ((msTicks - last_toggle) >= INTERVAL_MS) {
            last_toggle = msTicks;
            GPIOB->ODATA ^= (1 << 2); // Toggle LED PB2
        }

        /* USER CODE END While */
    }

    return 0;
}
