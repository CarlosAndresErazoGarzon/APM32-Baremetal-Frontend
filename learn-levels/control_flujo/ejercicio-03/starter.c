#include <stdio.h>

/*
 * MISION 11: DECODIFICADOR DE COMANDOS UART
 * -----------------------------------------
 * Procesa el byte de comando recibido por puerto serie:
 *   - 'S' -> printf("Comando [S]: Iniciar Motor\n");
 *   - 'P' -> printf("Comando [P]: Pausar Motor\n");
 *   - 'R' -> printf("Comando [R]: Reiniciar Sistema\n");
 *   - default -> printf("Comando [%c]: Desconocido\n", cmd);
 */

void procesar_comando(char cmd) {
    // TODO: switch(cmd)

}

int main(void) {
    procesar_comando('S');
    procesar_comando('R');
    procesar_comando('X');
    return 0;
}
