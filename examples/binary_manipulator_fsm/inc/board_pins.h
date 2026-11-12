#ifndef BOARD_PINS_H
#define BOARD_PINS_H

#include "apm32f10x.h"

// Mapa de pines del montaje 

typedef struct {
    GPIO_T  *port;
    uint8_t pin;
} PinDef;

typedef enum {
    ROLE_BTN0, ROLE_BTN1, ROLE_BTN2, ROLE_BTN3,
    ROLE_LED0, ROLE_LED1, ROLE_LED2, ROLE_LED3, ROLE_LED4, ROLE_LED5,
    ROLE_SEG_A, ROLE_SEG_B, ROLE_SEG_C, ROLE_SEG_D, ROLE_SEG_E, ROLE_SEG_F, ROLE_SEG_G, ROLE_SEG_DP,
    ROLE_DIGIT1, ROLE_DIGIT2,
    ROLE_COUNT
} PinRole;

static const PinDef PINES[ROLE_COUNT] = {
    [ROLE_BTN0]   = {GPIOA, 15}, // Izquierda
    [ROLE_BTN1]   = {GPIOA, 12}, // Derecha
    [ROLE_BTN2]   = {GPIOB, 3},  // Toggle
    [ROLE_BTN3]   = {GPIOB, 4},  // Borrar

    [ROLE_LED0]   = {GPIOB, 12},
    [ROLE_LED1]   = {GPIOB, 13},
    [ROLE_LED2]   = {GPIOB, 14},
    [ROLE_LED3]   = {GPIOB, 15},
    [ROLE_LED4]   = {GPIOA, 8},
    [ROLE_LED5]   = {GPIOA, 11},

    [ROLE_SEG_A]  = {GPIOB, 11},
    [ROLE_SEG_B]  = {GPIOB, 10},
    [ROLE_SEG_C]  = {GPIOB, 0},
    [ROLE_SEG_D]  = {GPIOA, 5},
    [ROLE_SEG_E]  = {GPIOA, 6},
    [ROLE_SEG_F]  = {GPIOB, 1},
    [ROLE_SEG_G]  = {GPIOA, 4},
    [ROLE_SEG_DP] = {GPIOA, 7},

    [ROLE_DIGIT1] = {GPIOA, 1}, // unidades
    [ROLE_DIGIT2] = {GPIOA, 0}, // decenas
};

#define MODE_OUTPUT_PP  0x2U // Output Push-Pull, 2MHz
#define MODE_INPUT_PU   0x8U // Input Pull-up/Pull-down

// Escribe el nibble CNF+MODE de 4 bits ('mode_cnf') en CFGLOW (pines 0-7)
// o CFGHIG (pines 8-15) según corresponda, sin tocar el resto del puerto.
static inline void gpio_config_pin(GPIO_T *port, uint8_t pin, uint8_t mode_cnf) {
    volatile uint32_t *cfg = (pin < 8) ? &port->CFGLOW : &port->CFGHIG;
    uint8_t shift = (uint8_t)((pin % 8) * 4);
    *cfg = (*cfg & ~(0xFU << shift)) | ((uint32_t)(mode_cnf & 0xF) << shift);
}

// Como gpio_config_pin(), pero buscando el pin directamente en PINES[].
static inline void gpio_config_role(PinRole r, uint8_t mode_cnf) {
    gpio_config_pin(PINES[r].port, PINES[r].pin, mode_cnf);
}

static inline void pin_set(PinRole r)   { PINES[r].port->BSC = (1U << PINES[r].pin); }
static inline void pin_clear(PinRole r) { PINES[r].port->BC  = (1U << PINES[r].pin); }

#endif
