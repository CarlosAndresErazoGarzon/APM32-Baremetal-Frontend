#include "apm32_config.h"
#include "delay.h"
#include "uart.h"
#include "board_pins.h"

/* USER CODE BEGIN Includes */
/* USER CODE END Includes */

// Arranca el reloj del sistema, el SysTick (msTicks para debounce/refresco)
// y los clocks de AFIO/GPIOA/GPIOB; libera PA15/PB3/PB4 de JTAG dejando SWD
// activo; y configura cada pin del montaje recorriendo PINES[] por rangos
// de rol (botones, LEDs, segmentos, selectores de dígito).
void APM32_Init(void) {
    SystemInit();

    SysTick_Init();
    RCM->APB2CLKEN |= (1 << 0) | (1 << 2) | (1 << 3); // AFIO, GPIOA, GPIOB

    // Libera PA15/PB3/PB4 de JTAG conservando SWD
    AFIO->REMAP1 = (AFIO->REMAP1 & ~(0x7 << 24)) | (0x2 << 24);

    // Botones: Input Pull-up
    for (int r = ROLE_BTN0; r <= ROLE_BTN3; r++) {
        gpio_config_role(r, MODE_INPUT_PU);
        pin_set(r);
    }

    // LEDs: Output Push-Pull, arrancan apagados. El nivel se escribe ANTES
    // de volver el pin salida (escribir ODR no hace nada mientras es
    // entrada) para que no haya ni un instante en el nivel por defecto
    // equivocado al conmutar a salida -- importante si algún día un pin
    // de estos maneja algo que no debe prenderse ni un instante (un relé).
    for (int r = ROLE_LED0; r <= ROLE_LED5; r++) {
        pin_clear(r);
        gpio_config_role(r, MODE_OUTPUT_PP);
    }

    // Segmentos: Output Push-Pull, ánodo común, arrancan apagados (ALTO)
    for (int r = ROLE_SEG_A; r <= ROLE_SEG_DP; r++) {
        pin_set(r);
        gpio_config_role(r, MODE_OUTPUT_PP);
    }

    // Selectores de dígito: Output Push-Pull, PNP, arrancan apagados (ALTO)
    for (int r = ROLE_DIGIT1; r <= ROLE_DIGIT2; r++) {
        pin_set(r);
        gpio_config_role(r, MODE_OUTPUT_PP);
    }

    /* USER CODE BEGIN APM32_Init */
    UART_Init(115200);
    /* USER CODE END APM32_Init */
}

/* USER CODE BEGIN Private Functions */
/* USER CODE END Private Functions */
