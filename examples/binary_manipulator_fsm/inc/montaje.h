#ifndef MONTAJE_H
#define MONTAJE_H

#include "board_pins.h"
#include <stdint.h>

#define NUM_LEDS 6

typedef struct {
    PinRole  role;
    uint8_t  estado;
    uint32_t t_cambio;
} boton_t;

// botones[0]=Izquierda, [1]=Derecha, [2]=Toggle LED en el cursor, [3]=Borrar
extern boton_t botones[4];

uint8_t fue_presionado(boton_t *b);
void actualizar_leds(uint8_t valor);
void escribir_segmentos(uint8_t patron);
void mostrar_numero(uint8_t n); // llamar en cada iteración del loop para refrescar el display

#endif
