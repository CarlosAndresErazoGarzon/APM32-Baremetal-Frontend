#include <stdio.h>
#include <stdint.h>

/*
 * MISION 50: LECTURA DE BOTON (POLLING)
 * -----------------------------------------
 * El boton es ACTIVO EN BAJO: presionado = bit en 0, libre = bit en 1.
 *
 * Implementa boton_presionado(), que recibe una muestra de IDATA y
 * retorna 1 si el boton (bit 4) esta presionado, 0 si esta libre.
 *
 * Recorre el arreglo de muestras e imprime el resultado de cada una.
 */

#define BTN_PIN 4

int boton_presionado(unsigned int idata_muestra) {
    // TODO: retorna 1 si el bit BTN_PIN de idata_muestra esta en 0
    return 0;
}

int main(void) {
    unsigned int muestras[] = {0xFFFFFFFF, 0xFFFFFFEF, 0xFFFFFFFF, 0xFFFFFFEF, 0xFFFFFFEF};
    int n = sizeof(muestras) / sizeof(muestras[0]);

    for (int i = 0; i < n; i++) {
        printf("Muestra %d: %s\n", i, boton_presionado(muestras[i]) ? "PRESIONADO" : "LIBRE");
    }

    return 0;
}
