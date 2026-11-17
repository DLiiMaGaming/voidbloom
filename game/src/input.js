// VOIDBLOOM — keyboard and mouse state.
// One Input object owns every listener. The simulation only reads it, so the
// same world code runs live (real devices) and in screenshot scenes (a
// scripted stand-in with the same shape).

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.mouseX = 0;
    this.mouseY = 0;
    this.mouseDown = false;
    this.clicked = false; // pressed since the last frame was read
    this.pressedKeys = new Set(); // keys that went down since last frame

    window.addEventListener('keydown', (event) => {
      if (!event.repeat) {
        this.keys.add(event.code);
        this.pressedKeys.add(event.code);
      }
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
        event.preventDefault();
      }
    });
    window.addEventListener('keyup', (event) => {
      this.keys.delete(event.code);
    });
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.mouseDown = false;
    });
    canvas.addEventListener('mousemove', (event) => {
      const rect = canvas.getBoundingClientRect();
      this.mouseX = ((event.clientX - rect.left) / rect.width) * canvas.width;
      this.mouseY = ((event.clientY - rect.top) / rect.height) * canvas.height;
    });
    canvas.addEventListener('mousedown', (event) => {
      if (event.button === 0) {
        this.mouseDown = true;
        this.clicked = true;
      }
    });
    window.addEventListener('mouseup', (event) => {
      if (event.button === 0) this.mouseDown = false;
    });
    canvas.addEventListener('contextmenu', (event) => event.preventDefault());
  }

  // Movement axis from WASD or the arrow keys, each component in [-1, 1].
  moveAxis() {
    const x = (this.keys.has('KeyD') || this.keys.has('ArrowRight') ? 1 : 0)
      - (this.keys.has('KeyA') || this.keys.has('ArrowLeft') ? 1 : 0);
    const y = (this.keys.has('KeyS') || this.keys.has('ArrowDown') ? 1 : 0)
      - (this.keys.has('KeyW') || this.keys.has('ArrowUp') ? 1 : 0);
    return { x, y };
  }

  firing() {
    return this.mouseDown || this.keys.has('Space');
  }

  dashPressed() {
    return this.pressedKeys.has('ShiftLeft') || this.pressedKeys.has('ShiftRight');
  }

  // Called once at the end of every frame: one-frame signals reset.
  endFrame() {
    this.clicked = false;
    this.pressedKeys.clear();
  }
}

// A silent stand-in with the same shape, used by the screenshot scenes so
// the world can be posed without a person at the keyboard.
export function scriptedInput({ move = { x: 0, y: 0 }, aim = { x: 0, y: 0 }, firing = false } = {}) {
  return {
    mouseX: aim.x,
    mouseY: aim.y,
    mouseDown: firing,
    clicked: false,
    moveAxis: () => move,
    firing: () => firing,
    dashPressed: () => false,
    endFrame: () => {},
  };
}
