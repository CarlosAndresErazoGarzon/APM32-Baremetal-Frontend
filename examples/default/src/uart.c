#include "uart.h"

extern uint32_t SystemCoreClock;

void UART_Init(uint32_t baudrate) {
    // Enable RCM clocks
    RCM->APB2CLKEN |= (1 << 2) | (1 << 14);

    // Configure pins (PA9 = AF-PP, PA10 = Input)
    GPIOA->CFGHIG &= ~(0xFF << 4);
    GPIOA->CFGHIG |= (0x0B << 4);
    GPIOA->CFGHIG |= (0x04 << 8);

    // Configure baudrate dynamically
    USART1->BR = SystemCoreClock / baudrate;

    // Enable USART1 (UE, TE, RE)
    USART1->CTRL1 = (1 << 13) | (1 << 3) | (1 << 2);
}

void UART_Tx(char c) {
    while (!(USART1->STS & (1 << 7))); 
    USART1->DATA = (uint16_t)c;
}

void UART_SendString(const char *msg) {
    while(*msg) UART_Tx(*msg++);
}

uint8_t UART_Available(void) {
    // RXBNE (bit 5): 1 if there's new data
    return (USART1->STS & (1 << 5)) ? 1 : 0;
}

uint8_t UART_Rx(void) {
    return (uint8_t)USART1->DATA;
}

int _write(int file, char *ptr, int len) {
    for (int i = 0; i < len; i++) {
        UART_Tx(ptr[i]);
    }
    return len;
}
