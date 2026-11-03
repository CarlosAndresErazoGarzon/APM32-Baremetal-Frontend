#include "apm32f10x.h"
#include "apm32_config.h"
#include "delay.h"

/* USER CODE BEGIN Includes */
/* USER CODE END Includes */

// Tutorial 5: Real-Time Clock (RTC).
//
// The Blue Pill's onboard 32.768kHz crystal (LSE) drives a battery-backed
// counter that keeps ticking once per second, independent of the CPU clock
// and SysTick -- RTC_Init() (in apm32_config.c) sets it up once. This just
// reads RTC->CNTL (seconds since boot/reset) and multiplexes the last two
// digits onto the same 7-segment setup from Tutorial 2.

#define REFRESH_MS 5

const uint8_t nums[10] = {
    0x3F, 0x06, 0x5B, 0x4F, 0x66, 0x6D, 0x7D, 0x07, 0x7F, 0x6F
};

void show_seconds(void) {
    static uint32_t last_refresh = 0;
    static uint8_t  showing_tens = 0;

    if ((msTicks - last_refresh) < REFRESH_MS) return;
    last_refresh = msTicks;

    uint8_t seconds = (uint8_t)(RTC->CNTL % 60); // single 16-bit read, atomic

    GPIOB->ODATA |= (1 << 8) | (1 << 9); // both OFF first -- avoid ghosting

    if (showing_tens) {
        uint8_t tens = seconds / 10;
        GPIOA->ODATA = (GPIOA->ODATA & ~0xFF) | (~nums[tens] & 0xFF);
        GPIOB->ODATA &= ~(1 << 9); // Tens ON
    } else {
        uint8_t units = seconds % 10;
        GPIOA->ODATA = (GPIOA->ODATA & ~0xFF) | (~nums[units] & 0xFF);
        GPIOB->ODATA &= ~(1 << 8); // Units ON
    }

    showing_tens = !showing_tens;
}

int main(void) {
    // Configures clocks and selected components (also starts the RTC --
    // see apm32_config.c)
    APM32_Init();

    /* USER CODE BEGIN Init */
    /* USER CODE END Init */

    while(1) {
        /* USER CODE BEGIN While */
        show_seconds();
        /* USER CODE END While */
    }

    return 0;
}
