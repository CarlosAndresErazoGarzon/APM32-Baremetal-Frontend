#include <stdio.h>
#include <stdint.h>

/*
 * MISION 08: MASCARAS ATOMICAS DE CONTROL GPIO
 * --------------------------------------------
 * Aplica en orden las operaciones sobre el puerto (valor inicial 0x2C):
 *   1. SET Bit 0: puerto |= (1 << 0)
 *   2. CLEAR Bit 5: puerto &= ~(1 << 5)
 *   3. TOGGLE Bit 3: puerto ^= (1 << 3)
 * 
 * Salida esperada:
 * Paso 1 (Set Bit 0)   : 0x2D
 * Paso 2 (Clear Bit 5) : 0x0D
 * Paso 3 (Toggle Bit 3): 0x05
 */

int main(void) {
    uint8_t puerto = 0b00101100; // 0x2C

    // TODO Paso 1: Enciende el Bit 0
    

    printf("Paso 1 (Set Bit 0)   : 0x%02X\n", puerto);

    // TODO Paso 2: Apaga el Bit 5
    

    printf("Paso 2 (Clear Bit 5) : 0x%02X\n", puerto);

    // TODO Paso 3: Conmuta el Bit 3
    

    printf("Paso 3 (Toggle Bit 3): 0x%02X\n", puerto);

    return 0;
}
