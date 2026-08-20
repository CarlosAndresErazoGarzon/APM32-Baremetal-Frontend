#include <stdio.h>

/*
 * MISION 29: INICIALIZACION DE REGISTRO EN DISCO
 * ----------------------------------------------
 * Abre "log.txt" en modo "w":
 *   - Escribe: "Inicio del Sistema\n"
 *   - Escribe: "ID Dispositivo: 101\n"
 *   - Cierra con fclose()
 *
 * Salida en consola (solo si el archivo se creo correctamente):
 * Archivo log.txt creado exitosamente.
 */

int main(void) {
    FILE *f = NULL;

    // TODO: Abre "log.txt" en modo "w" (asigna el resultado a f), escribe
    // las dos lineas y cierra con fclose()


    if (f != NULL) {
        printf("Archivo log.txt creado exitosamente.\n");
    }
    return 0;
}
