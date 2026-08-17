# MANUAL // UNIDAD 8: SISTEMAS DE REGISTRO PERSISTENTE (FILE I/O)

---

## 8.1 Puntero de Archivo (`FILE *`) y Modos de Acceso
En C estándar y sistemas embebidos con almacenamiento persistente (tarjetas SD, Flash SPI o emuladores de hardware), los archivos se manejan a través de un descriptor de tipo `FILE *` provisto por `<stdio.h>`.

| Modo | Nombre | Comportamiento |
| :--- | :--- | :--- |
| `"w"` | Write | Crea un archivo nuevo o **sobreescribe/limpia** el contenido existente. |
| `"a"` | Append | Abre el archivo y posiciona el cursor al final para **añadir** registros sin borrar lo previo. |
| `"r"` | Read | Abre un archivo existente únicamente para **lectura**. Si no existe, retorna `NULL`. |

> **Regla de Oro en Embebidos**: Siempre se debe validar si el puntero retornado es `NULL` antes de intentar leer o escribir, y siempre se debe invocar `fclose()` para asegurar la descarga del búfer a memoria física.

---

## 8.2 Inicialización y Creación de Archivos (`"w"`)
Ejemplo para inicializar un archivo de caja negra (*blackbox log*) escribiendo una cabecera de calibración:

```c
#include <stdio.h>

int main(void) {
    FILE *archivo = fopen("blackbox.log", "w");
    
    // Verificación de apertura segura
    if (archivo == NULL) {
        printf("ERROR: No se pudo crear el archivo de registro.\n");
        return 1;
    }

    // Escritura de cabecera formateada
    fprintf(archivo, "=== SISTEMA APM32 TELEMETRY LOG ===\n");
    fprintf(archivo, "VERSION: 1.0.0 | STATUS: OK\n");

    // Cierre y vaciado de buffers
    fclose(archivo);
    printf("Caja negra inicializada correctamente.\n");
    return 0;
}
```

---

## 8.3 Registro Continuo en Modo Append (`"a"`)
Para guardar eventos de telemetría continuos o alarmas sin borrar los registros anteriores, se utiliza el modo `"a"`:

```c
#include <stdio.h>

void registrar_evento(const char *tipo, float valor) {
    FILE *f = fopen("telemetria.log", "a");
    if (f == NULL) return;

    fprintf(f, "[EVENT] TIPO: %s | VALOR: %.2f\n", tipo, valor);
    fclose(f);
}

int main(void) {
    registrar_evento("TEMP", 26.8f);
    registrar_evento("VOLT", 3.29f);
    registrar_evento("TEMP", 27.1f);
    return 0;
}
```

---

## 8.4 Lectura de Archivos de Configuración (`"r"` y `fgets`)
Para cargar parámetros de red o límites de alarma desde un archivo de configuración en texto plano:

```c
#include <stdio.h>

int main(void) {
    FILE *f = fopen("config.txt", "r");
    if (f == NULL) {
        printf("Configuracion por defecto cargada (archivo no encontrado).\n");
        return 0;
    }

    char linea[64];
    while (fgets(linea, sizeof(linea), f) != NULL) {
        printf("Parametro leido: %s", linea);
    }

    fclose(f);
    return 0;
}
```

---

## 8.5 Procesamiento y Estadística de Datos con `fscanf`
Para procesar una serie de muestras numéricas almacenadas y calcular métricas en memoria:

```c
#include <stdio.h>

int main(void) {
    FILE *f = fopen("muestras.dat", "r");
    if (f == NULL) return 1;

    float valor = 0.0f;
    float suma = 0.0f;
    int conteo = 0;

    // fscanf retorna la cantidad de conversiones exitosas (1 si leyo el numero)
    while (fscanf(f, "%f", &valor) == 1) {
        suma += valor;
        conteo++;
    }

    fclose(f);

    if (conteo > 0) {
        printf("Muestras: %d | Promedio: %.2f\n", conteo, suma / conteo);
    }
    return 0;
}
```
