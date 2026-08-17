#include <stdio.h>

/*
 * MISION 10: CLASIFICACION DE VOLTAJE DE CELDA
 * --------------------------------------------
 * Clasifica la lectura ADC de la bateria:
 *   - adc >= 800 -> printf("ADC %d: Nivel ALTO\n", adc);
 *   - adc >= 400 -> printf("ADC %d: Nivel MEDIO\n", adc);
 *   - De lo contrario -> printf("ADC %d: Nivel BAJO\n", adc);
 */

void clasificar_adc(int adc) {
    // TODO: Implementa la clasificacion multinivel

}

int main(void) {
    clasificar_adc(650);
    clasificar_adc(250);
    clasificar_adc(900);
    return 0;
}
