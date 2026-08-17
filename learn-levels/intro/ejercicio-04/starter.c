#include <stdio.h>

/*
 * MISION 04: ESCALADO Y CONVERSION ADC (10 BITS)
 * ----------------------------------------------
 * El convertidor ADC entrega un entero crudo de 10 bits (0..1023).
 * Dado raw_adc = 512 y max_adc = 1023:
 *   1. Calcula el porcentaje de escala completa: ((float)raw_adc / max_adc) * 100.0
 *   2. Calcula la tension real equivalente (referencia 3.3V): ((float)raw_adc / max_adc) * 3.3
 * 
 * Salida esperada (dos decimales %.2f):
 * Nivel: 50.05 %
 * Tension: 1.65 V
 */

int main(void) {
    int raw_adc = 512;
    int max_adc = 1023;

    // TODO: Calcula porcentaje y tension usando casting float


    // TODO: Imprime con formato %.2f


    return 0;
}
