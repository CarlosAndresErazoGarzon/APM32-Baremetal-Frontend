#include <stdio.h>

/*
 * MISION 32: PROCESAMIENTO NUMERICO DESDE ARCHIVO
 * -----------------------------------------------
 * Lee los valores de "datos.txt" con fscanf(f, "%d", &val):
 * Calcula la suma y la media aritmetica:
 * Datos leidos: 5
 * Suma: 150
 * Promedio: 30.00
 */

int main(void) {
    FILE *f = fopen("datos.txt", "w");
    fprintf(f, "10 20 30 40 50\n");
    fclose(f);

    // TODO: Lee con fscanf y calcula suma y promedio


    return 0;
}
