#include <stdio.h>

/*
 * MISION 27: IDENTIFICACION DEL NODO CRITICO
 * ------------------------------------------
 * En la red de 4 muestras, encuentra e imprime la de mayor valor termico:
 * Sensor Pico: ID 2 con 31.80 C
 */

typedef struct {
    int id;
    float valor;
} Muestra_t;

int main(void) {
    Muestra_t red[4] = { {1, 24.2}, {2, 31.8}, {3, 19.5}, {4, 28.0} };

    // TODO: Encuentra e imprime la muestra pico


    return 0;
}
