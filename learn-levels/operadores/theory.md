# MANUAL // UNIDAD 2: OPERADORES, BANDERAS Y MASCARAS DE BITS

---

## 2.1 Formateo de Telemetría Compacta
El puerto serie requiere empaquetar lecturas con precisión. `%.2f` formatea flotantes a dos decimales exactos; `%02X` formatea enteros en hexadecimal de 2 dígitos con cero a la izquierda (`0x0A`, `0x5F`).

Un caso especial a vigilar: dividir dos enteros (`int / int`) siempre produce otro entero, truncando cualquier parte decimal, incluso si el resultado se guarda en una variable `float`. Hay que forzar el tipo con un *cast* `(float)` ANTES de dividir.

```c
#include <stdio.h>

int main(void) {
    int muestras = 7;
    int lecturas = 4;
    float promedio;

    // Trampa clásica: ambos operandos son int, el resultado se trunca
    // ANTES de guardarse en el float -- imprime "1.00", no "1.75".
    promedio = muestras / lecturas;
    printf("Sin cast: %.2f\n", promedio);

    // (float) en al menos UNO de los operandos fuerza division real.
    promedio = (float) muestras / lecturas;
    printf("Con cast: %.2f\n", promedio);

    int registro = 10;
    printf("Registro en hex: 0x%02X\n", registro);

    return 0;
}
```

## 2.2 Lógica Booleana y Flags de Seguridad (`<stdbool.h>`)
El tipo `bool` almacena `true` (1) o `false` (0). `&&` (AND) es un enclavamiento de seguridad -- ambas condiciones deben ser seguras; `||` (OR) detecta cualquier fallo en la cadena; `!` (NOT) invierte una señal lógica.

```c
#include <stdio.h>
#include <stdbool.h>

int main(void) {
    bool puerta_cerrada = true;
    bool presion_ok = false;

    // AND: el sistema solo arranca si AMBAS condiciones son seguras.
    bool listo_para_arrancar = puerta_cerrada && presion_ok;
    printf("Listo para arrancar: %d\n", listo_para_arrancar);

    // OR: la alarma se dispara si CUALQUIERA de los dos falla.
    bool alarma = !puerta_cerrada || !presion_ok;
    printf("Alarma activa: %d\n", alarma);

    return 0;
}
```

## 2.3 Operadores Bit a Bit en Registros (`<stdint.h>`)
Los registros periféricos de 8 bits (`uint8_t`) se controlan mediante operaciones a nivel de bit: **AND (`&`)** filtra/aísla bits, **OR (`|`)** activa bits (SET), **XOR (`^`)** conmuta bits (TOGGLE), y los **desplazamientos (`<<`/`>>`)** mueven máscaras de control a la posición correcta. La Unidad 9 profundiza en este tema sobre registros reales -- aquí es solo la primera exposición.

```c
#include <stdio.h>
#include <stdint.h>

int main(void) {
    uint8_t status_reg = 0b00000000;

    // SET: activa el bit 2 sin tocar los demás.
    status_reg |= (1 << 2);
    printf("Tras SET bit 2: 0x%02X\n", status_reg);

    // AND: pregunta si el bit 2 esta activo (mascara + comparacion).
    if (status_reg & (1 << 2)) {
        printf("Bit 2 activo.\n");
    }

    // TOGGLE: invierte el bit 2 (si estaba en 1, pasa a 0).
    status_reg ^= (1 << 2);
    printf("Tras TOGGLE bit 2: 0x%02X\n", status_reg);

    return 0;
}
```
