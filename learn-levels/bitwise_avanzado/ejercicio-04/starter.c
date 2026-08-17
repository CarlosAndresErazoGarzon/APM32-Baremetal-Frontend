#include <stdio.h>
#include <stdint.h>
#include <stdbool.h>

/*
 * MISION 40: EMPAQUETADO Y DESEMPAQUETADO DE TELEMETRIA
 * -----------------------------------------------------
 * Empaqueta en un uint16_t trama:
 *   - id: 42 (bits [7:0])
 *   - canal: 3 (bits [11:8])
 *   - alerta: true (bit 15)
 * 
 * Desempaqueta y muestra los datos.
 * Salida esperada:
 * Trama Hex: 0x832A
 * ID Desempaquetado: 42
 * Canal Desempaquetado: 3
 * Alerta Desempaquetada: 1
 */

int main(void) {
    uint8_t id = 42;
    uint8_t canal = 3;
    bool alerta = true;

    // TODO: Empaqueta y desempaqueta


    return 0;
}
