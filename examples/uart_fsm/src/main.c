#include "apm32f10x.h"
#include "apm32_config.h"
#include "delay.h"
#include "uart.h"
#include <stdio.h>

/* USER CODE BEGIN Includes */
typedef enum { ST_A, ST_B, ST__N } State;
typedef enum { EV_NONE, EV_SIG, EV__N } Event;
typedef void (*Action)(const char* name);

typedef struct {
    State next;
    Action act;
} Cell;

typedef struct {
    const char* name;
    State current_state;
    const Cell (*table)[EV__N]; // Pointer to this instance's transition table
} FSM;

static void action_handler(const char* name) {
    printf("\r\n[FSM %s] Running transition action\r\n", name);
}

// Three independent FSM instances share this exact same 2-state table --
// what differs between them is only which key ('l'/'m'/'u') dispatches to
// which instance below, in main()'s UART_Available() block.
static const Cell table_led[ST__N][EV__N] = {
    [ST_A] = { [EV_NONE] = {ST_A, NULL}, [EV_SIG] = {ST_B, action_handler} },
    [ST_B] = { [EV_NONE] = {ST_B, NULL}, [EV_SIG] = {ST_A, action_handler} }
};

static const Cell table_motor[ST__N][EV__N] = {
    [ST_A] = { [EV_NONE] = {ST_A, NULL}, [EV_SIG] = {ST_B, action_handler} },
    [ST_B] = { [EV_NONE] = {ST_B, NULL}, [EV_SIG] = {ST_A, action_handler} }
};

static const Cell table_uart[ST__N][EV__N] = {
    [ST_A] = { [EV_NONE] = {ST_A, NULL}, [EV_SIG] = {ST_B, action_handler} },
    [ST_B] = { [EV_NONE] = {ST_B, NULL}, [EV_SIG] = {ST_A, action_handler} }
};

void fsm_dispatch(FSM* fsm, Event ev) {
    if (ev >= EV__N || fsm->current_state >= ST__N) return;

    const Cell *c = &fsm->table[fsm->current_state][ev];

    fsm->current_state = c->next;
    if (c->act) {
        c->act(fsm->name);
    }
}
/* USER CODE END Includes */

int main(void) {
    // Configures clocks and selected components
    APM32_Init();

    printf("\r\n==================================\r\n");
    printf("   APM32 MODULAR SYSTEM OK        \r\n");
    printf("==================================\r\n");
    printf("Type something and press SEND...\r\n");

    /* USER CODE BEGIN Init */
    FSM fsm_led   = { .name = "LED",   .current_state = ST_A, .table = table_led };
    FSM fsm_motor = { .name = "MOTOR", .current_state = ST_A, .table = table_motor };
    FSM fsm_uart  = { .name = "UART",  .current_state = ST_A, .table = table_uart };

    printf("Multi FSM. 'l' for LED, 'm' for MOTOR, 'u' for UART\r\n");
    uint32_t last_blink = 0;
    /* USER CODE END Init */

    while(1) {
        /* USER CODE BEGIN While */

        // --- Echo (instant) ---
        if (UART_Available()) {
            uint8_t c = UART_Rx();
            UART_Tx(c);
            if (c == '\r') UART_Tx('\n');

            // --- FSM event dispatch ---
            if (c == 'l') {
                fsm_dispatch(&fsm_led, EV_SIG);
                printf("\r\nLED FSM state: %c\r\n", (fsm_led.current_state == ST_A ? 'A' : 'B'));
            }
            else if (c == 'm') {
                fsm_dispatch(&fsm_motor, EV_SIG);
                printf("\r\nMOTOR FSM state: %c\r\n", (fsm_motor.current_state == ST_A ? 'A' : 'B'));
            }
            else if (c == 'u') {
                fsm_dispatch(&fsm_uart, EV_SIG);
                printf("\r\nUART FSM state: %c\r\n", (fsm_uart.current_state == ST_A ? 'A' : 'B'));
            }
        }

        // --- Non-blocking heartbeat, every 2s ---
        if ((msTicks - last_blink) >= 2000) {
            last_blink = msTicks;
            GPIOB->ODATA ^= (1 << 2);
            printf("\r\n[STATUS] System alive | Uptime: %lu ms\r\n", msTicks);
        }

        /* USER CODE END While */
    }
}
