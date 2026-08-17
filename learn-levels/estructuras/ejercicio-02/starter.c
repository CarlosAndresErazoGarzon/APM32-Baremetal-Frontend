#include <stdio.h>
#include <stdbool.h>

/*
 * MISION 26: TABLA DE SENSORES ACTIVOS EN BUS
 * -------------------------------------------
 * Recorre la tabla e imprime UNICAMENTE los sensores que tengan habilitado == true:
 * Sensor: Temperatura en Pin 5
 * Sensor: Luminosidad en Pin 7
 */

typedef struct {
    char nombre[16];
    int pin;
    bool habilitado;
} SensorConfig_t;

int main(void) {
    SensorConfig_t sensores[3] = {
        {"Temperatura", 5, true},
        {"Humedad", 2, false},
        {"Luminosidad", 7, true}
    };

    // TODO: Filtra e imprime los sensores habilitados


    return 0;
}
