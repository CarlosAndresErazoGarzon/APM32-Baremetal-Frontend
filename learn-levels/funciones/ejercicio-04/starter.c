#include <stdio.h>

/*
 * MISION 24: LIMITADOR DE SEGURIDAD DE ACTUADOR (CLAMP)
 * -----------------------------------------------------
 * Implementa int clamp(int valor, int min, int max):
 *   - Si valor < min: retorna min
 *   - Si valor > max: retorna max
 *   - De lo contrario: retorna valor
 * 
 * Salida esperada:
 * Entrada 120 -> Clamped: 100
 * Entrada -15 -> Clamped: 0
 * Entrada 45 -> Clamped: 45
 */

int clamp(int valor, int min, int max) {
    // TODO: aplica los limites min/max
    return valor;
}

int main(void) {
    printf("Entrada 120 -> Clamped: %d\n", clamp(120, 0, 100));
    printf("Entrada -15 -> Clamped: %d\n", clamp(-15, 0, 100));
    printf("Entrada 45 -> Clamped: %d\n", clamp(45, 0, 100));
    return 0;
}
