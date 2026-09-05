/**
 * Pointer + keyboard input for charge-jump and horizontal aim.
 */

/** @type {HTMLCanvasElement|null} */
let canvas = null;

let pointerDown = false;
let pointerX = 0;
/** Pointer lean contributes to moveX while active */
let pointerActive = false;

const keys = {
  charge: false,
  left: false,
  right: false,
};

let charging = false;
let chargeJustReleased = false;
let prevCharging = false;

/**
 * @param {HTMLCanvasElement} canvasEl
 */
export function init(canvasEl) {
  canvas = canvasEl;
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);
  canvas.addEventListener('lostpointercapture', onPointerUp);
  canvas.addEventListener('pointerleave', onPointerLeave);

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
}

export function reset() {
  pointerDown = false;
  pointerActive = false;
  keys.charge = false;
  keys.left = false;
  keys.right = false;
  charging = false;
  chargeJustReleased = false;
  prevCharging = false;
}

/**
 * Call once per fixed update before reading getState().
 * Clears one-frame edges (chargeJustReleased).
 */
export function update() {
  const wantCharge = pointerDown || keys.charge;
  chargeJustReleased = prevCharging && !wantCharge;
  charging = wantCharge;
  prevCharging = wantCharge;
}

/**
 * @returns {{ charging: boolean, chargeJustReleased: boolean, moveX: number }}
 */
export function getState() {
  return {
    charging,
    chargeJustReleased,
    moveX: computeMoveX(),
  };
}

function computeMoveX() {
  let x = 0;
  if (keys.left) x -= 1;
  if (keys.right) x += 1;

  if (x === 0 && pointerActive && canvas) {
    const rect = canvas.getBoundingClientRect();
    const localX = ((pointerX - rect.left) / Math.max(rect.width, 1)) * canvas.width;
    const half = canvas.width * 0.5;
    const lean = (localX - half) / half;
    x = clamp(lean, -1, 1);
  }

  return clamp(x, -1, 1);
}

/**
 * @param {PointerEvent} e
 */
function onPointerDown(e) {
  if (!canvas) return;
  pointerDown = true;
  pointerActive = true;
  pointerX = e.clientX;
  try {
    canvas.setPointerCapture(e.pointerId);
  } catch {
    /* ignore */
  }
  e.preventDefault();
}

/**
 * @param {PointerEvent} e
 */
function onPointerMove(e) {
  pointerX = e.clientX;
  // Track lean for air steering even without press
  pointerActive = true;
}

/**
 * @param {PointerEvent} e
 */
function onPointerUp(e) {
  pointerDown = false;
  // Keep last lean while pointer remains over canvas (air control)
  if (canvas) {
    try {
      canvas.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  }
}

function onPointerLeave() {
  if (!pointerDown) pointerActive = false;
}

/**
 * @param {KeyboardEvent} e
 */
function onKeyDown(e) {
  if (e.repeat) {
    applyKey(e.code, true);
    return;
  }
  applyKey(e.code, true);
  if (
    e.code === 'Space' ||
    e.code === 'ArrowDown' ||
    e.code === 'ArrowLeft' ||
    e.code === 'ArrowRight' ||
    e.code === 'KeyA' ||
    e.code === 'KeyD'
  ) {
    e.preventDefault();
  }
}

/**
 * @param {KeyboardEvent} e
 */
function onKeyUp(e) {
  applyKey(e.code, false);
}

/**
 * @param {string} code
 * @param {boolean} down
 */
function applyKey(code, down) {
  switch (code) {
    case 'Space':
    case 'ArrowDown':
      keys.charge = down;
      break;
    case 'KeyA':
    case 'ArrowLeft':
      keys.left = down;
      break;
    case 'KeyD':
    case 'ArrowRight':
      keys.right = down;
      break;
    default:
      break;
  }
}

function onBlur() {
  pointerDown = false;
  pointerActive = false;
  keys.charge = false;
  keys.left = false;
  keys.right = false;
  // Do not force chargeJustReleased across blur; update() will edge-detect next frame
  prevCharging = false;
  charging = false;
  chargeJustReleased = false;
}

/**
 * @param {number} v
 * @param {number} lo
 * @param {number} hi
 */
function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}
