#include <stdio.h>

/*
 * MISION 35: MUTACION DE ESTRUCTURAS POR REFERENCIA
 * -------------------------------------------------
 * Implementa void actualizar_sensor(Sensor_t *s, float nuevo_voltaje):
 * Asigna s->voltaje = nuevo_voltaje;
 * 
 * Salida esperada:
 * Antes  : Sensor [101] = 2.80 V
 * Despues: Sensor [101] = 3.30 V
 */

typedef struct {
    int id;
    float voltaje;
} Sensor_t;

void actualizar_sensor(Sensor_t *s, float nuevo_voltaje) {
    // TODO: asigna s->voltaje = nuevo_voltaje;
}

int main(void) {
    Sensor_t s1 = {101, 2.80};
    printf("Antes  : Sensor [%d] = %.2f V\n", s1.id, s1.voltaje);

    actualizar_sensor(&s1, 3.30);
    printf("Despues: Sensor [%d] = %.2f V\n", s1.id, s1.voltaje);

    return 0;
}
