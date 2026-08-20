# MANUAL // UNIDAD 13: GPIO - ENTRADAS Y ANTI-REBOTE

---

## 13.1 Configurar un Pin como Entrada con Pull-Up

Para leer un boton, el pin se configura en modo entrada en vez de
salida. El valor `CNF = 0x8` en `CFGLOW` significa "Entrada con
pull-up/pull-down" -- el bit correspondiente en `ODATA` decide cual de
los dos: `1` selecciona pull-UP (el pin reposa en ALTO y el boton lo
lleva a BAJO al presionarlo), `0` selecciona pull-DOWN.

```c
#include <stdio.h>
#include <stdint.h>

typedef struct {
    uint32_t CFGLOW, CFGHIG, IDATA, ODATA;
} GPIO_TypeDef;

#define BTN_PIN 4

int main(void) {
    GPIO_TypeDef puerto = {0x44444444, 0x44444444, 0, 0};
    GPIO_TypeDef *GPIOB = &puerto;

    // PIN 4 ocupa los bits [19:16] de CFGLOW.
    GPIOB->CFGLOW &= ~(0xFU << 16);
    GPIOB->CFGLOW |= (0x8U << 16);

    // Selecciona pull-UP escribiendo 1 en el bit BTN_PIN de ODATA.
    GPIOB->ODATA |= (1 << BTN_PIN);

    printf("CFGLOW: 0x%08X\n", GPIOB->CFGLOW);
    return 0;
}
```

## 13.2 Leer un Boton Activo en Bajo (IDATA)

El estado logico de un pin de entrada se lee en `IDATA` (Input Data).
Con pull-up, un boton fisico normalmente conecta el pin a tierra al
presionarse -- por eso es "activo en bajo": el bit vale `1` cuando esta
LIBRE y `0` cuando esta PRESIONADO, exactamente al reves de lo intuitivo.

```c
#define BTN_PIN 4

int boton_presionado(unsigned int idata_muestra) {
    // Presionado == el bit BTN_PIN esta en 0.
    return (idata_muestra & (1 << BTN_PIN)) == 0;
}
```

## 13.3 Anti-Rebote (Debounce) con una Maquina de Estados

Un boton fisico real no pasa limpio de LIBRE a PRESIONADO: el contacto
mecanico "rebota" y genera varias transiciones espurias en microsegundos.
Leer `IDATA` una sola vez y confiar en el resultado produce falsos
positivos. La solucion estandar es una FSM de anti-rebote que solo valida
una pulsacion si la señal se mantiene ESTABLE durante N lecturas seguidas:

```c
#include <stdbool.h>

typedef enum { ST_IDLE, ST_DEBOUNCE, ST_PRESSED } DBState;
typedef enum { LVL_LOW, LVL_HIGH } PinLevel;

static DBState db_state = ST_IDLE;
static int stable_count = 0;
#define STABLE_THRESHOLD 3

bool debounce_update(PinLevel current_level) {
    bool event_detected = false;

    switch (db_state) {
        case ST_IDLE:
            // Primera lectura en HIGH: podria ser el inicio de una
            // pulsacion real o solo ruido -- pasa a vigilar.
            if (current_level == LVL_HIGH) {
                db_state = ST_DEBOUNCE;
                stable_count = 0;
            }
            break;

        case ST_DEBOUNCE:
            if (current_level == LVL_HIGH) {
                stable_count++;
                if (stable_count >= STABLE_THRESHOLD) {
                    db_state = ST_PRESSED;
                    event_detected = true; // evento validado UNA sola vez
                }
            } else {
                db_state = ST_IDLE; // bajo antes de tiempo: fue ruido
            }
            break;

        case ST_PRESSED:
            // Espera a que suelte el boton para poder detectar la
            // siguiente pulsacion.
            if (current_level == LVL_LOW) {
                db_state = ST_IDLE;
            }
            break;
    }
    return event_detected;
}
```

Nota clave: como `ST_IDLE` ya consume la primera lectura HIGH al entrar a
`ST_DEBOUNCE`, hacen falta `STABLE_THRESHOLD + 1` lecturas HIGH
consecutivas en total para que `event_detected` se vuelva verdadero -- no
solo `STABLE_THRESHOLD`. `maquinas_estado/ejercicio-03` ya introdujo esta
idea en C puro; aqui se conecta directamente a un registro `IDATA` real.

## 13.4 Combinando Entrada y Salida

El patron completo de un firmware de boton es: leer `IDATA` -> pasar por
`debounce_update()` -> si valida un evento, actuar sobre `ODATA` (por
ejemplo, alternar un LED con la `led_toggle()` de la Unidad 12). Cada
pieza ya la conoces por separado; esta unidad las conecta.
