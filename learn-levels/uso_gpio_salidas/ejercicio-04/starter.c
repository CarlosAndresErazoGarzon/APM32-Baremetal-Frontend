#include <stdio.h>
#include <stdint.h>

/*
 * MISION 48: MULTIPLES LEDS - MASCARA DE GRUPO
 * -----------------------------------------------
 * Dos LEDs comparten el mismo puerto: PIN 2 (rojo) y PIN 5 (azul).
 * Configura ambos como salida push-pull (0x3) en CFGLOW, luego
 * enciende los dos AL MISMO TIEMPO con una sola operacion OR usando
 * una mascara combinada sobre ODATA.
 *
 * PIN 2 ocupa los bits [11:8]  de CFGLOW.
 * PIN 5 ocupa los bits [23:20] de CFGLOW.
 */

typedef struct {
    uint32_t CFGLOW, CFGHIG, IDATA, ODATA;
} GPIO_TypeDef;

#define LED_ROJO_PIN 2
#define LED_AZUL_PIN 5

int main(void) {
    GPIO_TypeDef puerto = {0x44444444, 0x44444444, 0, 0};
    GPIO_TypeDef *GPIOB = &puerto;

    // TODO: limpia y configura como salida push-pull (0x3) el PIN 2 (bits[11:8])

    // TODO: limpia y configura como salida push-pull (0x3) el PIN 5 (bits[23:20])

    // TODO: enciende los dos LEDs a la vez con una sola mascara OR sobre ODATA

    printf("CFGLOW final: 0x%08X\n", GPIOB->CFGLOW);
    printf("ODATA final:  0x%08X\n", GPIOB->ODATA);

    return 0;
}
