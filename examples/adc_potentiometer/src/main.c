#include "apm32f10x.h"
#include "apm32_config.h"
#include "delay.h"

/* USER CODE BEGIN Includes */
/* USER CODE END Includes */

// Tutorial 4: Reading a Potentiometer (ADC).
//
//   Potentiometer outer legs -> 3V3, GND (either way round)
//   Potentiometer wiper      -> PA2 (ADC1 Channel 2)
//
// Turns the 12-bit reading (0-4095) into a 6-LED bar graph on the same
// PB12-PB15/PA8/PA9 LEDs used in Taller 2 -- more of the pot, more LEDs lit.

#define NUM_LEDS 6

typedef struct { GPIO_T *port; uint8_t pin; } led_t;

const led_t leds[NUM_LEDS] = {
    {GPIOB, 12}, {GPIOB, 13}, {GPIOB, 14}, {GPIOB, 15}, {GPIOA, 8}, {GPIOA, 9}
};

uint16_t ADC_Read(void) {
    ADC1->CTRL2 |= (1 << 22);              // SWSTART
    while (!(ADC1->STS & (1 << 1)));       // Wait for EOC (End Of Conversion)
    return (uint16_t)ADC1->REGDATA;        // 12-bit result, 0-4095
}

void show_bar(uint16_t raw) {
    // 4096 / 6 LEDs =~ 683 counts per LED.
    uint8_t lit = raw / 683;
    if (lit > NUM_LEDS) lit = NUM_LEDS;

    for (uint8_t i = 0; i < NUM_LEDS; i++) {
        if (i < lit) leds[i].port->ODATA |= (1 << leds[i].pin);
        else leds[i].port->ODATA &= ~(1 << leds[i].pin);
    }
}

int main(void) {
    // Configures clocks and selected components
    APM32_Init();

    /* USER CODE BEGIN Init */
    /* USER CODE END Init */

    while(1) {
        /* USER CODE BEGIN While */
        uint16_t raw = ADC_Read();
        show_bar(raw);
        delay_ms(20); // ~50 updates/second -- smooth without hammering the ADC
        /* USER CODE END While */
    }

    return 0;
}
