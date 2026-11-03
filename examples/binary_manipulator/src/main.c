#include "apm32f10x.h"
#include "apm32_config.h"
#include "delay.h"

/* USER CODE BEGIN Includes */
/* USER CODE END Includes */

#define NUM_LEDS     6
#define DEBOUNCE_MS  15
#define REFRESH_MS   5

typedef struct {
    GPIO_T  *port;
    uint8_t pin;
} led_t;

typedef struct {
    GPIO_T   *port;
    uint8_t  pin;
    uint8_t  level;      // last accepted level (pull-up: 1 = released)
    uint32_t last_change;
} button_t;

const led_t leds[NUM_LEDS] = {
    {GPIOB, 12}, {GPIOB, 13}, {GPIOB, 14}, {GPIOB, 15}, {GPIOA, 8}, {GPIOA, 9}
};

button_t buttons[4] = {
    {GPIOA, 10, 1, 0}, // Left
    {GPIOA, 11, 1, 0}, // Right
    {GPIOA, 12, 1, 0}, // Toggle
    {GPIOA, 15, 1, 0}, // Clear
};

const uint8_t nums[10] = {
    0x3F, 0x06, 0x5B, 0x4F, 0x66, 0x6D, 0x7D, 0x07, 0x7F, 0x6F
};

// Returns 1 exactly once per press (debounced falling edge), 0 otherwise.
uint8_t was_pressed(button_t *b) {
    uint8_t current = (b->port->IDATA & (1 << b->pin)) ? 1 : 0;

    if (current != b->level && (msTicks - b->last_change) >= DEBOUNCE_MS) {
        b->last_change = msTicks;
        uint8_t falling_edge = (b->level == 1 && current == 0);
        b->level = current;
        return falling_edge;
    }
    return 0;
}

void update_leds(uint8_t value) {
    for (uint8_t i = 0; i < NUM_LEDS; i++) {
        if (value & (1 << i)) leds[i].port->ODATA |= (1 << leds[i].pin);
        else leds[i].port->ODATA &= ~(1 << leds[i].pin);
    }
}

void show_number(uint8_t n) {
    static uint32_t last_refresh = 0;
    static uint8_t  showing_tens = 0;

    if ((msTicks - last_refresh) < REFRESH_MS) return;
    last_refresh = msTicks;

    GPIOB->ODATA |= (1 << 8) | (1 << 9); // both OFF first -- avoid ghosting

    if (showing_tens) {
        uint8_t tens = (n / 10) % 10;
        GPIOA->ODATA = (GPIOA->ODATA & ~0xFF) | (~nums[tens] & 0xFF);
        GPIOB->ODATA &= ~(1 << 9); // Tens ON
    } else {
        uint8_t units = n % 10;
        GPIOA->ODATA = (GPIOA->ODATA & ~0xFF) | (~nums[units] & 0xFF);
        GPIOB->ODATA &= ~(1 << 8); // Units ON
    }

    showing_tens = !showing_tens;
}

int main(void) {
    // Configures clocks and selected components
    APM32_Init();

    /* USER CODE BEGIN Init */
    uint8_t value  = 0; // 6-bit number, bit i -> leds[i]
    uint8_t cursor = 0; // which LED (0-5) Toggle affects next
    /* USER CODE END Init */

    while(1) {
        /* USER CODE BEGIN While */
        if (was_pressed(&buttons[0]) && cursor > 0) cursor--;
        if (was_pressed(&buttons[1]) && cursor < NUM_LEDS - 1) cursor++;
        if (was_pressed(&buttons[2])) value ^= (1 << cursor);
        if (was_pressed(&buttons[3])) value = 0;

        update_leds(value);
        show_number(value);

        /* USER CODE END While */
    }

    return 0;
}
