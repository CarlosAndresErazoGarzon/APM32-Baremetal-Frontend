#include <stdio.h>

/*
 * MISION 25: DEFINICION DE DESCRIPTOR DE SENSOR
 * ---------------------------------------------
 * Define la estructura Sensor_t con campos:
 *   - int id;
 *   - char canal;
 *   - float voltaje;
 * 
 * Salida esperada:
 * Sensor ID: 101 | Canal: A | Voltaje: 3.25 V
 */

// TODO: Define Sensor_t con typedef struct


int main(void) {
    Sensor_t s = {101, 'A', 3.25};

    printf("Sensor ID: %d | Canal: %c | Voltaje: %.2f V\n", s.id, s.canal, s.voltaje);
    return 0;
}
