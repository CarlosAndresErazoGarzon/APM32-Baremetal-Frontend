# MANUAL // UNIDAD 5: ARREGLOS, CADENAS Y MATRICES EN MEMORIA

---

## 5.1 Búferes Lineales (Arreglos 1D)
Colección contigua de bytes indexada desde 0. Ideal para almacenamiento de series temporales de sensores -- cada posición se accede y modifica directamente con `arreglo[indice]`.

```c
#include <stdio.h>

int main(void) {
    float lecturas[5] = {3.5, 4.0, 2.8, 5.0, 4.2};

    // Modificar un elemento por su indice.
    lecturas[2] = 3.0;
    printf("Primera lectura: %.1f\n", lecturas[0]);
    printf("Tercera lectura (corregida): %.1f\n", lecturas[2]);

    // Recorrido con bucle -- el patron mas comun para procesar un buffer.
    int muestras[4] = {10, 20, 30, 40};
    int suma = 0;
    for (int i = 0; i < 4; i++) {
        printf("Posicion %d: %d\n", i, muestras[i]);
        suma += muestras[i];
    }
    printf("Suma total: %d\n", suma);

    return 0;
}
```

## 5.2 Cadenas de Caracteres y Terminador Nulo
En C los mensajes de texto son arreglos `char[]` que finalizan obligatoriamente con el byte cero `'\0'` -- sin él, cualquier función que recorra la cadena (o `printf` con `%s`) seguiría leyendo memoria basura más allá del final.

```c
#include <stdio.h>

// Recorre la cadena hasta encontrar el terminador nulo -- así es como
// funciona internamente strlen() y cualquier funcion que procese texto.
int contar_letras(char texto[], char busqueda) {
    int contador = 0;
    int i = 0;
    while (texto[i] != '\0') {
        if (texto[i] == busqueda) {
            contador++;
        }
        i++;
    }
    return contador;
}

int main(void) {
    char mensaje[] = "programacion embebida";
    int n = contar_letras(mensaje, 'a');
    printf("La letra 'a' aparece %d veces\n", n);
    return 0;
}
```

## 5.3 Matrices Bidimensionales (2D)
Almacenamiento matricial en memoria fila por fila (`matriz[fila][columna]`) -- recorrerla siempre necesita dos bucles anidados, uno por cada dimensión.

```c
#include <stdio.h>

int main(void) {
    int mapa_pines[3][3] = {
        {1, 0, 0},
        {0, 1, 0},
        {0, 0, 1}
    };

    for (int fila = 0; fila < 3; fila++) {
        for (int col = 0; col < 3; col++) {
            printf("%d ", mapa_pines[fila][col]);
        }
        printf("\n");
    }

    return 0;
}
```
