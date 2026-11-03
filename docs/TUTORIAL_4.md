# Tutorial 4: Reading a Potentiometer (ADC)

**Objective:** Convert a continuous analog voltage into a number your code can use -- the Analog-to-Digital Converter (ADC) -- and understand its 12-bit resolution.

**Wiring:** A potentiometer is just a voltage divider. Its two **outer** legs go to `3V3` and `GND` (either way round -- it only flips which direction is "more"), and the **middle** leg (the wiper) outputs whatever voltage falls between them depending on the knob's position. Connect the wiper to `PA2`.

---

## 1. Which Pins Can You Use? (Not Just PA0)

The ADC isn't tied to one pin -- it has several **channels**, each hard-wired to one specific physical pin. You can't mix and match (e.g. "channel 3 on PA6") -- whichever pin you pick, its channel number is fixed:

| Pin | ADC Channel |
|---|---|
| `PA0` | 0 |
| `PA1` | 1 |
| `PA2` | 2 |
| `PA3` | 3 |
| `PA4` | 4 |
| `PA5` | 5 |
| `PA6` | 6 |
| `PA7` | 7 |
| `PB0` | 8 |
| `PB1` | 9 |

> [!NOTE]
> Channels 10-15 live on `PC0`-`PC5`, but the Blue Pill's 48-pin package doesn't expose those pins at all -- so in practice, these 10 are every ADC pin you actually have. Whichever one you pick, the two things that must match are the pin's **CFG mode** (`0x0`, Analog Input -- see `PIN_MODES.md`) and the **channel number** you load into `REGSEQ3` below.

This tutorial uses `PA2` / Channel 2, chosen simply because it's free in the default Taller 2 wiring (PA0/PA1 and PA4-PA7 are already claimed there).

---

## 2. Step 1: Configuring the ADC

Unlike `CFGLOW`/`CFGHIG`, the ADC isn't a single-register config -- it needs its clock enabled, the right prescaler (the ADC can't run as fast as the CPU), and a one-time **calibration** sequence the silicon itself performs to null out its own offset error.

Insert this inside `/* USER CODE BEGIN Init */`:

```c
/* USER CODE BEGIN Init */

// 1. Enable clocks: GPIOA (for PA2) and ADC1
RCM->APB2CLKEN |= (1 << 2) | (1 << 9);

// 2. ADC clock prescaler: 72MHz / 6 = 12MHz (max allowed is 14MHz)
RCM->CFG = (RCM->CFG & ~(0x3 << 14)) | (0x2 << 14);

// 3. PA2 as Analog Input -- CNF/MODE = 0x0 (see PIN_MODES.md)
GPIOA->CFGLOW &= ~(0xF << 8);

// 4. Power on the ADC and run its calibration sequence (required once)
ADC1->CTRL2 |= (1 << 0);          // ADCEN = 1 (wakes the ADC up)
ADC1->CTRL2 |= (1 << 3);          // CALRST = 1 (reset calibration registers)
while (ADC1->CTRL2 & (1 << 3));   // wait for the reset to finish
ADC1->CTRL2 |= (1 << 2);          // CAL = 1 (run calibration)
while (ADC1->CTRL2 & (1 << 2));   // wait for calibration to finish

// 5. Channel 2 (PA2) is the only (and therefore first) conversion
ADC1->REGSEQ3 = 2;

/* USER CODE END Init */
```

| Bit (`ADC1->CTRL2`) | Name | What it does |
|---|---|---|
| 0 | `ADCEN` | Turns the ADC peripheral on. Writing it a *second* time (after it's already on) is also how you trigger a conversion in some reference code -- this tutorial uses the explicit `SWSTART` bit below instead, which is clearer. |
| 2 | `CAL` | Starts calibration. Hardware clears this bit on its own once done -- that's what the `while` loop is waiting for. |
| 3 | `CALRST` | Resets the calibration registers before a new calibration run. Also self-clears. |
| 22 | `SWSTART` | Software-triggered start of a conversion (used in the loop below). |

---

## 3. Step 2: Reading in the Main Loop

A conversion isn't instant -- you start it, then poll the status register until the ADC reports it's done (`EOC`, End Of Conversion), then read the result:

```c
uint16_t ADC_Read(void) {
    ADC1->CTRL2 |= (1 << 22);          // SWSTART: begin a conversion
    while (!(ADC1->STS & (1 << 1)));   // wait for EOC (bit 1 of STS)
    return (uint16_t)ADC1->REGDATA;    // 12-bit result: 0-4095
}
```

`ADC1->REGDATA` is a **12-bit** value: `0` means the wiper is at `0V` (fully toward `GND`), `4095` means it's at the full `3.3V` (fully toward `3V3`). Anywhere in between is proportional -- e.g. a reading of `2048` means roughly `1.65V`, the midpoint.

### Worked example: a 6-LED bar graph

Reusing the 6 LEDs from Taller 2 (`PB12`-`PB15`, `PA8`, `PA9`), turn the knob and light more or fewer LEDs -- a classic "VU meter" pattern:

```c
        /* USER CODE BEGIN While */
        uint16_t raw = ADC_Read();

        // 4096 / 6 LEDs =~ 683 counts per LED
        uint8_t lit = raw / 683;
        if (lit > 6) lit = 6;

        for (uint8_t i = 0; i < 6; i++) {
            if (i < lit) leds[i].port->ODATA |= (1 << leds[i].pin);
            else leds[i].port->ODATA &= ~(1 << leds[i].pin);
        }

        delay_ms(20); // ~50 updates/second -- smooth without hammering the ADC
        /* USER CODE END While */
```

(`leds[]` is the same array-of-`{GPIO_T*, pin}` pattern from Taller 2's `binary_manipulator` -- see that example if you need the full declaration.)

The full runnable version of this is available as the **"Potentiometer / ADC Reading (Tutorial 4)"** example (`APM32: Load Example Project`).
