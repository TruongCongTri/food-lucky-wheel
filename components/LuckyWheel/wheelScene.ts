import * as THREE from "three";
import { GEO, TAU, type WheelRenderer } from "./wheelMath";
import type { WheelFace } from "./wheelFace";

/**
 * Three.js wheel — the progressive enhancement over FlatWheel.
 * Code-split: this module (and three.js) is only downloaded once the page is
 * idle, so it never delays the first paint or hydration.
 *
 * Tuned for weak/old phones:
 *  - no PMREM/RoomEnvironment pre-pass and no physical (clear-coat) material —
 *    Phong lighting compiles fast and runs on any GPU;
 *  - pegs and bulbs are instanced (3 draw calls instead of ~40);
 *  - the face texture is sized to the screen and has no mipmaps;
 *  - pixel ratio / antialiasing adapt to the device;
 *  - `failIfMajorPerformanceCaveat` refuses software rendering (it would crawl);
 *  - a lost GPU context is reported so the wheel falls back to 2D instead of
 *    staying blank.
 * Rendering is on-demand (no idle rAF loop).
 */
export class WheelScene implements WheelRenderer {
  readonly kind = "webgl" as const;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  private spinner = new THREE.Group();
  private texture: THREE.CanvasTexture;
  private pegs: THREE.InstancedMesh | null = null;
  private pegGeo = new THREE.SphereGeometry(0.02, 10, 8);
  private pegMat = new THREE.MeshPhongMaterial({ color: 0x1a1414, specular: 0x777777, shininess: 60 });
  private bulbMats: THREE.MeshPhongMaterial[] = [];
  private disposables: { dispose(): void }[] = [];
  private _rotation = 0;
  private lost = false;
  private disposed = false;

  /** Throws if WebGL (2) isn't available or would be software-rendered. */
  constructor(
    host: HTMLElement,
    face: WheelFace,
    opts: { lowEnd: boolean; force?: boolean; onLost: () => void },
  ) {
    const dpr = window.devicePixelRatio || 1;
    this.renderer = new THREE.WebGLRenderer({
      antialias: !opts.lowEnd && dpr < 2, // high-DPR screens don't need MSAA
      alpha: true,
      powerPreference: "default",
      failIfMajorPerformanceCaveat: !opts.force,
    });
    const renderer = this.renderer;
    renderer.setPixelRatio(Math.min(dpr, opts.lowEnd ? 1.5 : 2));
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    const canvas = renderer.domElement;
    canvas.setAttribute("aria-hidden", "true");
    canvas.style.cssText =
      "position:absolute;inset:0;width:100%;height:100%;display:block;opacity:0;transition:opacity .45s ease;";
    canvas.addEventListener("webglcontextlost", () => {
      this.lost = true;
      if (!this.disposed) opts.onLost(); // ignore our own release in dispose()
    });
    host.appendChild(canvas);

    this.camera.position.set(0, 0, 4.6);
    this.scene.add(new THREE.AmbientLight(0xffffff, 1.1));
    const key = new THREE.DirectionalLight(0xfff4e6, 1.6);
    key.position.set(-2, 3, 5);
    this.scene.add(key);

    // Root turned slightly toward the viewer on the left (pointer side).
    const root = new THREE.Group();
    root.rotation.y = 0.16;
    root.rotation.x = -0.04;
    this.scene.add(root);

    // Ink back plate
    const backGeo = new THREE.CylinderGeometry(GEO.plate, GEO.plate, 0.16, 72);
    const backMat = new THREE.MeshPhongMaterial({ color: 0x1a1414, specular: 0x222222, shininess: 30 });
    const back = new THREE.Mesh(backGeo, backMat);
    back.rotation.x = Math.PI / 2;
    back.position.z = -0.09;
    root.add(back);

    // Slim glossy ink rim
    const rimGeo = new THREE.TorusGeometry(GEO.rim, GEO.tube, 12, 120);
    const rimMat = new THREE.MeshPhongMaterial({ color: 0x1a1414, specular: 0x8a8a8a, shininess: 90 });
    root.add(new THREE.Mesh(rimGeo, rimMat));

    // Marquee bulbs: two instanced sets that blink alternately.
    const BULBS = 24;
    const bulbGeo = new THREE.SphereGeometry(GEO.bulb, 10, 8);
    const m = new THREE.Matrix4();
    for (let set = 0; set < 2; set++) {
      const mat = new THREE.MeshPhongMaterial({
        color: 0xf3ede3,
        emissive: 0xf2c14e,
        emissiveIntensity: 0.15,
        shininess: 40,
      });
      this.bulbMats.push(mat);
      const inst = new THREE.InstancedMesh(bulbGeo, mat, BULBS / 2);
      for (let k = 0; k < BULBS / 2; k++) {
        const a = ((k * 2 + set) / BULBS) * TAU;
        inst.setMatrixAt(k, m.makeTranslation(Math.cos(a) * GEO.rim, Math.sin(a) * GEO.rim, GEO.tube));
      }
      root.add(inst);
      this.disposables.push(inst);
    }

    // Spinner: printed face (+ pegs, see setPegs)
    root.add(this.spinner);
    const texture = (this.texture = new THREE.CanvasTexture(face.canvas));
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.generateMipmaps = false; // sized ~1:1 to the screen, so none needed
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    const faceGeo = new THREE.CircleGeometry(GEO.face, 96);
    const faceMat = new THREE.MeshBasicMaterial({ map: texture });
    this.spinner.add(new THREE.Mesh(faceGeo, faceMat));

    this.disposables.push(
      backGeo,
      backMat,
      rimGeo,
      rimMat,
      bulbGeo,
      ...this.bulbMats,
      texture,
      faceGeo,
      faceMat,
      this.pegGeo,
      this.pegMat,
    );
  }

