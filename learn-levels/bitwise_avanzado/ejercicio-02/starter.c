#include <stdio.h>
#include <stdint.h>

/*
 * MISION 38: EXTRACCION DE CAMPO PRESCALER DE RELOJ
 * -------------------------------------------------
 * Extrae el campo de 3 bits [5:3] de CTRL_REG = 0b00111000:
 * Desplaza 3 bits a la derecha y aplica mascara 0x07 (0b111).
 * 
 * Salida esperada:
 * Registro: 0x38
 * Prescaler Extraido: 7
 */

int main(void) {
    uint8_t CTRL_REG = 0b00111000; // 0x38

    // TODO: Extrae el prescaler e imprime


    return 0;
}
