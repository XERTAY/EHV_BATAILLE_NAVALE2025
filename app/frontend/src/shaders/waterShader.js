export function createWaterUniforms() {
  return {
    uTime: { value: 0 },
    uAmp1: { value: 1.25 },
    uAmp2: { value: 0.75 },
    uFreqX1: { value: 0.13 },
    uFreqY1: { value: 0.11 },
    uSpeed1: { value: 0.45 },
    uSpeedY1: { value: 0.4 },
    uFreqX2: { value: 0.05 },
    uFreqY2: { value: 0.06 },
    uSpeed2: { value: 0.22 },
    uSpeedY2: { value: 0.2 },
    uBaseDeep: { value: [0.02, 0.3, 0.56] },
    uBaseShallow: { value: [0.08, 0.7, 0.95] },
    uFoam: { value: [0.92, 0.98, 1.0] },
    uFoamDark: { value: [0.06, 0.34, 0.68] },
    uWorldScale: { value: 0.028 },
    uFoamDensity: { value: 1.0 },
    uFoamVariance: { value: 0.78 },
    uFoamDrift: { value: 0.16 },
    uFoamSharpness: { value: 1.1 },
    uDistortionSpeed: { value: 0.65 },
  }
}

export const WATER_VERTEX_SHADER = `
  uniform float uTime;
  uniform float uAmp1;
  uniform float uAmp2;
  uniform float uFreqX1;
  uniform float uFreqY1;
  uniform float uSpeed1;
  uniform float uSpeedY1;
  uniform float uFreqX2;
  uniform float uFreqY2;
  uniform float uSpeed2;
  uniform float uSpeedY2;

  varying float vWaveHeight;
  varying vec2 vUv;
  varying vec2 vWorldXZ;

  void main() {
    vec3 transformed = position;
    float wave1 =
      sin(position.x * uFreqX1 + uTime * uSpeed1) *
      cos(position.y * uFreqY1 + uTime * uSpeedY1) *
      uAmp1;
    float wave2 =
      sin(position.x * uFreqX2 - uTime * uSpeed2) *
      cos(position.y * uFreqY2 - uTime * uSpeedY2) *
      uAmp2;
    transformed.z += wave1 + wave2;
    vWaveHeight = transformed.z;
    vUv = uv;
    vWorldXZ = (modelMatrix * vec4(transformed, 1.0)).xz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(transformed, 1.0);
  }
`

