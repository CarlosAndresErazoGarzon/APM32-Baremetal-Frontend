#include "montaje.h"
#include "delay.h"

#define DEBOUNCE_MS  15
#define REFRESCO_MS  5

boton_t botones[4] = {
    {ROLE_BTN0, 1, 0},
    {ROLE_BTN1, 1, 0},
    {ROLE_BTN2, 1, 0},
    {ROLE_BTN3, 1, 0},
};

// Patrones en lógica positiva; escribir_segmentos() invierte cada bit
// porque el display es ánodo común.
static const uint8_t nums[10] = {
    0x3F, 0x06, 0x5B, 0x4F, 0x66, 0x6D, 0x7D, 0x07, 0x7F, 0x6F
};

// Lee IDATA del botón y aplica debounce por tiempo: solo acepta un nuevo
// nivel si se mantuvo estable >= DEBOUNCE_MS desde el último cambio aceptado.
// Devuelve 1 una sola vez por flanco de bajada (1->0, pull-up) ya validado,
// 0 en cualquier otro caso (nivel sin cambiar, rebote, o flanco de subida).
uint8_t fue_presionado(boton_t *b) {
    uint8_t actual = (PINES[b->role].port->IDATA & (1U << PINES[b->role].pin)) ? 1U : 0U;

    if (actual == b->estado) {
        b->t_cambio = msTicks;
        return 0;
    }

    if ((msTicks - b->t_cambio) >= DEBOUNCE_MS) {
        b->t_cambio = msTicks;
        uint8_t flanco_bajada = (b->estado == 1U && actual == 0U);
        b->estado = actual;
        return flanco_bajada;
    }
    return 0;
}

// Prende/apaga leds[i] según el bit i de 'valor' usando pin_set/pin_clear
// sobre ROLE_LED0+i -- no hay copia propia de puerto/pin, todo viene de PINES[].
void actualizar_leds(uint8_t valor) {
    for (uint8_t i = 0; i < NUM_LEDS; i++) {
        if (valor & (1U << i)) pin_set(ROLE_LED0 + i);
        else pin_clear(ROLE_LED0 + i);
    }
}

// Aplica 'patron' (bit i = segmento i en lógica positiva, 1=encendido) a
// ROLE_SEG_A+i.. Como el display es ánodo común invierte cada bit: pin_clear
// (bajo) prende el segmento, pin_set (alto) lo apaga.
void escribir_segmentos(uint8_t patron) {
    for (uint8_t i = 0; i < 8; i++) {
        if (patron & (1U << i)) pin_clear(ROLE_SEG_A + i);
        else pin_set(ROLE_SEG_A + i);
    }
}

// Multiplexa el display de 2 dígitos: cada REFRESCO_MS apaga ambos
// selectores, escribe el patrón del dígito que le toca (unidades o decenas
// de 'n', alternando con mostrando_decenas) y enciende solo ese selector
// (PNP, activo en bajo). Debe llamarse en cada vuelta del loop principal
// -- si no se llama seguido, el ojo deja de ver ambos dígitos a la vez.
void mostrar_numero(uint8_t n) {
    static uint32_t ultimo_refresco = 0;
    static uint8_t  mostrando_decenas = 0;

    if ((msTicks - ultimo_refresco) < REFRESCO_MS) return;
    ultimo_refresco = msTicks;

    pin_set(ROLE_DIGIT1);
    pin_set(ROLE_DIGIT2);

    if (mostrando_decenas) {
        uint8_t decenas = (n / 10) % 10;
        escribir_segmentos(nums[decenas]);
        pin_clear(ROLE_DIGIT2);
    } else {
        uint8_t unidades = n % 10;
        escribir_segmentos(nums[unidades]);
        pin_clear(ROLE_DIGIT1);
    }

    mostrando_decenas = !mostrando_decenas;
}
