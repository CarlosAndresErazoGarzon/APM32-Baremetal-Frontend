#include "apm32f10x.h"
#include "apm32_config.h"
#include "delay.h"

/* USER CODE BEGIN Includes */
/* USER CODE END Includes */

// Tutorial 1: Inputs, Outputs, and Combinational Logic.
//
//   Button 1 -> PB10   Button 2 -> PB11
//   LED 1-2  -> PB12, PB13 (Button 1 only)
//   LED 3-4  -> PB14, PB15 (Button 2 only)
//
// Truth table: neither pressed -> all OFF. Either pressed -> its own pair
// ON. Both pressed -> all 4 ON. No debounce/edge-detection here on purpose
// -- this is about reading a level and applying combinational logic, not
// about catching a transition (that's a later tutorial).

int main(void) {
    // Configures clocks and selected components
    APM32_Init();

    /* USER CODE BEGIN Init */
    /* USER CODE END Init */

    while(1) {
        /* USER CODE BEGIN While */

        int button1_pressed = !(GPIOB->IDATA & (1 << 10));
        int button2_pressed = !(GPIOB->IDATA & (1 << 11));

        GPIOB->ODATA &= ~((1 << 12) | (1 << 13) | (1 << 14) | (1 << 15));

        if (button1_pressed && button2_pressed) {
            GPIOB->ODATA |= (1 << 12) | (1 << 13) | (1 << 14) | (1 << 15);
        }
        else if (button1_pressed) {
            GPIOB->ODATA |= (1 << 12) | (1 << 13);
        }
        else if (button2_pressed) {
            GPIOB->ODATA |= (1 << 14) | (1 << 15);
        }

        /* USER CODE END While */
    }

    return 0;
}
