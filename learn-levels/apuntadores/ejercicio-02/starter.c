#include <stdio.h>

/*
 * MISION 34: INTERCAMBIO DE CANALES Y CALIBRACION
 * -----------------------------------------------
 * Implementa:
 *   1. void swap(int *a, int *b)
 *   2. void calibrar(float *lectura, float offset)
 * 
 * Salida esperada:
 * Canales Swapped: A=2, B=1
 * Voltaje Calibrado: 3.30 V
 */

// TODO: Implementa swap y calibrar


int main(void) {
    int canal_a = 1, canal_b = 2;
    swap(&canal_a, &canal_b);
    printf("Canales Swapped: A=%d, B=%d\n", canal_a, canal_b);

    float v = 3.10;
    calibrar(&v, 0.20);
    printf("Voltaje Calibrado: %.2f V\n", v);

    return 0;
}
