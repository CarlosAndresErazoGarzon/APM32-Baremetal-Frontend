#include <stdio.h>

/*
 * MISION 23: ODOMETRO Y CONTADOR DE EVENTOS
 * -----------------------------------------
 * Implementa int registrar_pulso(void) usando una variable interna static int contador = 0;
 * Incrementa y retorna el conteo acumulado.
 * 
 * Salida esperada:
 * Evento detectado: pulso #1
 * Evento detectado: pulso #2
 * Evento detectado: pulso #3
 */

int registrar_pulso(void) {
    // TODO: usa una variable static int contador = 0; increméntala y retórnala
    return 0;
}

int main(void) {
    for (int i = 0; i < 3; i++) {
        int pulso = registrar_pulso();
        printf("Evento detectado: pulso #%d\n", pulso);
    }
    return 0;
}
