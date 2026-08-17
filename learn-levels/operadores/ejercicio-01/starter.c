#include <stdio.h>

/*
 * MISION 05: FORMATO DE TRAMA DE INSTRUMENTACION
 * ----------------------------------------------
 * Genera la linea de reporte del sensor primario con formato estricto:
 * Sensor [101] | Estado: A | Lectura: 3.30V (Hex: 0x65)
 * 
 * Especificadores: %d para ID, %c para Estado, %.2f para Lectura, %02X para Hex.
 */

int main(void) {
    int id_sensor = 101;
    float lectura_voltaje = 3.2954;
    char estado_canal = 'A';

    // TODO: Imprime la trama en una sola linea


    return 0;
}
