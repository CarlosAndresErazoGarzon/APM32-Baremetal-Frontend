#include "apm32_config.h"
#include "delay.h"

/* USER CODE BEGIN Includes */
/* USER CODE END Includes */

void APM32_Init(void) {
    // System Initialization (Main Clocks)
    SystemInit();

    // Initialization of selected components
    SysTick_Init(); // delay timer (not used by this example, kept for consistency)
    RCM->APB2CLKEN |= (1 << 3); // Enable GPIOB clock

    // Buttons PB10, PB11 (Input Pull-up, 0x8) + LEDs PB12-PB15 (Output, 0x3) --
    // all in CFGHIG, so one write configures all 6 pins at once.
    GPIOB->CFGHIG &= ~(0xFFFFFF << 8);
    GPIOB->CFGHIG |=  (0x333388 << 8);

    // Enable the buttons' internal pull-ups
    GPIOB->ODATA |= (1 << 10) | (1 << 11);

    /* USER CODE BEGIN APM32_Init */
    /* USER CODE END APM32_Init */
}

/* USER CODE BEGIN Private Functions */
/* USER CODE END Private Functions */