  get rotation() {
    return this._rotation;
  }

  set rotation(value: number) {
    this._rotation = value;
    this.spinner.rotation.z = value;
  }

  faceChanged() {
    this.texture.needsUpdate = true;
    this.render();
  }

  setPegs(count: number) {
    if (this.pegs) {
      this.spinner.remove(this.pegs);
      this.pegs.dispose();
      this.pegs = null;
    }
    if (count < 2) return;
    const seg = TAU / count;
    const m = new THREE.Matrix4();
    const inst = new THREE.InstancedMesh(this.pegGeo, this.pegMat, count);
    for (let i = 0; i < count; i++) {
      const a = Math.PI / 2 - (i + 0.5) * seg;
      inst.setMatrixAt(i, m.makeTranslation(Math.cos(a) * GEO.peg * GEO.face, Math.sin(a) * GEO.peg * GEO.face, 0.02));
    }
    this.spinner.add(inst);
    this.pegs = inst;
  }

  setBulbs(time: number | null) {
    const [a, b] = this.bulbMats;
    if (time === null) {
      a.emissiveIntensity = b.emissiveIntensity = 0.15;
      return;
    }
    const on = Math.floor(time * 9) % 2 === 0;
    a.emissiveIntensity = on ? 2.2 : 0.1;
    b.emissiveIntensity = on ? 0.1 : 2.2;
  }

  resize(size: number) {
    if (size <= 0) return;
    this.renderer.setSize(size, size, false);
    this.render();
  }

  render() {
    if (!this.lost) this.renderer.render(this.scene, this.camera);
  }

  show(visible: boolean) {
    this.renderer.domElement.style.opacity = visible ? "1" : "0";
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.pegs?.dispose();
    this.disposables.forEach((d) => d.dispose());
    this.renderer.dispose();
    // Free the GPU context now instead of at GC time. Browsers cap live WebGL
    // contexts (~16); navigating home <-> menu creates a new one each visit, and
    // lingering ones stall the GPU process or get the active wheel's context killed.
    this.renderer.forceContextLoss();
    this.renderer.domElement.remove();
  }
}
