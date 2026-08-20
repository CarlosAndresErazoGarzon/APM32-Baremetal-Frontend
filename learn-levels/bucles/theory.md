# MANUAL // UNIDAD 4: BUCLES, MUESTREO Y TEMPORIZACION

---

## 4.1 Bucle Determinado (`for`)
Utilizado para procesar ventanas de muestras de longitud conocida y barridos temporales -- se sabe de antemano exactamente cuántas veces debe repetirse.

```c
#include <stdio.h>

int main(void) {
    int suma_muestras = 0;

    for (int i = 1; i <= 5; i++) {
        suma_muestras += i;
        printf("Muestra %d, acumulado: %d\n", i, suma_muestras);
    }

    return 0;
}
```

## 4.2 Espera Activa / Polling (`while`)
Ejecuta comprobaciones repetitivas hasta que un registro de hardware o condición física se cumpla -- no se sabe de antemano cuántas iteraciones tomará. `do-while` es su variante que garantiza al menos UNA ejecución antes de comprobar la condición, útil para menús o para leer un sensor por primera vez.

```c
#include <stdio.h>

int main(void) {
    int lectura_adc = 0;
    int umbral = 3;

    // while: si la condicion ya es falsa, el cuerpo nunca se ejecuta.
    while (lectura_adc < umbral) {
        lectura_adc++;
        printf("Polling... lectura_adc = %d\n", lectura_adc);
    }
    printf("Umbral alcanzado.\n\n");

    // do-while: el cuerpo SIEMPRE corre al menos una vez.
    int intentos = 0;
    do {
        intentos++;
        printf("Intento de conexion #%d\n", intentos);
    } while (intentos < 3);

    return 0;
}
```

## 4.3 Control de Flujo Interno (`break` y `continue`)
`continue` descarta muestras corruptas o valores fuera de rango sin detener el proceso -- salta directo a la siguiente iteración. `break` aborta el bucle inmediatamente al detectar una condición de fin de trama.

```c
#include <stdio.h>

int main(void) {
    int muestras[] = {12, -1, 8, 15, -1, 6, 99, 3};
    int n = sizeof(muestras) / sizeof(muestras[0]);

    for (int i = 0; i < n; i++) {
        if (muestras[i] == -1) {
            continue; // muestra corrupta: la descarta y sigue
        }
        if (muestras[i] == 99) {
            break; // 99 marca fin de trama: aborta el bucle aqui
        }
        printf("Muestra valida: %d\n", muestras[i]);
    }

    return 0;
}
```
