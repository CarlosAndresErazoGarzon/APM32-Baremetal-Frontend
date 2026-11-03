#include "apm32f10x.h"
#include "apm32_config.h"
#include "delay.h"
#include "uart.h"
#include <stdio.h>

/* USER CODE BEGIN Includes */
/* USER CODE END Includes */

int main(void) {
    // Configures clocks and selected components
    APM32_Init();

    printf("\r\n=== APM32 UART Echo ===\r\n");
    printf("Type something and press SEND...\r\n");

    /* USER CODE BEGIN Init */
    uint32_t last_report = 0;
    /* USER CODE END Init */

    while(1) {
        /* USER CODE BEGIN While */

        // Echo back whatever comes in, instantly
        if (UART_Available()) {
            uint8_t c = UART_Rx();
            UART_Tx(c);
            if (c == '\r') UART_Tx('\n'); // CRLF so a plain terminal doesn't overwrite lines
        }

        // Non-blocking heartbeat: report uptime and blink PB2 every 2s,
        // without ever stalling the echo above
        if ((msTicks - last_report) >= 2000) {
            last_report = msTicks;
            GPIOB->ODATA ^= (1 << 2);
            printf("\r\n[STATUS] Uptime: %lu ms\r\n", msTicks);
        }

        /* USER CODE END While */
    }

    return 0;
}
