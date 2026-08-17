#include <stdio.h>

/*
 * MISION 12: SECUENCIADOR DE FASES DE TRAFICO
 * -------------------------------------------
 * Valida el estado de la baliza luminosa:
 *   - 'V' -> printf("Semaforo [V]: Siga Adelante\n");
 *   - 'A' -> printf("Semaforo [A]: Precaucion\n");
 *   - 'R' -> printf("Semaforo [R]: Pare Total\n");
 *   - default -> printf("Semaforo [%c]: Estado Invalido\n", color);
 */

void estado_semaforo(char color) {
    // TODO: switch(color)

}

int main(void) {
    estado_semaforo('V');
    estado_semaforo('A');
    estado_semaforo('R');
    estado_semaforo('Z');
    return 0;
}
