#include "apm32f10x.h"
#include "apm32_config.h"
#include "delay.h"

/* USER CODE BEGIN Includes */
/* USER CODE END Includes */

// Tutorial 3: Driving a 2-Channel Opto-Isolated Relay Module.
//
//   Relay 1 signal (IN1) -> PB11
//   Relay 2 signal (IN2) -> PB10
//   Module VCC           -> 5V   (the coil needs 5V, NOT 3V3)
//
// This assumes the module is in its default "Low Level Trigger" position:
// a LOW (0) on the signal pin energizes the coil, a HIGH (1) releases it
// -- the opposite of a plain LED. If your module's jumper is set to
// "High", swap every |= <-> &= ~ pair below.
//
// SAFETY: if you wire the NO/COM/NC screw terminals to mains AC to switch
// a real appliance, that side is lethal -- never touch it while plugged
// in. For classroom testing just listen for the click and watch the
// relay's own onboard LED; no external load needed.

int main(void) {
    // Configures clocks and selected components (also sets up the PB2
    // heartbeat LED -- see apm32_config.c).
    APM32_Init();

    /* USER CODE BEGIN Init */

    // Configure PB10 and PB11 as 50MHz Push-Pull outputs (0x3 per nibble).
    // Both live in CFGHIG: PB10 at bits 8-11, PB11 at bits 12-15.
    GPIOB->CFGHIG &= ~((0xF << 8) | (0xF << 12));
    GPIOB->CFGHIG |=  ((0x3 << 8) | (0x3 << 12));

    // Start with BOTH relays de-energized. Low Level Trigger: a 1 keeps
    // the coil OFF, so both pins must be HIGH before the loop starts.
    GPIOB->ODATA |= (1 << 10) | (1 << 11);

    /* USER CODE END Init */

    while(1) {

        /* USER CODE BEGIN While */

        // --- RELAY 1 (PB11) ---
        GPIOB->ODATA &= ~(1 << 11); // LOW = energize (turn ON)
        delay_ms(1000);
        GPIOB->ODATA |=  (1 << 11); // HIGH = de-energize (turn OFF)
        delay_ms(1000);

        // --- RELAY 2 (PB10) ---
        GPIOB->ODATA &= ~(1 << 10);
        delay_ms(1000);
        GPIOB->ODATA |=  (1 << 10);
        delay_ms(1000);

        // Heartbeat LED PB2
        GPIOB->ODATA ^= (1 << 2);

        /* USER CODE END While */
    }

    return 0;
}
