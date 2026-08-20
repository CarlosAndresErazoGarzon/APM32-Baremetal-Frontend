# MANUAL // UNIDAD 3: ESTRUCTURAS DE CONTROL DE FLUJO

---

## 3.1 Decisiones Binarias (`if-else`)
Permite conmutar actuadores y ejecutar rutinas de seguridad ante umbrales críticos de sensores.

```c
#include <stdio.h>

int main(void) {
    int temperatura = 85;

    if (temperatura > 80) {
        printf("ALERTA: Activando ventilador de emergencia.\n");
    } else {
        printf("Temperatura dentro de rango normal.\n");
    }

    return 0;
}
```

## 3.2 Clasificación Multinivel (`if - else if - else`)
Evalúa rangos numéricos continuos (como niveles de batería o lecturas de transductores) en orden jerárquico -- la primera condición que se cumpla es la que se ejecuta, y las demás se ignoran.

```c
#include <stdio.h>

int main(void) {
    int bateria = 45;
    int senal = 90;

    // Combinar condiciones con && permite exigir varias cosas a la vez.
    if (bateria > 80) {
        printf("Bateria alta.\n");
    } else if (bateria >= 20 && senal >= 50) {
        printf("Bateria media, senal estable.\n");
    } else {
        printf("Revisar bateria o senal.\n");
    }

    return 0;
}
```

## 3.3 Decodificadores con Selección Múltiple (`switch-case`)
Estructura óptima para máquinas de estados e intérpretes de comandos de telemetría UART. Requiere `break;` para evitar el arrastre de ejecución (*fallthrough*) hacia el siguiente `case`.

```c
#include <stdio.h>

int main(void) {
    char comando = 'B';
    int estado;

    switch (comando) {
        case 'A':
            estado = 1;
            break;
        case 'B':
            estado = 2;
            break;
        default:
            estado = -1; // comando desconocido
    }

    printf("Estado resultante: %d\n", estado);

    return 0;
}
```
