#include <stdio.h>

/*
 * MISION 22: FILTRO DE PROMEDIO DE MUESTRAS
 * -----------------------------------------
 * Implementa float calcular_promedio(const int muestras[], int n):
 * Calcula y retorna la media aritmetica en punto flotante.
 * 
 * Salida esperada:
 * Muestras procesadas: 5
 * Promedio: 22.00
 */

float calcular_promedio(const int muestras[], int n) {
    // TODO: calcula y retorna la media aritmetica en punto flotante
    return 0.0;
}

int main(void) {
    int buffer[5] = {20, 22, 19, 25, 24};
    int n = 5;
    float prom = calcular_promedio(buffer, n);

    printf("Muestras procesadas: %d\n", n);
    printf("Promedio: %.2f\n", prom);
    return 0;
}
