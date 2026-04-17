import { type FC, useRef, useEffect } from 'react';
import { useFocus } from '../contexts/FocusContext';

// ─── Shaders ─────────────────────────────────────────────────────────────────

const VERT = `
attribute vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

const FRAG = `
precision mediump float;
uniform float u_time;
uniform float u_intensity;
uniform float u_speed;
uniform vec2 u_res;

float hash(vec2 p) {
  p = fract(p * vec2(127.1, 311.7));
  p += dot(p, p + 19.19);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
    f.y
  );
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p = p * 2.1 + vec2(3.7, 1.3);
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_res;
  float aspect = u_res.x / u_res.y;

  vec2 nUV = vec2(uv.x * aspect * 5.0, uv.y * 5.0);
  nUV.y -= u_time * u_speed;

  float warp = fbm(nUV + fbm(nUV + u_time * 0.15));

  // Intensity drives height; smoothstep fade-out avoids abrupt cut
  float fireTop = u_intensity * 0.95;
  float heat = 1.0 - uv.y / max(fireTop, 0.001);
  heat += (warp - 0.5) * 0.45;
  heat = clamp(heat, 0.0, 1.0);
  heat = pow(heat, 2.0);
  // Fade alpha to zero as intensity approaches 0 — no abrupt line
  heat *= smoothstep(0.0, 0.08, u_intensity);

  // At intensity=1.0 (1h+) tips shift toward white
  vec3 tipColor = mix(vec3(1.0, 0.85, 0.40), vec3(1.0, 1.0, 0.92), smoothstep(0.85, 1.0, u_intensity));

  vec3 col = mix(vec3(0.0),           vec3(0.25, 0.02, 0.0),  smoothstep(0.0,  0.15, heat));
  col = mix(col, vec3(0.65, 0.10, 0.01), smoothstep(0.15, 0.30, heat));
  col = mix(col, vec3(0.93, 0.41, 0.17), smoothstep(0.30, 0.65, heat));
  col = mix(col, vec3(1.0,  0.62, 0.08), smoothstep(0.65, 0.85, heat));
  col = mix(col, tipColor,               smoothstep(0.85, 1.0,  heat));

  gl_FragColor = vec4(col, heat);
}
`;

// ─── WebGL helpers ────────────────────────────────────────────────────────────

function compileShader(gl: WebGLRenderingContext, type: number, src: string): WebGLShader | null {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error('FireBackground shader error:', gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const FireBackground: FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const debugRef = useRef<HTMLDivElement>(null);
  const { minutes, timerStatus } = useFocus();

  const minutesRef = useRef(0);
  minutesRef.current = minutes;

  const targetRef = useRef(0);
  targetRef.current = (() => {
    if (timerStatus === 'idle') return 0;
    if (minutes < 15) return 0.22;
    if (minutes < 30) return 0.60;
    if (minutes < 60) return 0.80;
    return 1.0;
  })();

  // Reset current intensity to 0 when timer starts from idle
  const prevStatusRef = useRef<string>('idle');
  const resetRef = useRef(false);
  if (prevStatusRef.current === 'idle' && timerStatus !== 'idle') {
    resetRef.current = true;
  }
  prevStatusRef.current = timerStatus;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: false });
    if (!gl) return;

    // Compile + link program
    const vert = compileShader(gl, gl.VERTEX_SHADER, VERT);
    const frag = compileShader(gl, gl.FRAGMENT_SHADER, FRAG);
    if (!vert || !frag) return;

    const prog = gl.createProgram()!;
    gl.attachShader(prog, vert);
    gl.attachShader(prog, frag);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.error('FireBackground link error:', gl.getProgramInfoLog(prog));
      return;
    }
    gl.useProgram(prog);

    // Full-screen quad (two triangles)
    const buf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1,  1, -1, -1,  1,
      -1,  1,  1, -1,  1,  1,
    ]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(prog, 'a_pos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const uTime      = gl.getUniformLocation(prog, 'u_time');
    const uIntensity = gl.getUniformLocation(prog, 'u_intensity');
    const uSpeed     = gl.getUniformLocation(prog, 'u_speed');
    const uRes       = gl.getUniformLocation(prog, 'u_res');

    // Additive blending — fire adds light, no dark fringing
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);

    const resize = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
      gl.viewport(0, 0, canvas.width, canvas.height);
    };
    resize();
    window.addEventListener('resize', resize);

    let raf: number;
    const startTime = performance.now();
    let current = 0;
    let currentSpeed = 0.35;

    const draw = () => {
      raf = requestAnimationFrame(draw);

      if (resetRef.current) { current = 0; currentSpeed = 0.35; resetRef.current = false; }
      const target = targetRef.current;
      const targetSpeed = 0.35 + target * 0.7;

      if (target === 0) {
        // Fading out: drop intensity fast, keep speed frozen so fire looks natural
        current += (0 - current) * 0.04;
        if (current < 0.005) currentSpeed = 0.35; // silent reset once invisible
      } else {
        // Active: intensity and speed lerp independently
        current += (target - current) * 0.005;
        currentSpeed += (targetSpeed - currentSpeed) * 0.008;
      }
      const animSpeed = currentSpeed;
      if (debugRef.current) {
        debugRef.current.textContent = `u_intensity: ${current.toFixed(3)}  u_speed: ${animSpeed.toFixed(3)}  target: ${target.toFixed(2)}  minutes: ${minutesRef.current.toFixed(1)}`;
      }

      gl.clear(gl.COLOR_BUFFER_BIT);
      if (current < 0.005) return;

      const t = (performance.now() - startTime) / 1000;
      gl.uniform1f(uTime, t);
      gl.uniform1f(uIntensity, current);
      gl.uniform1f(uSpeed, animSpeed);
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    };
    draw();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      gl.deleteProgram(prog);
      gl.deleteShader(vert);
      gl.deleteShader(frag);
      gl.deleteBuffer(buf);
    };
  }, []);

  return (
    <>
      <canvas
        ref={canvasRef}
        style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', zIndex: 0, pointerEvents: 'none' }}
      />
      {import.meta.env.DEV && (
        <div
          ref={debugRef}
          style={{ position: 'fixed', bottom: 40, left: '50%', transform: 'translateX(-50%)', zIndex: 999, background: 'rgba(0,0,0,0.7)', color: '#0f0', fontFamily: 'monospace', fontSize: 12, padding: '4px 8px', pointerEvents: 'none', whiteSpace: 'nowrap' }}
        />
      )}
    </>
  );
};
