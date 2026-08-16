
#include "apm32_config.h"
#include "delay.h"
#include "uart.h"
#include <stdio.h>

/* USER CODE BEGIN Includes */
/* --- Definiciones Generales --- */
typedef enum { ST_A, ST_B, ST__N } State;
typedef enum { EV_NONE, EV_SIG, EV__N } Event;
typedef void (*Action)(const char* name);

typedef struct {
    State next;
    Action act;
} Cell;

/* --- Estructura de Instancia de FSM --- */
typedef struct {
    const char* name;
    State current_state;
    const Cell (*table)[EV__N]; // Puntero a la tabla de transicion
} FSM;

/* --- Acciones Generales --- */
static void action_handler(const char* name) {
    printf("\r\n[FSM %s] Ejecutando accion de transicion\r\n", name);
}

/* --- Tablas de Transicion --- */
static const Cell table1[ST__N][EV__N] = {
    [ST_A] = { [EV_NONE] = {ST_A, NULL}, [EV_SIG] = {ST_B, action_handler} },
    [ST_B] = { [EV_NONE] = {ST_B, NULL}, [EV_SIG] = {ST_A, action_handler} }
};

static const Cell table2[ST__N][EV__N] = {
    [ST_A] = { [EV_NONE] = {ST_A, NULL}, [EV_SIG] = {ST_B, action_handler} },
    [ST_B] = { [EV_NONE] = {ST_B, NULL}, [EV_SIG] = {ST_A, action_handler} }
};

static const Cell table_uart[ST__N][EV__N] = {
    [ST_A] = { [EV_NONE] = {ST_A, NULL}, [EV_SIG] = {ST_B, action_handler} },
    [ST_B] = { [EV_NONE] = {ST_B, NULL}, [EV_SIG] = {ST_A, action_handler} }
};

/* --- Motor de Despacho --- */
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
    printf("   SISTEMA MODULAR APM32 OK       \r\n");
    printf("==================================\r\n");
    printf("Escribe algo y presiona SEND...\r\n");

    /* USER CODE BEGIN Init */
    FSM fsm_led = { .name = "LED", .current_state = ST_A, .table = table1 };
    FSM fsm_motor = { .name = "MOTOR", .current_state = ST_A, .table = table2 };
    FSM fsm_uart = { .name = "UART", .current_state = ST_A, .table = table_uart };

    printf("Multi FSM. 'l' para LED, 'm' para MOTOR, 'u' para UART\r\n");
    /* USER CODE END Init */

    while(1) {
        /* Lógica de ECO (Instantánea) */
        if (UART_Available()) {
            uint8_t c = UART_Rx();
            
            // Re-enviamos el caracter recibido (Eco)
            UART_Tx(c);
            
            // Si es un retorno de carro, bajamos de línea
            if (c == '\r') UART_Tx('\n');
            
            // Despacho de eventos FSM
            if (c == 'l') {
                fsm_dispatch(&fsm_led, EV_SIG);
                printf("\r\nFSM LED estado: %c\r\n", (fsm_led.current_state == ST_A ? 'A' : 'B'));
            }
            else if (c == 'm') {
                fsm_dispatch(&fsm_motor, EV_SIG);
                printf("\r\nFSM MOTOR estado: %c\r\n", (fsm_motor.current_state == ST_A ? 'A' : 'B'));
            }
            else if (c == 'u') {
                fsm_dispatch(&fsm_uart, EV_SIG);
                printf("\r\nFSM UART estado: %c\r\n", (fsm_uart.current_state == ST_A ? 'A' : 'B'));
            }
        }

        /* Lógica de Blink (No bloqueante) */
        // Comparación de tiempo con msTicks
        extern volatile uint32_t msTicks;
        static uint32_t last_blink = 0;
        
        if ((msTicks - last_blink) >= 2000) { // Cada 2 segundos
            last_blink = msTicks;
            GPIOB->ODATA ^= (1 << 2); // Toggle LED PB2
            printf("\r\n[STATUS] Sistema Activo | Tiempo: %lu ms\r\n", msTicks);
        }

        /* USER CODE BEGIN While */
        /* USER CODE END While */
        
    }
}
