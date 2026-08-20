#include <stdio.h>
#include <stdint.h>

/*
 * MISION 49: CONFIGURAR ENTRADA CON PULL-UP
 * --------------------------------------------
 * Un boton en el PIN 4 se configura como entrada con resistencia de
 * pull-up interna: CNF = 0x8 (Input pull-up/pull-down). El bit
 * correspondiente en ODATA selecciona pull-UP (1) en vez de pull-DOWN (0).
 *
 * El PIN 4 ocupa los bits [19:16] de CFGLOW.
 */

typedef struct {
    uint32_t CFGLOW, CFGHIG, IDATA, ODATA;
} GPIO_TypeDef;

#define BTN_PIN 4

int main(void) {
    GPIO_TypeDef puerto = {0x44444444, 0x44444444, 0, 0};
    GPIO_TypeDef *GPIOB = &puerto;

    // TODO: limpia los bits [19:16] de CFGLOW y aplica CNF = 0x8 (input pull-up/down)

    // TODO: selecciona pull-UP escribiendo un 1 en el bit BTN_PIN de ODATA

    printf("CFGLOW: 0x%08X\n", GPIOB->CFGLOW);
    printf("ODATA:  0x%08X\n", GPIOB->ODATA);

    return 0;
}
