#include "apm32_config.h"
#include "delay.h"

/* USER CODE BEGIN Includes */
/* USER CODE END Includes */

void APM32_Init(void) {
    // System Initialization (Main Clocks)
    SystemInit();

    // Initialization of selected components
    SysTick_Init(); // Heartbeat + simulated-hang timing
    RCM->APB2CLKEN |= (1 << 2) | (1 << 3); // GPIOA, GPIOB

    // PB2: heartbeat LED (Output Push-Pull 50MHz)
    GPIOB->CFGLOW = (GPIOB->CFGLOW & ~(0xF << 8)) | (0x3 << 8);

    // PA8: "recovered from watchdog reset" indicator (Output Push-Pull 50MHz)
    GPIOA->CFGHIG = (GPIOA->CFGHIG & ~(0xF << 0)) | (0x3 << 0);

    // PA10: button -- holding it down simulates a firmware hang
    GPIOA->CFGHIG = (GPIOA->CFGHIG & ~(0xF << 8)) | (0x8 << 8);
    GPIOA->ODATA |= (1 << 10); // enable pull-up

    // --- Independent Watchdog (IWDT) ---
    // Timeout = PSC_divider / LSI(~40kHz) * (CNTRLD+1)
    // PSC=0x4 -> divider 64 -> tick = 64/40000s = 1.6ms; CNTRLD=1249 -> ~2.0s timeout
    IWDT->KEY = 0x5555;    // unlock PSC/CNTRLD for writing
    IWDT->PSC = 0x4;
    IWDT->CNTRLD = 1249;
    IWDT->KEY = 0xAAAA;    // load the reload value into the counter once
    IWDT->KEY = 0xCCCC;    // start the watchdog -- from here on it WILL reset us in ~2s if not fed

    /* USER CODE BEGIN APM32_Init */
    /* USER CODE END APM32_Init */
}

/* USER CODE BEGIN Private Functions */
/* USER CODE END Private Functions */
