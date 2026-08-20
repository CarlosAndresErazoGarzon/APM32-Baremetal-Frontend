#include <stdio.h>
#include <stdint.h>

/*
 * MISION 45: RELOJ Y CONFIGURACION DE PINES
 * ------------------------------------------
 * Antes de usar cualquier periferico GPIO en el APM32 hay que:
 *   1. Habilitar su reloj en el bus APB2 (bit 3 = GPIOB).
 *   2. Configurar el modo del pin en el registro CFGLOW (4 bits por pin).
 *
 * El PIN 2 usa los bits [11:8] de CFGLOW. El valor 0x3 significa
 * Salida Push-Pull a 50MHz.
 *
 * Imprime, en ese orden:
 *   RCM->APB2CLKEN: 0x%08X
 *   GPIOB->CFGLOW: 0x%08X
 */

typedef struct {
    uint32_t APB2CLKEN;
} RCM_TypeDef;

typedef struct {
    uint32_t CFGLOW, CFGHIG, IDATA, ODATA;
} GPIO_TypeDef;

int main(void) {
    RCM_TypeDef rcm_reg = {0};
    RCM_TypeDef *RCM = &rcm_reg;

    GPIO_TypeDef puerto = {0x44444444, 0x44444444, 0, 0}; // valores de reset
    GPIO_TypeDef *GPIOB = &puerto;

    // TODO: Habilita el reloj de GPIOB (bit 3 de RCM->APB2CLKEN)

    // TODO: Configura el PIN 2 como salida push-pull 50MHz (0x3) en CFGLOW.
    //       Primero limpia los 4 bits del pin [11:8], luego aplica el valor.

    printf("RCM->APB2CLKEN: 0x%08X\n", RCM->APB2CLKEN);
    printf("GPIOB->CFGLOW: 0x%08X\n", GPIOB->CFGLOW);

    return 0;
}
