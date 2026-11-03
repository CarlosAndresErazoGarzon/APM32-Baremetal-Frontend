# Tutorial 5: Real-Time Clock (RTC)

**Objective:** Use the Blue Pill's onboard 32.768kHz crystal to keep a seconds counter running on its own, in a peripheral specifically designed to survive resets (and even keep ticking on a coin-cell battery) -- and understand the **Backup Domain**, a part of the chip that lives in its own write-protected world.

**No extra hardware needed** -- the LSE (Low-Speed External) crystal used here is already soldered to the board.

---

## 1. Why the RTC Needs Its Own Unlock Sequence

Every other peripheral in this course turns on with one `RCM->APB2CLKEN` or `RCM->APB1CLKEN` bit. The RTC doesn't, because it (and a handful of other registers like `BDCTRL`) live in the **Backup Domain**: a small section of the chip kept alive by a coin-cell battery on `VBAT`, specifically so your clock survives a power loss or a firmware reset. Precisely *because* it's meant to survive almost anything, the chip write-protects it by default -- otherwise a stray pointer bug in your code could reset your clock. You have to explicitly ask for write access before touching it.

That's three separate things to enable, in order, before the RTC itself exists as far as your code is concerned:

1. **Clocks** for the `PMU` (Power Management Unit) and `BKP` (Backup) peripherals themselves -- same as any other peripheral, via `RCM->APB1CLKEN`.
2. **Write access to the Backup Domain** -- `PMU->CTRL_B.BPWEN = 1` (Backup Power Write ENable). Without this, writes to `RCM->BDCTRL` and the `RTC` registers are silently ignored.
3. **The LSE crystal itself**, started and confirmed stable before anything downstream of it (the RTC) can use it as a clock source.

---

## 2. Step 1: Starting the Crystal and the RTC

Insert this inside `/* USER CODE BEGIN Init */`:

```c
/* USER CODE BEGIN Init */

// 1. Clocks for the Backup interface and Power Management Unit
RCM->APB1CLKEN |= (1 << 27) | (1 << 28); // BKP, PMU

// 2. Unlock write access to the Backup Domain (RCM->BDCTRL, RTC->*)
PMU->CTRL_B.BPWEN = 1;

// 3. Start the 32.768kHz crystal (LSE) and wait for it to stabilize
RCM->BDCTRL_B.LSEEN = 1;
while (!RCM->BDCTRL_B.LSERDYFLG);

// 4. Feed the LSE into the RTC, then turn the RTC on
RCM->BDCTRL_B.RTCSRCSEL = 0x1; // 01 = LSE (0x2 = LSI, 0x3 = HSE/128 -- see note)
RCM->BDCTRL_B.RTCCLKEN  = 1;

// 5. After first enabling it, the RTC's own registers need a moment to
//    resync with the APB bus before you can trust reading them.
while (!RTC->CSTS_B.RSYNCFLG);

/* USER CODE END Init */
```

> [!NOTE]
> **Why LSE and not the internal LSI?** `RTCSRCSEL = 0x2` (LSI, an internal ~40kHz RC oscillator) would skip the crystal and work with zero external parts too -- but it's not trimmed at the factory, so it can drift several percent, which adds up to minutes of error per day. The 32.768kHz crystal is the standard choice specifically *because* 32768 = 2¹⁵, which makes a clean binary counter down to exactly 1Hz -- real wall-clock accuracy for pennies of extra hardware (hardware that's already on your board).

---

## 3. Step 2: Setting the Prescaler (Config Mode)

The RTC's internal counter is driven by whatever's on `RTCSRCSEL`, not necessarily 1Hz -- a **prescaler** divides it down. With the 32.768kHz LSE, dividing by `32768` gives exactly one tick per second. Writing the prescaler (and the counter itself) requires briefly entering **Configuration Mode**, and you must wait for the hardware to confirm each step finished before moving to the next:

```c
/* USER CODE BEGIN Init */

// (continuing from above)

// Wait for any previous RTC write to finish before starting a new one
while (!RTC->CSTS_B.OCFLG);

RTC->CSTS_B.CFGMFLG = 1;  // enter Configuration Mode

RTC->PSCRLDH = 0;         // prescaler reload = 32767 (32768 - 1)
RTC->PSCRLDL = 32767;     //   -> one RTC->CNTL tick every exact second
RTC->CNTH = 0;             // start the seconds counter at 0
RTC->CNTL = 0;

RTC->CSTS_B.CFGMFLG = 0;  // exit Configuration Mode -- hardware applies it
while (!RTC->CSTS_B.OCFLG); // wait for that to finish before reading CNT

/* USER CODE END Init */
```

| Flag (`RTC->CSTS`) | Meaning |
|---|---|
| `RSYNCFLG` | Registers Synchronized -- set once, after `RTCCLKEN`, when it's safe to start reading RTC registers at all. |
| `CFGMFLG` | Configuration Mode -- you set it to 1 before writing `PSCRLD*`/`CNT*`/`ALR*`, clear it to apply the write. |
| `OCFLG` | Operation Complete -- the previous write finished; wait for this before starting a new one, both before entering config mode and after leaving it. |

---

## 4. Step 3: Reading the Time

Once running, the RTC counts completely on its own -- no polling needed to keep it ticking, only to *read* it:

```c
uint8_t seconds = (uint8_t)(RTC->CNTL % 60);
```

`RTC->CNTL` is the low 16 bits of a 32-bit seconds-since-reset counter (`RTC->CNTH` holds the high 16 bits, for counting past ~18 hours) -- reading the 16-bit `CNTL` register alone is a single atomic bus read, so there's no risk of a torn/inconsistent value, even with the counter ticking in the background.

### Worked example: seconds on the 7-segment display

Reusing the exact multiplexed display wiring from Tutorial 2 (`PA0`-`PA7` segments, `PB8`/`PB9` PNP selectors), show the last two digits of the seconds counter, cycling 00-59:

```c
        /* USER CODE BEGIN While */
        uint8_t seconds = (uint8_t)(RTC->CNTL % 60);

        GPIOB->ODATA |= (1 << 8) | (1 << 9); // both OFF -- avoid ghosting
        GPIOA->ODATA = (GPIOA->ODATA & ~0xFF) | (~nums[seconds / 10] & 0xFF);
        GPIOB->ODATA &= ~(1 << 9); // Tens ON
        delay_ms(5);

        GPIOB->ODATA |= (1 << 8) | (1 << 9);
        GPIOA->ODATA = (GPIOA->ODATA & ~0xFF) | (~nums[seconds % 10] & 0xFF);
        GPIOB->ODATA &= ~(1 << 8); // Units ON
        delay_ms(5);
        /* USER CODE END While */
```

The full runnable version (non-blocking, matching the `msTicks`-driven refresh pattern from Tutorial 2) is available as the **"Real-Time Clock (Tutorial 5)"** example (`APM32: Load Example Project`).

> [!TIP]
> Because the RTC lives in the Backup Domain, it keeps counting through a **reset** (pressing the reset button, or `APM32: Flash Board` re-flashing your firmware) as long as power stays on `VBAT` -- unlike every variable in RAM, which resets to its initial value every time. If you want a true boot-to-boot persistent clock, don't reset `RTC->CNTL` to 0 on every `APM32_Init()` call -- only do that once, the very first time, and skip it on subsequent runs (e.g. by checking a known "already initialized" marker before re-running Step 2 and 3 above).
