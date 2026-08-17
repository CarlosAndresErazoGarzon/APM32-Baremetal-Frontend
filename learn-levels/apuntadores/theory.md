# MANUAL // UNIDAD 9: APUNTADORES Y MAPEO DIRECTO DE MEMORIA

---

## 9.1 Concepto de Apuntador y Operadores (`&` y `*`)
Un apuntador (o puntero) es una variable que almacena la **dirección física de memoria** de otra variable en la SRAM del microcontrolador.

- **Operador de Dirección (`&`)**: Obtiene la dirección de memoria donde reside una variable (`&variable`).
- **Operador de Indirección o Desreferenciación (`*`)**: Accede o modifica el valor contenido en la dirección a la que apunta el puntero (`*ptr`).

```c
#include <stdio.h>

int main(void) {
    int sensor_raw = 4095;
    int *ptr = &sensor_raw; // ptr almacena la direccion de sensor_raw

    printf("Valor original: %d\n", sensor_raw);
    printf("Direccion de memoria: %p\n", (void*)ptr);

    // Modificando el valor a traves del puntero
    *ptr = 2048;
    printf("Valor modificado en RAM: %d\n", sensor_raw);

    return 0;
}
```

---

## 9.2 Paso por Referencia (Mutación Directa en RAM)
En C, los argumentos de las funciones se pasan por valor (copia). Para que una función modifique variables del ámbito que la invocó sin sobrecargar la pila de memoria (*stack*), pasamos su dirección de memoria:

```c
#include <stdio.h>

// Funcion de calibracion in-place
void calibrar_voltaje(float *voltaje, float ganancia, float offset) {
    if (voltaje == NULL) return;
    *voltaje = (*voltaje * ganancia) + offset;
}

int main(void) {
    float lectura_adc = 2.50f;

    // Pasamos la direccion de memoria usando el operador &
    calibrar_voltaje(&lectura_adc, 1.1f, -0.05f);

    printf("Lectura Calibrada: %.3f V\n", lectura_adc);
    return 0;
}
```

---

## 9.3 Apuntadores a Estructuras y Operador Flecha (`->`)
Cuando una función recibe un puntero a una estructura `struct *`, el acceso a sus miembros se realiza de manera concisa mediante el **operador flecha (`->`)**, que equivale a `(*ptr).miembro`:

```c
#include <stdio.h>

typedef struct {
    int id;
    int estado;
    float medicion;
} Periferico_t;

// Actualizacion eficiente de estructura por referencia
void reiniciar_periferico(Periferico_t *dev) {
    if (dev == NULL) return;
    dev->estado = 0;       // Equivale a (*dev).estado = 0;
    dev->medicion = 0.0f;  // Equivale a (*dev).medicion = 0.0f;
}

int main(void) {
    Periferico_t p1 = { 10, 1, 45.8f };

    reiniciar_periferico(&p1);
    printf("Dev ID %d | Estado: %d | Medicion: %.1f\n", p1.id, p1.estado, p1.medicion);
    return 0;
}
```

---

## 9.4 Aritmética de Apuntadores y Búferes Contiguos
Los arreglos se almacenan en bloques contiguos de memoria. Al incrementar un puntero (`ptr++`), este avanza la cantidad exacta de bytes que ocupa su tipo de dato (`sizeof(*ptr)`):

```c
#include <stdio.h>

int main(void) {
    int buffer[4] = { 100, 200, 300, 400 };
    int *p = buffer; // Equivale a &buffer[0]

    for (int i = 0; i < 4; i++) {
        // Acceso mediante desplazamiento del puntero
        printf("Elemento %d: %d en dir: %p\n", i, *(p + i), (void*)(p + i));
    }
    return 0;
}
```
