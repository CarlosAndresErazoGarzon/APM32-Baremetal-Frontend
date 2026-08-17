# MANUAL // UNIDAD 1: FUNDAMENTOS DE C & CORE BOOT

## 1.1 Estructura del Firmware
Todo programa en C baremetal para microcontroladores (como el APM32F030) inicia su flujo secuencial en la función principal:
```c
#include <stdio.h>

int main(void) {
    // Inicialización de periféricos
    return 0; // Código de salida 0 (OK)
}
```

## 1.2 Tipos de Datos y Huella en Memoria
En sistemas embebidos cada byte cuenta:
- `int` (4 bytes / 32 bits): Variables de control, contadores, IDs.
- `char` (1 byte / 8 bits): Caracteres ASCII, comandos de 1 byte, identificadores de canal.
- `float` (4 bytes / IEEE 754): Lecturas de sensores de punto flotante (tensión, temperatura).

## 1.3 Aritmética y Búferes Circulares
- Operadores estándar: `+`, `-`, `*`, `/`.
- Operador Módulo `%`: Retorna el residuo entero de una división. Fundamental para implementar punteros de índices en búferes circulares en memoria (`idx = (idx + 1) % BUFFER_SIZE`).
- Casting explícito: `((float)raw_adc / max_adc)` convierte la división entera a decimal antes del cálculo de escalado de tensión.
