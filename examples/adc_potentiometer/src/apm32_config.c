#include "apm32_config.h"
#include "delay.h"

/* USER CODE BEGIN Includes */
/* USER CODE END Includes */

void APM32_Init(void) {
    // System Initialization (Main Clocks)
    SystemInit();

    // Initialization of selected components
    SysTick_Init(); // delay timer
    RCM->APB2CLKEN |= (1 << 2) | (1 << 3) | (1 << 9); // GPIOA, GPIOB, ADC1

    // --- Potentiometer wiper on PA2 (ADC1 Channel 2) ---
    // ADC prescaler: 72MHz / 6 = 12MHz (max allowed is 14MHz)
    RCM->CFG = (RCM->CFG & ~(0x3 << 14)) | (0x2 << 14);

    // PA2 as Analog Input -- CNF/MODE = 0x0 (see PIN_MODES.md)
    GPIOA->CFGLOW &= ~(0xF << 8);

    ADC1->CTRL2 |= (1 << 0);         // ADCEN = 1 (wake up)
    ADC1->CTRL2 |= (1 << 3);         // Reset calibration (CALRST)
    while (ADC1->CTRL2 & (1 << 3));
    ADC1->CTRL2 |= (1 << 2);         // Start calibration (CAL)
    while (ADC1->CTRL2 & (1 << 2));
    ADC1->REGSEQ3 = 2;               // Channel 2 (PA2) as the only conversion

    // --- Bar-graph LEDs: PB12-PB15, PA8, PA9 -- same 6 as Taller 2 ---
    GPIOB->CFGHIG &= ~((0xF << 16) | (0xF << 20) | (0xF << 24) | (0xF << 28));
    GPIOB->CFGHIG |=  ((0x3 << 16) | (0x3 << 20) | (0x3 << 24) | (0x3 << 28));
    GPIOA->CFGHIG &= ~((0xF << 0) | (0xF << 4));
    GPIOA->CFGHIG |=  ((0x3 << 0) | (0x3 << 4));

    /* USER CODE BEGIN APM32_Init */
    /* USER CODE END APM32_Init */
}

/* USER CODE BEGIN Private Functions */
/* USER CODE END Private Functions */
