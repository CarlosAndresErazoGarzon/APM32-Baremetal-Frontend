#include "apm32_config.h"
#include "delay.h"

/* USER CODE BEGIN Includes */
/* USER CODE END Includes */

void APM32_Init(void) {
    // System Initialization (Main Clocks)
    SystemInit();

    // Initialization of selected components
    SysTick_Init(); // PoV refresh + button debounce timing
    RCM->APB2CLKEN |= (1 << 0) | (1 << 2) | (1 << 3); // Enable AFIO, GPIOA, GPIOB clocks

    // PA15 is a JTAG pin by default -- free it for GPIO use while keeping SWD
    AFIO->REMAP1 = (AFIO->REMAP1 & ~(0x7 << 24)) | (0x2 << 24);

    // PA0-PA7: 7-segment data lines, Push-Pull Output 50MHz
    GPIOA->CFGLOW = 0x33333333;

    // PA8, PA9: LEDs (Output) | PA10, PA11, PA12, PA15: buttons (Input Pull-up)
    // PA13 (SWDIO) and PA14 (SWCLK) are left untouched -- never repurpose them.
    GPIOA->CFGHIG &= ~((0xF << 0) | (0xF << 4) | (0xF << 8) | (0xF << 12) | (0xF << 16) | (0xF << 28));
    GPIOA->CFGHIG |=  ((0x3 << 0) | (0x3 << 4) | (0x8 << 8) | (0x8 << 12) | (0x8 << 16) | (0x8 << 28));
    GPIOA->ODATA  |=  (1 << 10) | (1 << 11) | (1 << 12) | (1 << 15); // enable pull-ups

    // PB8, PB9: 7-segment selectors | PB12-PB15: LEDs -- all Push-Pull Output 50MHz
    GPIOB->CFGHIG &= ~((0xF << 0) | (0xF << 4) | (0xF << 16) | (0xF << 20) | (0xF << 24) | (0xF << 28));
    GPIOB->CFGHIG |=  ((0x3 << 0) | (0x3 << 4) | (0x3 << 16) | (0x3 << 20) | (0x3 << 24) | (0x3 << 28));

    // Both displays OFF (selectors are active-LOW PNP transistors) until the loop starts
    GPIOB->ODATA |= (1 << 8) | (1 << 9);

    /* USER CODE BEGIN APM32_Init */
    /* USER CODE END APM32_Init */
}

/* USER CODE BEGIN Private Functions */
/* USER CODE END Private Functions */
