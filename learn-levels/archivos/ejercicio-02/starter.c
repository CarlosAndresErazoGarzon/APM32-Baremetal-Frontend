#include <stdio.h>

/*
 * MISION 30: REGISTRO INCREMENTAL SIN PERDIDA DE DATOS
 * ----------------------------------------------------
 * Abre "registro.txt" en modo append ("a"):
 *   - Escribe: "Registro 2: OK\n"
 *   - Cierra con fclose()
 */

int main(void) {
    // 1. Archivo base
    FILE *f = fopen("registro.txt", "w");
    fprintf(f, "Registro 1: OK\n");
    fclose(f);

    // TODO: Abre en modo "a", escribe "Registro 2: OK\n" y cierra


    // 3. Verificacion
    f = fopen("registro.txt", "r");
    char linea[64];
    while (fgets(linea, sizeof(linea), f) != NULL) {
        printf("%s", linea);
    }
    fclose(f);

    return 0;
}
