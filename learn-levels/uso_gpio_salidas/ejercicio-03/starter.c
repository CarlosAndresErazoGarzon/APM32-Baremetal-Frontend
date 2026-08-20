#include <stdio.h>
#include <stdint.h>

/*
 * MISION 47: PATRON DE PARPADEO (TOGGLE SEQUENCE)
 * -------------------------------------------------
 * Un parpadeo se implementa invirtiendo el bit del LED en cada paso,
 * en vez de encenderlo/apagarlo explicitamente:
 *   ODATA ^= (1 << pin);
 *
 * Implementa led_toggle() e imprime el valor de ODATA despues de cada
 * uno de 5 toggles consecutivos.
 */

typedef struct {
    uint32_t CFGLOW, CFGHIG, IDATA, ODATA;
} GPIO_TypeDef;

#define LED_PIN 2

void led_toggle(GPIO_TypeDef *gpio) {
    // TODO: invierte el bit LED_PIN de ODATA (XOR)
}

int main(void) {
    GPIO_TypeDef puerto = {0, 0, 0, 0};
    GPIO_TypeDef *GPIOB = &puerto;

    for (int i = 0; i < 5; i++) {
        led_toggle(GPIOB);
        printf("Toggle %d -> ODATA: 0x%08X\n", i + 1, GPIOB->ODATA);
    }

    return 0;
}
