#include <stdio.h>
#include <stdint.h>

/*
 * MISION 39: MODIFICACION ATOMICA DE CAMPO DE CONTROL
 * ---------------------------------------------------
 * En CONFIG = 0b10110010 (0xB2), modifica el campo [4:2]:
 *   1. Limpia el campo: CONFIG &= ~(0x07 << 2)
 *   2. Escribe el nuevo valor 6 (0b110): CONFIG |= (6 << 2)
 * 
 * Salida esperada:
 * Config Original: 0xB2
 * Config Modificada: 0xBA
 */

int main(void) {
    uint8_t CONFIG = 0b10110010; // 0xB2

    printf("Config Original: 0x%02X\n", CONFIG);

    // TODO: Limpia y asigna el nuevo valor de 3 bits


    printf("Config Modificada: 0x%02X\n", CONFIG);
    return 0;
}