export const WATER_FRAGMENT_SHADER = `
  varying float vWaveHeight;
  varying vec2 vUv;
  varying vec2 vWorldXZ;
  uniform float uTime;
  uniform vec3 uBaseDeep;
  uniform vec3 uBaseShallow;
  uniform vec3 uFoam;
  uniform vec3 uFoamDark;
  uniform float uWorldScale;
  uniform float uFoamDensity;
  uniform float uFoamVariance;
  uniform float uFoamDrift;
  uniform float uFoamSharpness;
  uniform float uDistortionSpeed;

  float toonRamp(float value, float steps) {
    return floor(value * steps) / steps;
  }

  float hash11(float p) {
    p = fract(p * 0.1031);
    p *= p + 33.33;
    p *= p + p;
    return fract(p);
  }

  float hash21(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }

  vec2 hash22(vec2 p) {
    float n = hash21(p);
    return vec2(n, hash11(n + p.x + p.y));
  }

  float valueNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    float a = hash21(i + vec2(0.0, 0.0));
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }

  vec2 rotate2D(vec2 p, float angle) {
    float c = cos(angle);
    float s = sin(angle);
    return mat2(c, -s, s, c) * p;
  }

  float circ(vec2 pos, vec2 c, float s) {
    vec2 d = abs(pos - c);
    d = min(d, 1.0 - d);
    return smoothstep(0.0, 0.002, sqrt(s) - sqrt(dot(d, d))) * -1.0;
  }

  float waterLayer(vec2 uv) {
    uv = mod(uv, 1.0);
    float ret = 1.0;
    ret += circ(uv, vec2(0.37378, 0.277169), 0.0268181);
    ret += circ(uv, vec2(0.0317477, 0.540372), 0.0193742);
    ret += circ(uv, vec2(0.430044, 0.882218), 0.0232337);
    ret += circ(uv, vec2(0.641033, 0.695106), 0.0117864);
    ret += circ(uv, vec2(0.0146398, 0.0791346), 0.0299458);
    ret += circ(uv, vec2(0.43871, 0.394445), 0.0289087);
    ret += circ(uv, vec2(0.909446, 0.878141), 0.028466);
    ret += circ(uv, vec2(0.310149, 0.686637), 0.0128496);
    ret += circ(uv, vec2(0.928617, 0.195986), 0.0152041);
    ret += circ(uv, vec2(0.0438506, 0.868153), 0.0268601);
    ret += circ(uv, vec2(0.308619, 0.194937), 0.00806102);
    ret += circ(uv, vec2(0.349922, 0.449714), 0.00928667);
    ret += circ(uv, vec2(0.117761, 0.503309), 0.0151272);
    ret += circ(uv, vec2(0.563517, 0.244991), 0.0292322);
    ret += circ(uv, vec2(0.566936, 0.954457), 0.00981141);
    ret += circ(uv, vec2(0.0489944, 0.200931), 0.0178746);
    ret += circ(uv, vec2(0.569297, 0.624893), 0.0132408);
    ret += circ(uv, vec2(0.629598, 0.295629), 0.0198736);
    ret += circ(uv, vec2(0.334357, 0.266278), 0.0187145);
    ret += circ(uv, vec2(0.965445, 0.505026), 0.006348);
    ret += circ(uv, vec2(0.71403, 0.576945), 0.0215641);
    ret += circ(uv, vec2(0.748873, 0.413325), 0.0110795);
    ret += circ(uv, vec2(0.647463, 0.654349), 0.0188713);
    ret += circ(uv, vec2(0.894762, 0.0657997), 0.00760375);
    return max(ret, 0.0);
  }

  float sampledFoamLayer(vec2 baseUv, float scale, float speedMul, float seedOffset) {
    vec2 uv = baseUv * scale;
    vec2 skewUv = vec2(uv.x + uv.y * 0.37, uv.y - uv.x * 0.29);
    vec2 cell = floor(skewUv);
    vec2 rotatedUv = rotate2D(uv, 1.0472 + seedOffset * 0.11) * 1.13;
    vec2 rotatedCell = floor(rotatedUv);
    vec2 local = fract(skewUv);

    float t = uTime * uDistortionSpeed * speedMul;
    float cellRndA = hash21(cell + vec2(seedOffset, seedOffset * 1.31));
    float cellRndB = hash21(rotatedCell + vec2(seedOffset * 0.57, seedOffset * 2.41));
    float cellRnd = mix(cellRndA, cellRndB, 0.5);
    float angle = (cellRnd - 0.5) * 6.2831853 * (uFoamVariance * 1.15);
    local = rotate2D(local - 0.5, angle) + 0.5;

    vec2 jitterA = hash22(cell + vec2(seedOffset * 2.17, seedOffset * 0.73)) - 0.5;
    vec2 jitterB = hash22(rotatedCell + vec2(seedOffset * 1.37, seedOffset * 2.03)) - 0.5;
    vec2 jitter = mix(jitterA, vec2(jitterB.y, -jitterB.x), 0.55);
    local += jitter * (0.28 * uFoamVariance);

    vec2 drift = vec2(
      sin(t + cellRnd * 6.2831853),
      cos(t * 0.9 + cellRnd * 4.712389)
    ) * (uFoamDrift * 0.65);

    float localNoise = valueNoise(uv * 0.91 + jitter * 2.0 + seedOffset);
    vec2 warpedLocal = local + drift + (localNoise - 0.5) * 0.26;

    float foamPattern = 1.0 - clamp(waterLayer(warpedLocal), 0.0, 1.0);
    float thresholdShift = (cellRnd - 0.5) * 0.32 * uFoamVariance;
    return smoothstep(0.1 + thresholdShift, 0.92 + thresholdShift, foamPattern);
  }

  void main() {
    float wave01 = clamp((vWaveHeight + 2.3) / 4.6, 0.0, 1.0);
    float stepped = toonRamp(wave01, 4.0);
    vec3 waterColor = mix(uBaseDeep, uBaseShallow, stepped);

    vec2 worldUv = vWorldXZ * uWorldScale;
    float t = uTime * uDistortionSpeed;

    float xCoord = 0.07 * (
      sin(vWorldXZ.y * 4.0 / 100.0 + t * 0.5) +
      sin(vWorldXZ.y * 6.8 / 100.0 + t * 0.75) +
      sin(vWorldXZ.y * 11.3 / 100.0 + t * 0.2)
    ) / 3.0;
    float yCoord = 0.07 * (
      sin(vWorldXZ.x * 3.5 / 100.0 + t * 0.35) +
      sin(vWorldXZ.x * 4.8 / 100.0 + t * 1.05) +
      sin(vWorldXZ.x * 7.3 / 100.0 + t * 0.45)
    ) / 3.0;

    vec2 diagonalBreak = vec2(
      valueNoise(rotate2D(worldUv * 0.92, 0.73) + vec2(t * 0.03, -t * 0.02)),
      valueNoise(rotate2D(worldUv * 1.19, -1.11) + vec2(-t * 0.03, t * 0.02))
    ) - 0.5;
    vec2 domainUv = worldUv + vec2(xCoord, yCoord) + diagonalBreak * 0.42;

    float macroFoam = sampledFoamLayer(domainUv, 0.16, 0.45, 1.21);
    float midFoam = sampledFoamLayer(domainUv + vec2(0.73, -0.37), 0.34, 0.8, 3.77);

    float foamMain = clamp(
      macroFoam * 0.66 +
      midFoam * 0.34,
      0.0,
      1.0
    );
    foamMain = pow(foamMain, 1.0 / max(0.001, uFoamSharpness));
    foamMain *= uFoamDensity;

    float undertoneJitter = valueNoise(domainUv * 0.9 + 13.7);
    float foamUndertone = clamp(foamMain * 0.65 + undertoneJitter * 0.22, 0.0, 1.0);

    float crestMask = smoothstep(0.74, 0.93, wave01);
    float crashFlow = sin((vWorldXZ.x * 0.18 + vWorldXZ.y * 0.27) - t * 2.4);
    float crashDetail = sin(vWorldXZ.x * 0.65 - t * 3.2) * sin(vWorldXZ.y * 0.52 + t * 2.6);
    float crashFoam = smoothstep(0.35, 0.82, crashFlow + crashDetail * 0.55);
    crashFoam *= crestMask;

    float rim = smoothstep(0.12, 0.95, wave01) * 0.22;
    vec3 color = waterColor + rim;
    color = mix(color, uFoamDark, foamUndertone * 0.2);
    color = mix(color, uFoam, foamMain * 0.26);
    color = mix(color, uFoam, crashFoam * 0.9);
    gl_FragColor = vec4(color, 0.95);
  }
`
