#include <stdio.h>
#include <stdint.h>

/*
 * MISION 46: ENCENDIDO Y APAGADO DE LED (ODATA SET/CLEAR)
 * ---------------------------------------------------------
 * Con el pin ya configurado como salida, se controla el estado logico
 * del LED escribiendo en el registro de datos de salida (ODATA).
 *
 *   led_on()  -> activa el bit del pin con OR   (|=)
 *   led_off() -> desactiva el bit del pin con AND del negado (&= ~)
 *
 * El LED esta en el PIN 2 (bit 2).
 */

typedef struct {
    uint32_t CFGLOW, CFGHIG, IDATA, ODATA;
} GPIO_TypeDef;

#define LED_PIN 2

void led_on(GPIO_TypeDef *gpio) {
    // TODO: activa el bit LED_PIN de ODATA
}

void led_off(GPIO_TypeDef *gpio) {
    // TODO: desactiva el bit LED_PIN de ODATA
}

int main(void) {
    GPIO_TypeDef puerto = {0, 0, 0, 0};
    GPIO_TypeDef *GPIOB = &puerto;

    led_on(GPIOB);
    printf("ODATA tras encender: 0x%08X\n", GPIOB->ODATA);

    led_off(GPIOB);
    printf("ODATA tras apagar:   0x%08X\n", GPIOB->ODATA);

    return 0;
}
