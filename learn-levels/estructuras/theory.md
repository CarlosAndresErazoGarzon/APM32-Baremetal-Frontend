# MANUAL // UNIDAD 7: ESTRUCTURAS DE DATOS (STRUCT)

---

## 7.1 Definición e Inicialización de Estructuras (`typedef struct`)
En firmware baremetal y sistemas embebidos, una estructura (`struct`) permite agrupar variables de diferentes tipos de datos bajo un mismo bloque contiguo de memoria. Es fundamental para modelar transductores, descriptores de periféricos y paquetes de comunicación:

```c
#include <stdio.h>

// Definición de tipo para descriptor de sensor
typedef struct {
    int id;             // Identificador numérico (4 bytes)
    char canal;         // Canal ADC o bus ('A', 'B', 'C')
    float voltaje;      // Lectura analógica en voltios
} Sensor_t;

int main(void) {
    // Inicialización directa por lista de miembros
    Sensor_t s1 = { 101, 'A', 3.28f };

    // Acceso a miembros mediante el operador punto (.)
    printf("Sensor ID: %d | Canal: %c | Voltaje: %.2fV\n", s1.id, s1.canal, s1.voltaje);
    return 0;
}
```

---

## 7.2 Acceso y Modificación de Miembros (`.`)
Para leer o asignar valores a las variables internas de la estructura, se utiliza el **operador punto (`.`)**:

```c
#include <stdio.h>

typedef struct {
    int id;
    int estado;     // 1: Activo, 0: Inactivo
    float temp_c;
} Nodo_t;

int main(void) {
    Nodo_t nodo;
    nodo.id = 1;
    nodo.estado = 1;
    nodo.temp_c = 24.5f;

    if (nodo.estado == 1) {
        printf("Nodo %d OPERATIVO: %.1f C\n", nodo.id, nodo.temp_c);
    }
    return 0;
}
```

---

## 7.3 Arreglos de Estructuras (Tablas de Dispositivos)
Para gestionar múltiples sensores en un mismo bus I2C o SPI, se declaran arreglos donde cada elemento es una instancia de la estructura:

```c
#include <stdio.h>

typedef struct {
    int id;
    char tipo;      // 'T': Temperatura, 'P': Presión
    float valor;
} Transductor_t;

int main(void) {
    Transductor_t red[3] = {
        { 1, 'T', 25.4f },
        { 2, 'P', 1013.2f },
        { 3, 'T', 28.1f }
    };

    float suma_temp = 0.0f;
    int conteo_temp = 0;

    for (int i = 0; i < 3; i++) {
        if (red[i].tipo == 'T') {
            suma_temp += red[i].valor;
            conteo_temp++;
        }
    }

    if (conteo_temp > 0) {
        printf("Promedio Temperatura: %.2f C\n", suma_temp / conteo_temp);
    }
    return 0;
}
```

---

## 7.4 Búsqueda de Extremos y Telemetría Anidada
Podemos iterar sobre un arreglo de estructuras para identificar condiciones críticas (como el sensor con la lectura máxima de pico):

```c
#include <stdio.h>

typedef struct {
    int id;
    float corriente_ma;
} CanalPotencia_t;

int main(void) {
    CanalPotencia_t canales[3] = {
        { 101, 145.2f },
        { 102, 389.7f },
        { 103, 210.0f }
    };

    int id_max = canales[0].id;
    float corriente_max = canales[0].corriente_ma;

    for (int i = 1; i < 3; i++) {
        if (canales[i].corriente_ma > corriente_max) {
            corriente_max = canales[i].corriente_ma;
            id_max = canales[i].id;
        }
    }

    printf("Canal Critico: %d con Consumo: %.1f mA\n", id_max, corriente_max);
    return 0;
}
```
