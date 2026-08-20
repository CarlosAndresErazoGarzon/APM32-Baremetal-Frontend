# MANUAL // UNIDAD 12: GPIO - CONFIGURACION Y SALIDAS

---

## 12.1 El Struct del Periferico y el Reloj de Bus

En el APM32 (como en casi cualquier microcontrolador ARM Cortex-M), cada
periferico se controla escribiendo en un puñado de registros de 32 bits
mapeados en memoria. En C, ese bloque de registros se modela como un
`struct`, y una variable "periferico" no es mas que un puntero a la
direccion donde ese struct vive:

```c
#include <stdio.h>
#include <stdint.h>

typedef struct {
    uint32_t APB2CLKEN;
} RCM_TypeDef;

typedef struct {
    uint32_t CFGLOW, CFGHIG, IDATA, ODATA;
} GPIO_TypeDef;

int main(void) {
    RCM_TypeDef rcm_reg = {0};
    RCM_TypeDef *RCM = &rcm_reg;

    // Antes de usar CUALQUIER periferico hay que habilitar su reloj --
    // sin esto, escribir en sus registros no tiene efecto en hardware real.
    // GPIOB vive en el bit 3 del bus APB2.
    RCM->APB2CLKEN |= (1 << 3);

    printf("RCM->APB2CLKEN: 0x%08X\n", RCM->APB2CLKEN);
    return 0;
}
```

En los ejercicios de esta unidad, el struct se crea en la pila (`GPIO_TypeDef
puerto; GPIO_TypeDef *GPIOB = &puerto;`) en vez de apuntar a una direccion
de memoria real -- eso simula el hardware sin necesitar la placa conectada,
y es exactamente lo que ya practicaste con `->` en la Unidad 9.

## 12.2 CFGLOW: 4 Bits por Pin

El registro `CFGLOW` configura el MODO de los pines 0 a 7, usando 4 bits
por pin (`CFGHIG` hace lo mismo para los pines 8-15). El valor `0x3`
significa "Salida Push-Pull a 50MHz" -- el modo mas comun para encender
un LED o manejar una señal digital de salida.

```c
#include <stdio.h>
#include <stdint.h>

typedef struct {
    uint32_t CFGLOW, CFGHIG, IDATA, ODATA;
} GPIO_TypeDef;

int main(void) {
    GPIO_TypeDef puerto = {0x44444444, 0x44444444, 0, 0}; // valores de reset
    GPIO_TypeDef *GPIOB = &puerto;

    // El PIN 2 ocupa los bits [11:8] de CFGLOW.
    // Paso 1: limpiar esos 4 bits (dejarlos en 0) con AND del negado.
    GPIOB->CFGLOW &= ~(0xF << 8);
    // Paso 2: aplicar el modo deseado (0x3 = salida push-pull) con OR.
    GPIOB->CFGLOW |= (0x3 << 8);

    printf("CFGLOW: 0x%08X\n", GPIOB->CFGLOW);
    return 0;
}
```

Este patron "limpiar la mascara, luego aplicar el valor" (`&= ~(mask)`
seguido de `|= (valor << pos)`) es el mismo que ya usaste en la Unidad 10
con registros de bits -- aqui simplemente se aplica a un campo de varios
bits en vez de a un solo flag.

## 12.3 ODATA: Encender, Apagar y Alternar

Una vez el pin esta configurado como salida, su estado logico (alto/bajo)
se controla escribiendo en `ODATA` (Output Data). Tres operaciones cubren
todos los casos:

```c
#include <stdio.h>
#include <stdint.h>

typedef struct {
    uint32_t CFGLOW, CFGHIG, IDATA, ODATA;
} GPIO_TypeDef;

#define LED_PIN 2

void led_on(GPIO_TypeDef *gpio)     { gpio->ODATA |= (1 << LED_PIN); }  // SET
void led_off(GPIO_TypeDef *gpio)    { gpio->ODATA &= ~(1 << LED_PIN); } // CLEAR
void led_toggle(GPIO_TypeDef *gpio) { gpio->ODATA ^= (1 << LED_PIN); }  // XOR

int main(void) {
    GPIO_TypeDef puerto = {0, 0, 0, 0};
    GPIO_TypeDef *GPIOB = &puerto;

    led_on(GPIOB);
    printf("Encendido: 0x%08X\n", GPIOB->ODATA);
    led_toggle(GPIOB);
    printf("Toggle:    0x%08X\n", GPIOB->ODATA);

    return 0;
}
```

## 12.4 Multiples Pines: Mascaras Combinadas

Cuando dos o mas LEDs comparten el mismo puerto, configurarlos y
encenderlos de a uno funciona, pero una sola operacion con una mascara
combinada es mas eficiente y es el patron que veras en drivers reales:

```c
#define LED_ROJO_PIN 2
#define LED_AZUL_PIN 5

// Enciende los dos LEDs al mismo tiempo con una sola instruccion OR:
GPIOB->ODATA |= (1 << LED_ROJO_PIN) | (1 << LED_AZUL_PIN);
```

Cada pin sigue configurandose por separado en `CFGLOW`/`CFGHIG` (los 4
bits de un pin no se tocan entre si), pero el registro de datos `ODATA`
si puede actualizarse para varios pines en una sola linea.
