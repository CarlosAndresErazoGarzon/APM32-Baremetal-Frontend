# MANUAL // UNIDAD 2: OPERADORES, BANDERAS Y MASCARAS DE BITS

## 2.1 Formateo de Telemetría Compacta
El puerto serie requiere empaquetar lecturas con precisión:
- `%.2f`: Formatea flotantes a dos decimales exactos.
- `%02X`: Formatea enteros en hexadecimal de 2 dígitos con cero a la izquierda (`0x0A`, `0x5F`).

## 2.2 Lógica Booleana y Flags de Seguridad (`<stdbool.h>`)
El tipo `bool` almacena `true` (1) o `false` (0):
- `&&` (AND): Enclavamiento de seguridad (ambas condiciones deben ser seguras).
- `||` (OR): Detección de cualquier fallo en la cadena.
- `!` (NOT): Inversión de señal lógica.

## 2.3 Operadores Bit a Bit en Registros (`<stdint.h>`)
Los registros periféricos de 8 bits (`uint8_t`) se controlan mediante operaciones a nivel de bit:
- **AND (`&`)**: Filtrado / Aislamiento de bits.
- **OR (`|`)**: Activación de bits (SET).
- **XOR (`^`)**: Conmutación de bits (TOGGLE).
- **Shift (`<<` / `>>`)**: Desplazamiento de máscaras de control.
