#include "apm32_config.h"
#include "delay.h"

/* USER CODE BEGIN Includes */
/* USER CODE END Includes */

void APM32_Init(void) {
    // System Initialization (Main Clocks)
    SystemInit();

    // Initialization of selected components
    SysTick_Init(); // PoV refresh timing
    RCM->APB2CLKEN |= (1 << 2) | (1 << 3); // GPIOA, GPIOB

    // --- 7-segment display (same wiring as Tutorial 2): PA0-PA7 segments,
    //     PB8/PB9 PNP digit selectors, Common Anode ---
    GPIOA->CFGLOW = 0x33333333;
    GPIOB->CFGHIG &= ~(0xFF << 0);
    GPIOB->CFGHIG |=  (0x33 << 0);
    GPIOB->ODATA  |= (1 << 8) | (1 << 9); // both digits OFF until the loop starts

    // --- RTC: unlock the backup domain, start the LSE crystal, enable RTC ---
    RCM->APB1CLKEN |= (1 << 27) | (1 << 28); // BKP, PMU clocks
    PMU->CTRL_B.BPWEN = 1;                   // allow writes to BDCTRL/RTC regs

    RCM->BDCTRL_B.LSEEN = 1;                 // start the 32.768kHz crystal
    while (!RCM->BDCTRL_B.LSERDYFLG);        // wait for it to stabilize

    RCM->BDCTRL_B.RTCSRCSEL = 0x1;           // 01 = LSE feeds the RTC
    RCM->BDCTRL_B.RTCCLKEN  = 1;             // turn the RTC on

    while (!RTC->CSTS_B.RSYNCFLG);           // wait for RTC registers to resync

    // Config mode: set the prescaler so a 32768Hz crystal ticks the
    // counter once per second (32768 - 1), and zero the counter.
    while (!RTC->CSTS_B.OCFLG);
    RTC->CSTS_B.CFGMFLG = 1;
    RTC->PSCRLDH = 0;
    RTC->PSCRLDL = 32767;
    RTC->CNTH = 0;
    RTC->CNTL = 0;
    RTC->CSTS_B.CFGMFLG = 0;
    while (!RTC->CSTS_B.OCFLG);

    /* USER CODE BEGIN APM32_Init */
    /* USER CODE END APM32_Init */
}

/* USER CODE BEGIN Private Functions */
/* USER CODE END Private Functions */
