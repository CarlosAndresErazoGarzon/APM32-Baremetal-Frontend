#include <stdio.h>
#include <stdint.h>
#include <stdbool.h>

/*
 * MISION 28: TELEMETRIA COMPACTA CON TIMESTAMP
 * --------------------------------------------
 * Imprime la estructura Telemetria_t con formato:
 * T: 1500 ms | Bateria: 85% | Alerta: SI
 */

typedef struct {
    uint16_t timestamp_ms;
    uint8_t bateria_pct;
    bool alerta;
} Telemetria_t;

int main(void) {
    Telemetria_t t = { 1500, 85, true };

    // TODO: Imprime el reporte formateado


    return 0;
}
