# MANUAL // UNIDAD 6: FUNCIONES Y ARQUITECTURA MODULAR

## 6.1 Drivers y Funciones Puras
Modularización del código para aislar cálculos matemáticos y controladores de hardware.

## 6.2 Paso de Búferes a Funciones (`const int arr[], int n`)
En C los arreglos pasan su dirección de inicio; se debe acompañar siempre del tamaño `int n` y calificar con `const` si son de sólo lectura.

## 6.3 Variables Estáticas (`static`)
Una variable `static` interna conserva su estado entre llamadas, permitiendo implementar acumuladores y odómetros sin recurrir a variables globales.
