/**
 * Canonical Finecoustic product catalog for the Products department.
 * Only SKUs listed on finecoustic.com (or legacy catalog items we still track).
 */

/** Removed from catalog — purged on next ensureProductCatalog run. */
export const RETIRED_PRODUCT_SKUS = ['FBB301', 'FBB302'];

/** Bump when catalog entries change — triggers one-time re-sync. */
export const PRODUCT_CATALOG_VERSION = 2;

export const FINEACOUSTIC_PRODUCT_CATALOG = [
  {
    sku: 'FBS1',
    name: 'Hako Nomad',
    price_display: '$48.80 USD',
    status: 'active',
    sort_order: 1,
    description:
      'Small but loud retro-aesthetic portable speaker. Ambient lighting, flexible connectivity (BT/AUX/TF/USB), built-in EQ, mic for calls, and TWS pairing for wider stereo.',
    image_url:
      'https://www.finecoustic.com/cdn/shop/files/TBT_FBS1_2.png?v=1782976297&width=800',
    specs: {
      store_url: 'https://www.finecoustic.com/products/hako-nomad-fbs1',
      factory_doc: 'FBS1-FactoryDocumentation.docx',
      md: `## Overview
Portable Bluetooth speaker — **Hako Nomad** (FBS1). Factory pairing name: Hako Nomad / Hako1 FBS1.

## Connectivity
- Bluetooth 5.3 (SBC, FLAC, APE, MP3, WAV)
- AUX 3.5 mm · TF card · USB flash drive (up to 32 GB each)
- TWS stereo pairing

## Audio
- **Speaker output (marketing):** 30 W
- **RMS power (factory):** 15 W + 8 W
- **Frequency response:** 80 Hz – 20 kHz
- **EQ modes:** Music · Outdoor · Game
- **SNR:** ≥ 80 dB

## Power & battery
- **Battery:** 18650, 7.4 V, 2600 mAh
- **Battery life:** up to ~12 hr · USB-C charge ~3 hr

## Physical
- **Size:** 106.5 × 112 × 68 mm · **Weight:** ~617 g · **IPX6**`,
    },
  },
  {
    sku: 'FBS2',
    name: 'Hako Nomad L',
    price_display: '$94.80 USD',
    status: 'active',
    sort_order: 2,
    description:
      'Larger retro-aesthetic portable speaker with 65 W output and a dedicated 2-tweeter + 1-woofer setup. Same connectivity and ambience features as Hako Nomad, scaled up for gatherings and home listening.',
    image_url:
      'https://www.finecoustic.com/cdn/shop/files/FBS2_TBT_front.png?v=1782976360&width=800',
    specs: {
      store_url: 'https://www.finecoustic.com/products/hako-nomad-l-fbs2',
      factory_doc: 'FBS2-FactoryDocumentation.docx',
      md: `## Overview
Hi-Fi portable Bluetooth speaker — **Hako Nomad L** (FBS2).

## Connectivity
- Bluetooth 5.3 · AUX · TF card · USB flash drive · TWS

## Audio
- **Speaker output (marketing):** 65 W
- **RMS power (factory):** 33 W + 13.5 W + 13.5 W = 60 W
- **Frequency response:** 60 Hz – 20 kHz
- **EQ modes:** Music · Outdoor · Game

## Power & battery
- **Battery:** 21700, 11.1 V, 4500 mAh
- **Battery life:** up to ~15 hr · USB-C charge ~6 hr

## Physical
- **Size:** 230 × 119.5 × 102.5 mm · **Weight:** ~2060 g · **IPX6**`,
    },
  },
  {
    sku: 'FT20',
    name: 'Groove ANC',
    price_display: '$18.80 USD',
    status: 'discontinued',
    sort_order: 3,
    description:
      'In-ear ANC earbuds with 13 mm drivers, ENC for calls, Bluetooth 5.3, and USB-C charging case.',
    image_url:
      'https://www.finecoustic.com/cdn/shop/files/ProductImage_GROOVE_ANC_FT20_1.png?v=1759730505&width=800',
    specs: {
      store_url: 'https://www.finecoustic.com/products/groove-anc-ft20',
      md: `## Overview
In-ear **Groove ANC** (FT20).

## Audio
- 13 mm driver · in-ear · 20 Hz – 20 kHz
- ANC · ENC · touch controls

## Connectivity
- Bluetooth 5.3 · range ~10 m

## Battery
- 35 mAh per earbud · 300 mAh case
- Up to ~4 hr playtime · USB-C ~1.5 hr charge
- **Weight:** ~30 ± 3 g`,
    },
  },
  {
    sku: 'FT21',
    name: 'Groove OWS',
    price_display: '$20.80 USD',
    status: 'discontinued',
    sort_order: 4,
    description:
      'Open-wearable earbuds with 16 mm driver, AI noise reduction for calls, Bluetooth 6.0, and up to 45 hr battery.',
    image_url:
      'https://www.finecoustic.com/cdn/shop/files/ProductImage_GROOVE_OWS_FT21_Black_2.png?v=1763969283&width=800',
    specs: {
      store_url: 'https://www.finecoustic.com/products/groove-ows-ft21',
      md: `## Overview
Open-ear **Groove OWS** (FT21) — Black · Beige.

## Audio
- 16 mm dynamic driver · open wearable · 20 Hz – 20 kHz

## Connectivity
- Bluetooth 6.0 · touch controls

## Battery
- 35 mAh per earbud · 260 mAh case
- Up to ~45 hr playtime · USB-C ~1.5 hr charge
- **Weight:** ~56 ± 2 g`,
    },
  },
  {
    sku: 'WFM1',
    name: 'Resono WFM1',
    price_display: '$60.80 USD',
    status: 'discontinued',
    sort_order: 5,
    description:
      'Cardioid condenser mic for streaming and recording. Shock mount, RGB lighting, monitor mix, pop filter, mute/ENC, USB-C and 2.4 GHz wireless.',
    image_url:
      'https://www.finecoustic.com/cdn/shop/files/ProductImage_RESONO_WFM1_4_be42d8cb-d6dc-470a-a213-a712dc809f65.png?v=1764005266&width=800',
    specs: {
      store_url: 'https://www.finecoustic.com/products/resono-wfm1',
      md: `## Overview
Streaming condenser mic — **Resono WFM1**.

## Capsule
- Cardioid · 14 mm · 20 Hz – 20 kHz
- 48 kHz / 24-bit · SNR 75 dB · max SPL 112 dB

## Features
- RGB (12 modes) · monitor mix · pop filter · mute · ENC · shock mount

## Connectivity
- USB-C · 3.5 mm TRS · 2.4 GHz wireless
- 800 mAh battery · up to ~40 hr`,
    },
  },
  {
    sku: 'UFM1',
    name: 'Sonara UFM1',
    price_display: '$64.80 USD',
    status: 'discontinued',
    sort_order: 6,
    description:
      'Multi-pattern portable condenser mic — cardioid, omni, and bidirectional. For mobile streaming, calls, and studio use.',
    image_url:
      'https://www.finecoustic.com/cdn/shop/files/ProductImage_SONARA_UFM1_4.png?v=1764003682&width=800',
    specs: {
      store_url: 'https://www.finecoustic.com/products/sonara-ufm1',
      md: `## Overview
Multi-pattern condenser mic — **Sonara UFM1**.

## Capsule
- Cardioid · omni · bidirectional · 14 mm
- 20 Hz – 20 kHz · 48 kHz / 24-bit

## Features
- RGB (12 modes) · monitor & gain controls · pop filter · shock mount · ENC · mute

## Connectivity
- USB-C · 3.5 mm TRS · 2.4 GHz wireless`,
    },
  },
];
