#include <stdio.h>

/*
 * MISION 15: FILTRO DE RUIDO Y PARADA DE TELEMETRIA
 * -------------------------------------------------
 * Procesa el arreglo paquetes[6] = {10, -1, 20, -5, 99, 30}:
 *   - Si paquete < 0: Descarta la muestra (continue)
 *   - Si paquete == 99: Fin de transmision -> printf("Fin de transmision detectado.\n"); (break)
 *   - Paquete valido: printf("Paquete procesado: %d\n", paquetes[i]);
 */

int main(void) {
    int paquetes[6] = {10, -1, 20, -5, 99, 30};

    // TODO: Recorre el bufer aplicando continue y break


    return 0;
}
