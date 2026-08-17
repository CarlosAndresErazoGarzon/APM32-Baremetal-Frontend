#include <stdio.h>

/*
 * MISION 31: CARGA DE CONFIGURACION CON FGETS
 * -------------------------------------------
 * Lee el archivo "config.txt" con fgets() linea a linea:
 * Para cada linea imprime: printf("Config: %s", linea);
 */

int main(void) {
    FILE *f = fopen("config.txt", "w");
    fprintf(f, "IP=192.168.1.50\n");
    fprintf(f, "PUERTO=8080\n");
    fprintf(f, "MODO=AUTO\n");
    fclose(f);

    // TODO: Abre "config.txt" en modo "r", lee con fgets e imprime


    return 0;
}
