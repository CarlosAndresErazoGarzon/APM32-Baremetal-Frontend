# APM32 Baremetal VSCode Extension

Development tools for the Introduction to Embedded Systems course using the APM32 microcontroller.

## Features

- **Project Initialization**: Creates a fully configured APM32 baremetal project.
- **Component UI**: Add and configure components (UART, ADC, TMR) interactively using a visual component registry. 
- **Build**: Compiles the project using `make all`.
- **Flash**: Flashes the board using `make flash`.
- **Dependency Management**: Automatically downloads and installs the required Toolchain, OpenOCD, and utilities if missing.

## Requirements

- [GNU Arm Embedded Toolchain](https://developer.arm.com/downloads/-/gnu-rm) (Automatically installed if missing)
- [OpenOCD](https://openocd.org/) (Automatically installed if missing)
- On Windows: You need [Zadig](https://zadig.akeo.ie/) to install the WinUSB driver for the "APM32 CMSIS-DAP" debug probe.

## Usage

Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac) to open the Command Palette and search for commands starting with **APM32**. Alternatively, use the convenient buttons located on the bottom status bar.
