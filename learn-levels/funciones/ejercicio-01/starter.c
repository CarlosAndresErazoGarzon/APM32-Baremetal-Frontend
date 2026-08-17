#include <stdio.h>

/*
 * MISION 21: CONVERTIDORES DE UNIDADES FISICAS
 * --------------------------------------------
 * Implementa:
 *   1. float celsius_a_fahrenheit(float c) -> retorna (c * 1.8) + 32.0
 *   2. float calcular_potencia(float v, float i) -> retorna v * i
 * 
 * Salida esperada:
 * 25.00 C = 77.00 F
 * Potencia: 0.66 W
 */

// TODO: Define celsius_a_fahrenheit y calcular_potencia


int main(void) {
    float f = celsius_a_fahrenheit(25.0);
    float p = calcular_potencia(3.3, 0.2);

    printf("25.00 C = %.2f F\n", f);
    printf("Potencia: %.2f W\n", p);
    return 0;
}
