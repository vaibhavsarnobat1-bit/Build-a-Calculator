/**
 * ThreeUI ElementsCollection — Water Variant (WebGL2 + Canvas 2D)
 * Adapted from exact ThreeUI elemental-water source (SHA-256 7a6871fe99fa).
 * Configured with OpenAI mark removed as requested by user.
 */

(function () {
  'use strict';

  const SIM_RES = 512;
  const DPR = Math.min(window.devicePixelRatio || 1, 1.75);
  const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const VERT = `#version 300 es
out vec2 vUv;
void main(){
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

  /* Water wave simulation step (ping-pong, r = h, g = h_prev) */
  const FRAG_SIM = `#version 300 es
precision highp float;
uniform sampler2D uState;
uniform vec2 uTexel;
uniform vec3 uDrop; // sim-uv.xy, strength
in vec2 vUv;
out vec4 frag;
void main(){
  vec2 s = texture(uState, vUv).rg;
  float l = texture(uState, vUv - vec2(uTexel.x, 0.0)).r;
  float r = texture(uState, vUv + vec2(uTexel.x, 0.0)).r;
  float u = texture(uState, vUv + vec2(0.0, uTexel.y)).r;
  float d = texture(uState, vUv - vec2(0.0, uTexel.y)).r;
  float next = (l + r + u + d) * 0.5 - s.g;
  next *= 0.984;
  if (uDrop.z != 0.0){
    float dd = distance(vUv, uDrop.xy);
    next += uDrop.z * exp(-dd * dd * 3800.0);
  }
  frag = vec4(next, s.r, 0.0, 1.0);
}`;

  /* Water rendering shader with wave refraction & specular shine */
  const FRAG_WATER = `#version 300 es
precision highp float;
uniform float uTime;
uniform float uAspect;
uniform sampler2D uState;
uniform vec2 uSimTexel;
in vec2 vUv;
out vec4 frag;

float hash21(vec2 p){
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash21(i), b = hash21(i + vec2(1,0));
  float c = hash21(i + vec2(0,1)), d = hash21(i + vec2(1,1));
  return mix(mix(a,b,f.x), mix(c,d,f.x), f.y);
}

float fbm(vec2 p){
  float v = 0.0, a = 0.5;
  mat2 r = mat2(0.8, -0.6, 0.6, 0.8);
  for (int i = 0; i < 5; i++){ v += a * vnoise(p); p = r * p * 2.03; a *= 0.5; }
  return v;
}

float edgeFade(vec2 uv){
  return smoothstep(0.0, 0.05, uv.x) * smoothstep(1.0, 0.95, uv.x)
       * smoothstep(0.0, 0.05, uv.y) * smoothstep(1.0, 0.95, uv.y);
}

vec2 simUV(vec2 uv){
  return 0.5 + (uv - 0.5) * vec2(uAspect, 1.0) / max(uAspect, 1.0);
}

void main(){
  vec2 suv = simUV(vUv);
  float h  = texture(uState, suv).r;
  float hx = texture(uState, suv + vec2(uSimTexel.x, 0.0)).r - texture(uState, suv - vec2(uSimTexel.x, 0.0)).r;
  float hy = texture(uState, suv + vec2(0.0, uSimTexel.y)).r - texture(uState, suv - vec2(0.0, uSimTexel.y)).r;
  vec2 grad = vec2(hx, hy);
  vec3 nrm = normalize(vec3(-grad * 32.0, 1.0));

  // Deep fluid base tone
  vec3 col = mix(vec3(0.005, 0.020, 0.040), vec3(0.010, 0.065, 0.110), vUv.y * 0.8 + h * 0.25);
  col += vec3(0.015, 0.08, 0.12) * fbm(vUv * vec2(uAspect, 1.0) * 2.8 + uTime * 0.04) * 0.35;

  // Ripple illumination: crests luminous cyan, troughs deeper blue
  col += vec3(0.08, 0.32, 0.44) * clamp(h * 2.0, -0.06, 1.0);
  col += vec3(0.24, 0.58, 0.72) * pow(clamp(h * 2.8, 0.0, 1.0), 2.0) * 0.55;

  // Specular reflection glint
  vec3 L = normalize(vec3(-0.35, 0.55, 0.75));
  vec3 H = normalize(L + vec3(0.0, 0.0, 1.0));
  float spec = pow(max(dot(nrm, H), 0.0), 140.0);
  col += spec * vec3(0.65, 0.92, 1.0) * 0.95;

  col *= 0.45 + 0.55 * edgeFade(vUv);
  col += (hash21(vUv * 617.0 + uTime) - 0.5) / 128.0;
  frag = vec4(col, 1.0);
}`;

  /* Suspended Particle System */
  const PART_VERT = `#version 300 es
precision highp float;
layout(location=0) in vec2 aPos;
layout(location=1) in vec2 aNorm;
layout(location=2) in float aSeed;
uniform float uTime;
uniform float uDpr;
uniform vec4  uCfgA;  // travel, lifeMin, lifeMax, alongNormal
uniform vec4  uCfgB;  // wiggle, sizeMin, sizeMax, sparse
out float vFade;
out float vMixC;

float h1(float n){ return fract(sin(n) * 43758.5453); }

void main(){
  float hs   = h1(aSeed * 1.31);
  float life = mix(uCfgA.y, uCfgA.z, hs);
  float tt   = uTime / life + aSeed * 13.7;
  float ph   = fract(tt);
  float cyc  = floor(tt);
  float r1 = h1(aSeed + cyc * 0.317);
  float r2 = h1(aSeed * 2.13 + cyc * 0.771);
  float on = step(uCfgB.w, r2);

  vec2 dir = normalize(vec2(r1 - 0.5, h1(r1 * 7.0) - 0.5) + aNorm * 0.35);
  float trav = uCfgA.x * (0.45 + 0.9 * r1);
  vec2 p = aPos + dir * trav * ph;
  p.x += sin(ph * 10.0 + r1 * 40.0 + uTime * 0.5) * uCfgB.x * ph;

  vFade = on * smoothstep(0.0, 0.15, ph) * smoothstep(1.0, 0.4, ph) * mix(0.4, 1.0, r2);
  vMixC = h1(aSeed * 3.7 + cyc);
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
  gl_PointSize = mix(uCfgB.y, uCfgB.z, h1(aSeed * 5.11 + cyc)) * uDpr * (1.0 - 0.35 * ph);
}`;

  const PART_FRAG = `#version 300 es
precision highp float;
uniform vec3 uColA;
uniform vec3 uColB;
in float vFade;
in float vMixC;
out vec4 frag;
void main(){
  vec2 q = gl_PointCoord * 2.0 - 1.0;
  float r2 = dot(q, q);
  if (r2 > 1.0) discard;
  float a = exp(-r2 * 3.5) * (1.0 - r2);
  frag = vec4(mix(uColA, uColB, vMixC) * a * vFade, 1.0);
}`;

  function compile(gl, type, src) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      console.warn(gl.getShaderInfoLog(sh));
      return null;
    }
    return sh;
  }

  function program(gl, vertSrc, fragSrc) {
    const p = gl.createProgram();
    const vs = compile(gl, gl.VERTEX_SHADER, vertSrc);
    const fs = compile(gl, gl.FRAGMENT_SHADER, fragSrc);
    if (!vs || !fs) return null;
    gl.attachShader(p, vs);
    gl.attachShader(p, fs);
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      console.warn(gl.getProgramInfoLog(p));
      return null;
    }
    return p;
  }

  function makeParticleData(count) {
    const data = new Float32Array(count * 5);
    for (let i = 0; i < count; i++) {
      data[i * 5]     = Math.random(); // pos.x (0 to 1)
      data[i * 5 + 1] = Math.random(); // pos.y (0 to 1)
      const angle = Math.random() * Math.PI * 2;
      data[i * 5 + 2] = Math.cos(angle); // norm.x
      data[i * 5 + 3] = Math.sin(angle); // norm.y
      data[i * 5 + 4] = Math.random() * 100 + i * 0.618; // seed
    }
    return data;
  }

  class WaterSimulation {
    constructor(canvas) {
      this.canvas = canvas;
      this.pointer = { x: 0.5, y: 0.5, active: 0 };
      this.dropQueue = [];
      this.nextAutoDrop = 0.5;
      this.needsResize = false;
      this.ok = false;

      const gl = canvas.getContext('webgl2', { alpha: false, antialias: false, powerPreference: 'high-performance' });
      if (!gl) return;
      this.gl = gl;

      this.prog = program(gl, VERT, FRAG_WATER);
      if (!this.prog) return;

      this.uni = {
        uTime: gl.getUniformLocation(this.prog, 'uTime'),
        uAspect: gl.getUniformLocation(this.prog, 'uAspect'),
        uState: gl.getUniformLocation(this.prog, 'uState'),
        uSimTexel: gl.getUniformLocation(this.prog, 'uSimTexel'),
      };

      // Ping pong simulation buffers
      const ext = gl.getExtension('EXT_color_buffer_float');
      if (!ext) return;

      this.simProg = program(gl, VERT, FRAG_SIM);
      if (!this.simProg) return;

      this.simUni = {
        uState: gl.getUniformLocation(this.simProg, 'uState'),
        uTexel: gl.getUniformLocation(this.simProg, 'uTexel'),
        uDrop: gl.getUniformLocation(this.simProg, 'uDrop'),
      };

      this.simTex = [];
      this.simFbo = [];
      for (let i = 0; i < 2; i++) {
        const t = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, t);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG16F, SIM_RES, SIM_RES, 0, gl.RG, gl.HALF_FLOAT, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        const f = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, f);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
        this.simTex.push(t);
        this.simFbo.push(f);
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      this.simSrc = 0;

      // Particle system
      const particleCount = 180;
      this.particleCount = particleCount;
      this.partProg = program(gl, PART_VERT, PART_FRAG);
      if (this.partProg) {
        this.partUni = {
          uTime: gl.getUniformLocation(this.partProg, 'uTime'),
          uDpr: gl.getUniformLocation(this.partProg, 'uDpr'),
          uCfgA: gl.getUniformLocation(this.partProg, 'uCfgA'),
          uCfgB: gl.getUniformLocation(this.partProg, 'uCfgB'),
          uColA: gl.getUniformLocation(this.partProg, 'uColA'),
          uColB: gl.getUniformLocation(this.partProg, 'uColB'),
        };

        const data = makeParticleData(particleCount);
        this.partVao = gl.createVertexArray();
        gl.bindVertexArray(this.partVao);
        const buf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 20, 0);
        gl.enableVertexAttribArray(1);
        gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 20, 8);
        gl.enableVertexAttribArray(2);
        gl.vertexAttribPointer(2, 1, gl.FLOAT, false, 20, 16);
        gl.bindVertexArray(null);
      }

      this.resize();
      window.addEventListener('resize', () => { this.needsResize = true; }, { passive: true });
      this.bindEvents();
      this.ok = true;
    }

    resize() {
      const w = Math.max(2, Math.round(window.innerWidth * DPR));
      const h = Math.max(2, Math.round(window.innerHeight * DPR));
      if (this.canvas.width !== w || this.canvas.height !== h) {
        this.canvas.width = w;
        this.canvas.height = h;
      }
      this.aspect = w / h;
    }

    getCalculatorRect() {
      const calc = document.getElementById('calculatorApp');
      if (!calc) return null;
      const r = calc.getBoundingClientRect();
      return {
        x1: (r.left - 10) / window.innerWidth,
        x2: (r.right + 10) / window.innerWidth,
        y1: 1 - (r.bottom + 10) / window.innerHeight,
        y2: 1 - (r.top - 10) / window.innerHeight,
      };
    }

    isInsideCalculator(x, y) {
      const r = this.getCalculatorRect();
      if (!r) return false;
      return x >= r.x1 && x <= r.x2 && y >= r.y1 && y <= r.y2;
    }

    bindEvents() {
      let last = null;
      let lastT = 0;

      const isOverCalcElement = (e) => {
        if (!e) return false;
        const target = e.target;
        return Boolean(target && target.closest && target.closest('.calculator-card, .drawer, .toast-notice'));
      };

      const onMove = (e) => {
        if (isOverCalcElement(e)) {
          last = null;
          this.pointer.active = 0;
          return;
        }

        const x = e.clientX / window.innerWidth;
        const y = 1 - e.clientY / window.innerHeight;

        if (this.isInsideCalculator(x, y)) {
          last = null;
          this.pointer.active = 0;
          return;
        }

        const now = performance.now();
        this.pointer.x = x;
        this.pointer.y = y;
        this.pointer.active = 1;

        if (last) {
          const dt = Math.max(8, now - lastT);
          const dx = x - last.x;
          const dy = y - last.y;
          const speed = Math.hypot(dx, dy) / (dt / 1000);
          if (speed > 0.04 && this.dropQueue.length < 6) {
            this.dropQueue.push({ x, y, s: Math.min(speed * 0.16, 0.6) });
          }
        }
        last = { x, y };
        lastT = now;
      };

      window.addEventListener('pointermove', onMove, { passive: true });

      window.addEventListener('pointerdown', (e) => {
        if (isOverCalcElement(e)) return;
        const x = e.clientX / window.innerWidth;
        const y = 1 - e.clientY / window.innerHeight;
        if (this.isInsideCalculator(x, y)) return;

        this.dropQueue.push({ x, y, s: 0.95 });
        this.pointer.active = 1.6;
      }, { passive: true });

      window.addEventListener('pointerup', () => {
        this.pointer.active = 1;
      }, { passive: true });
    }

    toSimUV(x, y) {
      const a = this.aspect;
      const m = Math.max(a, 1);
      return { x: 0.5 + (x - 0.5) * a / m, y: 0.5 + (y - 0.5) / m };
    }

    stepSim(t) {
      const gl = this.gl;
      if (t > this.nextAutoDrop) {
        // Drop ripples in the surrounding background outside the center calculator
        let rx = Math.random();
        let ry = Math.random();
        // If it rolls inside center calculator, push to outer perimeter
        if (this.isInsideCalculator(rx, ry)) {
          rx = Math.random() < 0.5 ? Math.random() * 0.22 : 0.78 + Math.random() * 0.22;
        }

        this.dropQueue.push({
          x: rx,
          y: ry,
          s: 0.14 + Math.random() * 0.28
        });
        this.nextAutoDrop = t + 0.8 + Math.random() * 1.5;
      }

      gl.useProgram(this.simProg);
      gl.viewport(0, 0, SIM_RES, SIM_RES);
      gl.uniform2f(this.simUni.uTexel, 1 / SIM_RES, 1 / SIM_RES);

      for (let i = 0; i < 2; i++) {
        const drop = this.dropQueue.shift();
        if (drop) {
          const s = this.toSimUV(drop.x, drop.y);
          gl.uniform3f(this.simUni.uDrop, s.x, s.y, drop.s);
        } else {
          gl.uniform3f(this.simUni.uDrop, 0, 0, 0);
        }

        const dst = 1 - this.simSrc;
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.simFbo[dst]);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.simTex[this.simSrc]);
        gl.uniform1i(this.simUni.uState, 0);

        gl.drawArrays(gl.TRIANGLES, 0, 3);
        this.simSrc = dst;
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    draw(t) {
      const gl = this.gl;
      if (this.needsResize) {
        this.needsResize = false;
        this.resize();
      }

      this.stepSim(t);

      gl.useProgram(this.prog);
      gl.viewport(0, 0, this.canvas.width, this.canvas.height);

      gl.uniform1f(this.uni.uTime, t);
      gl.uniform1f(this.uni.uAspect, this.aspect);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.simTex[this.simSrc]);
      gl.uniform1i(this.uni.uState, 0);
      gl.uniform2f(this.uni.uSimTexel, 1 / SIM_RES, 1 / SIM_RES);

      gl.drawArrays(gl.TRIANGLES, 0, 3);

      // Render Suspended particles
      if (this.partProg) {
        gl.useProgram(this.partProg);
        gl.uniform1f(this.partUni.uTime, t);
        gl.uniform1f(this.partUni.uDpr, DPR);
        gl.uniform4f(this.partUni.uCfgA, 0.12, 4.0, 8.0, 0.15); // travel, lifeMin, lifeMax, alongNormal
        gl.uniform4f(this.partUni.uCfgB, 0.02, 1.5, 3.5, 0.4);  // wiggle, sizeMin, sizeMax, sparse
        gl.uniform3f(this.partUni.uColA, 0.10, 0.28, 0.38);
        gl.uniform3f(this.partUni.uColB, 0.25, 0.50, 0.65);

        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE);
        gl.bindVertexArray(this.partVao);
        gl.drawArrays(gl.POINTS, 0, this.particleCount);
        gl.bindVertexArray(null);
        gl.disable(gl.BLEND);
      }
    }
  }

  // Initialize once DOM is ready
  function init() {
    const canvas = document.getElementById('waterCanvas');
    if (!canvas) return;

    const sim = new WaterSimulation(canvas);
    if (!sim.ok) return;

    const t0 = performance.now();
    function loop() {
      const t = (performance.now() - t0) / 1000;
      sim.draw(t);
      if (!REDUCED) requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
