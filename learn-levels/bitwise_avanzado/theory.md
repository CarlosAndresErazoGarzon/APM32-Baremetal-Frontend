# MANUAL // UNIDAD 10: REGISTROS BAREMETAL Y PROTOCOLOS DE BITS

---

## 10.1 Comprobación de Banderas de Estado (Status Flags)
En los registros de control de periféricos (como USART, I2C o Timers del APM32F030), cada bit representa el estado de una condición de hardware (por ejemplo: búfer vacío, dato recibido o interrupción pendiente).

Para comprobar si un bit específico está activo (`1`) se utiliza la operación **AND bit a bit (`&`)** con una máscara:

```c
#include <stdio.h>
#include <stdint.h>

#define STATUS_TXE_BIT  (1 << 7)  // Bit 7: Transmit Data Register Empty
#define STATUS_RXNE_BIT (1 << 5)  // Bit 5: Read Data Register Not Empty

int main(void) {
    uint8_t status_reg = 0xA0; // Binario: 10100000 (Bits 7 y 5 activos)

    if (status_reg & STATUS_TXE_BIT) {
        printf("TXE Activo: El transmisor esta listo para enviar.\n");
    }

    if ((status_reg & (1 << 0)) == 0) {
        printf("Bit 0 Inactivo: Linea libre.\n");
    }

    return 0;
}
```

---

## 10.2 Extracción de Campos de Bits (Bitfields & Prescalers)
Frecuentemente un registro almacena divisores de reloj (*prescalers*) o modos de operación en un grupo de varios bits contiguos. Para extraer ese valor numérico, se desplaza a la derecha y se aplica una máscara:

```c
#include <stdio.h>
#include <stdint.h>

// Supongamos que los bits [5:3] configuran el Prescaler de reloj (3 bits, mascara 0x07 = 0b111)
#define PRESCALER_SHIFT  3
#define PRESCALER_MASK   0x07

int main(void) {
    uint8_t control_reg = 0b00101000; // Bits 5:3 contienen 101 (valor decimal 5)

    // 1. Desplazar a la posicion 0
    // 2. Enmascarar con los 3 bits
    uint8_t prescaler = (control_reg >> PRESCALER_SHIFT) & PRESCALER_MASK;

    printf("Prescaler extraido: %d (Factor divisor: %d)\n", prescaler, 1 << prescaler);
    return 0;
}
```

---

## 10.3 Modificación Atómica de Campos (Read-Modify-Write)
Para cambiar un campo de varios bits dentro de un registro sin alterar los demás bits configurados:

1. **Limpiar (Clear)** los bits de destino mediante una operación `AND` con el negado de la máscara (`& ~`).
2. **Insertar (Set)** el nuevo valor desplazado mediante una operación `OR` (`|`).

```c
#include <stdio.h>
#include <stdint.h>

#define MODE_SHIFT  2
#define MODE_MASK   0x03 // 2 bits de mascara (0b11)

int main(void) {
    uint8_t reg = 0b11111111; // Registro con todos los bits en 1
    uint8_t nuevo_modo = 0b01; // Queremos colocar el modo 1 en los bits [3:2]

    // Paso 1: Limpiar los bits [3:2] -> reg &= ~(0x03 << 2)
    reg &= ~(MODE_MASK << MODE_SHIFT);
    // Ahora reg es 0b11110011

    // Paso 2: Insertar el nuevo valor
    reg |= (nuevo_modo << MODE_SHIFT);
    // Ahora reg es 0b11110111

    printf("Registro configurado: 0x%02X\n", reg);
    return 0;
}
```

---

## 10.4 Empaquetado y Desempaquetado de Tramas de 16 Bits
En buses industriales como CAN o Modbus, se empaquetan múltiples señales en una sola palabra de 16 bits (`uint16_t`) para optimizar el ancho de banda:

- **Bits [15:12]**: Identificador de Canal (4 bits, 0-15)
- **Bits [11:10]**: Estado Operativo (2 bits, 0-3)
- **Bits [9:0]**: Lectura ADC (10 bits, 0-1023)

```c
#include <stdio.h>
#include <stdint.h>

// Empaquetar
uint16_t empaquetar_trama(uint8_t canal, uint8_t estado, uint16_t adc) {
    uint16_t trama = 0;
    trama |= ((uint16_t)(canal & 0x0F) << 12);
    trama |= ((uint16_t)(estado & 0x03) << 10);
    trama |= ((uint16_t)(adc & 0x03FF));
    return trama;
}

// Desempaquetar
void desempaquetar_trama(uint16_t trama) {
    uint8_t canal = (trama >> 12) & 0x0F;
    uint8_t estado = (trama >> 10) & 0x03;
    uint16_t adc = trama & 0x03FF;

    printf("Trama 0x%04X -> Canal: %d | Estado: %d | ADC: %d\n", trama, canal, estado, adc);
}

int main(void) {
    uint16_t paquete = empaquetar_trama(9, 2, 750);
    desempaquetar_trama(paquete);
    return 0;
}
```
