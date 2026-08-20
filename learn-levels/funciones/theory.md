# MANUAL // UNIDAD 6: FUNCIONES Y ARQUITECTURA MODULAR

---

## 6.1 Drivers y Funciones Puras
Modularización del código para aislar cálculos matemáticos y controladores de hardware. Una función `void` ejecuta una acción sin devolver nada; una función con tipo de retorno (`int`, `float`, ...) calcula y entrega un valor con `return`.

```c
#include <stdio.h>

// Funcion con retorno: calcula y entrega un valor.
int sumar(int a, int b) {
    return a + b;
}

// Funcion void: ejecuta una accion, no devuelve nada.
void imprimir_saludo(int veces) {
    for (int i = 0; i < veces; i++) {
        printf("Sistema inicializado.\n");
    }
}

int main(void) {
    int total = sumar(5, 10);
    printf("La suma es: %d\n", total);

    imprimir_saludo(2);

    return 0;
}
```

## 6.2 Paso de Búferes a Funciones (`const int arr[], int n`)
En C los arreglos pasan su dirección de inicio, no una copia -- por eso una función que recibe un arreglo siempre debe acompañarlo del tamaño `int n` (el arreglo por sí solo no "sabe" cuántos elementos tiene). Calificar con `const` cuando la función solo LEE el arreglo documenta la intención y evita modificaciones accidentales.

```c
#include <stdio.h>

// const: esta funcion promete no modificar el arreglo.
// n: obligatorio, ya que arr[] por si solo no trae su tamano.
float promedio(const int arr[], int n) {
    int suma = 0;
    for (int i = 0; i < n; i++) {
        suma += arr[i];
    }
    return (float) suma / n;
}

int main(void) {
    int lecturas[] = {10, 20, 30, 40};
    int n = sizeof(lecturas) / sizeof(lecturas[0]);

    printf("Promedio: %.2f\n", promedio(lecturas, n));

    return 0;
}
```

## 6.3 Variables Estáticas (`static`)
Una variable `static` interna conserva su estado entre llamadas, permitiendo implementar acumuladores y odómetros sin recurrir a variables globales -- se inicializa una sola vez y "recuerda" su último valor en cada nueva llamada a la función.

```c
#include <stdio.h>

void contador_llamadas(void) {
    int normal = 0;           // se reinicia a 0 en CADA llamada
    static int persistente = 0; // se inicializa UNA sola vez, en total

    normal++;
    persistente++;

    printf("Normal: %d | Persistente: %d\n", normal, persistente);
}

int main(void) {
    contador_llamadas();
    contador_llamadas();
    contador_llamadas();

    return 0;
}
```
