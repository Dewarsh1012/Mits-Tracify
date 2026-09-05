import * as THREE from "three";

/**
 * Colour has meaning in this world. Nothing here is decorative:
 * grey = unanalysed, blue = active trace, violet = intelligence context,
 * amber = attention, red = critical risk, green = verified attribution.
 */
export const PAL = {
  void: new THREE.Color("#0a0d14"),
  dim: new THREE.Color("#2b3345"),
  grey: new THREE.Color("#5a657d"),
  signal: new THREE.Color("#4da3ff"),
  accent: new THREE.Color("#6e8cff"),
  violet: new THREE.Color("#8b7cff"),
  amber: new THREE.Color("#ffb84d"),
  critical: new THREE.Color("#ff5c70"),
  verified: new THREE.Color("#4ce0a3"),
  light: new THREE.Color("#eaf2ff"),
};

export const BG = "#06070a";
