#include "apm32_config.h"
#include "delay.h"

/* USER CODE BEGIN Includes */
/* USER CODE END Includes */

void APM32_Init(void) {
    // System Initialization (Main Clocks)
    SystemInit();

    // Initialization of selected components
    SysTick_Init(); // Non-blocking heartbeat on the main loop
    RCM->APB2CLKEN |= (1 << 0) | (1 << 2) | (1 << 3); // AFIO, GPIOA, GPIOB

    // PA8: heartbeat LED (Output Push-Pull 50MHz)
    GPIOA->CFGHIG = (GPIOA->CFGHIG & ~(0xF << 0)) | (0x3 << 0);

    // PA10: button (Input Pull-up)
    GPIOA->CFGHIG = (GPIOA->CFGHIG & ~(0xF << 8)) | (0x8 << 8);
    GPIOA->ODATA |= (1 << 10); // enable pull-up

    // PB2: LED toggled by the button, from inside the EINT ISR
    GPIOB->CFGLOW = (GPIOB->CFGLOW & ~(0xF << 8)) | (0x3 << 8);

    // --- EINT10: PA10 drives external interrupt line 10 ---
    // AFIO_EINTSEL3 bits [11:8] select the port for line 10 -- 0x0 = Port A
    AFIO->EINTSEL3 = (AFIO->EINTSEL3 & ~(0xF << 8)) | (0x0 << 8);
    EINT->FTEN |= (1 << 10);   // trigger on falling edge (pull-up: press = 1->0)
    EINT->RTEN &= ~(1 << 10);  // no rising-edge trigger
    EINT->IPEND = (1 << 10);   // clear any stale pending flag before enabling
    EINT->IMASK |= (1 << 10);  // unmask line 10 (allow the interrupt request)

    // Line 10 shares NVIC channel EINT15_10_IRQn with lines 11-15
    NVIC_EnableIRQ(EINT15_10_IRQn);

    /* USER CODE BEGIN APM32_Init */
    /* USER CODE END APM32_Init */
}

/* USER CODE BEGIN Private Functions */
/* USER CODE END Private Functions */
