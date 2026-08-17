#include <stdio.h>
#include <stdint.h>

/*
 * MISION 37: COMPROBACION DE BANDERAS EN REGISTRO DE ESTADO
 * ---------------------------------------------------------
 * En STATUS_REG = 0b10000101, verifica los bits:
 *   - Bit 0 (TX_READY): if (STATUS_REG & (1 << 0)) -> printf("TX_READY: ACTIVO\n");
 *   - Bit 2 (RX_READY): if (STATUS_REG & (1 << 2)) -> printf("RX_READY: ACTIVO\n");
 *   - Bit 7 (ERROR)   : if (STATUS_REG & (1 << 7)) -> printf("ERROR: ACTIVO\n");
 */

int main(void) {
    uint8_t STATUS_REG = 0b10000101;

    // TODO: Comprueba e imprime las 3 banderas activas


    return 0;
}
