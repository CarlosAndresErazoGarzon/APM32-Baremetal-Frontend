#include "apm32_config.h"
#include "delay.h"

/* USER CODE BEGIN Includes */
/* USER CODE END Includes */

void APM32_Init(void) {
    // System Initialization (Main Clocks)
    SystemInit();

    // Initialization of selected components
    SysTick_Init(); // Debounce timing
    RCM->APB2CLKEN |= (1 << 2) | (1 << 3); // GPIOA, GPIOB

    // PB2: LED driven by the FSM's action functions (Output Push-Pull 50MHz)
    GPIOB->CFGLOW = (GPIOB->CFGLOW & ~(0xF << 8)) | (0x3 << 8);

    // PA10: button, generates the EV_BTN event (Input Pull-up)
    GPIOA->CFGHIG = (GPIOA->CFGHIG & ~(0xF << 8)) | (0x8 << 8);
    GPIOA->ODATA |= (1 << 10); // enable pull-up

    /* USER CODE BEGIN APM32_Init */
    /* USER CODE END APM32_Init */
}

/* USER CODE BEGIN Private Functions */
/* USER CODE END Private Functions */
