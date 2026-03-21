const SAMPLE_IDS = [
  "1CRN",
  "1STP",
  "1UBQ",
  "1MBO",
  "1HHP",
  "1TIM",
  "1PTQ",
  "1AON",
  "1BTA",
  "1AKI",
  "1LYZ",
  "1PGA",
  "1R69",
  "1CYO",
  "1GFL",
  "1L2Y",
  "1KTE",
  "2MNR",
  "2PTC",
  "2CI2",
  "2DN2",
  "2GB1",
  "2HBB",
  "2RH1",
  "3NIR",
  "3CLN",
  "3EAM",
  "3PQR",
  "4HHB",
  "4AKE",
  "4INS",
  "5CYT",
  "6LYZ",
  "7RSA"
];
const PDB_ENDPOINT = "https://files.rcsb.org/download/";
const RCSB_SEARCH_ENDPOINT = "https://search.rcsb.org/rcsbsearch/v2/query";
const EPSILON = 1e-6;

const pdbIdInput = document.getElementById("pdbId");
const loadBtn = document.getElementById("loadBtn");
const randomBtn = document.getElementById("randomBtn");
const xRotInput = document.getElementById("xRot");
const yRotInput = document.getElementById("yRot");
const zRotInput = document.getElementById("zRot");
const scaleInput = document.getElementById("scale");
const autoRotateInput = document.getElementById("autoRotate");
const turntableSpeedInput = document.getElementById("turntableSpeed");
const showNumbersInput = document.getElementById("showNumbers");
const highlightStartInput = document.getElementById("highlightStart");
const highlightEndInput = document.getElementById("highlightEnd");
const applyRangeBtn = document.getElementById("applyRangeBtn");
const clearRangeBtn = document.getElementById("clearRangeBtn");
const configToggleBtn = document.getElementById("configToggleBtn");
const fullscreenBtn = document.getElementById("fullscreenBtn");
const configPanel = document.getElementById("configPanel");
const lightingEnabledInput = document.getElementById("lightingEnabled");
const showLightSourceInput = document.getElementById("showLightSource");
const lightXInput = document.getElementById("lightX");
const lightYInput = document.getElementById("lightY");
const lightZInput = document.getElementById("lightZ");
const lightStrengthInput = document.getElementById("lightStrength");
const ambientStrengthInput = document.getElementById("ambientStrength");
const diffuseStrengthInput = document.getElementById("diffuseStrength");
const specularStrengthInput = document.getElementById("specularStrength");
const shininessInput = document.getElementById("shininess");
const backboneThicknessInput = document.getElementById("backboneThickness");
const atomSizeInput = document.getElementById("atomSize");
const proteinZoomInput = document.getElementById("proteinZoom");
const chainShadeDifferenceInput = document.getElementById("chainShadeDifference");
const showLegendOverlayInput = document.getElementById("showLegendOverlay");
const showStructureOverlayInput = document.getElementById("showStructureOverlay");
const showEntryOverlayInput = document.getElementById("showEntryOverlay");
const autoRandomProteinInput = document.getElementById("autoRandomProtein");
const backboneColorInput = document.getElementById("backboneColor");
const atomColorInput = document.getElementById("atomColor");
const highlightColorInput = document.getElementById("highlightColor");
const labelColorInput = document.getElementById("labelColor");
const bgTopColorInput = document.getElementById("bgTopColor");
const bgBottomColorInput = document.getElementById("bgBottomColor");
const statusEl = document.getElementById("status");
const metaEl = document.getElementById("meta");
const infoContentEl = document.getElementById("infoContent");
const viewerMainEl = document.getElementById("viewerMain");
const canvas = document.getElementById("viewerCanvas");
const ctx = canvas.getContext("2d");
const rangeInputs = Array.from(document.querySelectorAll('input[type="range"]'));

let backbone = [];
let structureId = null;
let highlightRange = null;
let autoRotateLastTime = null;
let turntableAngle = 0;
let backboneBasis = createFallbackBasis();
const starfield = createStarfield(54);
let pointLightCache = [];
let segmentLightCache = [];
let lightAxisIndicator = { axis: null, until: 0 };
let autoRandomIntervalId = null;
let isLoadingStructure = false;
let noBackboneNotice = null;
let noBackboneTimeoutId = null;
let remoteProteinPool = null;
let remoteProteinPoolPromise = null;
let randomProteinQueue = [];
let randomProteinQueuePromise = null;
let recentRandomIds = [];
const renderConfig = {
  lightingEnabled: false,
  showLightSource: false,
  lightX: -0.6,
  lightY: 0.8,
  lightZ: 0.75,
  lightStrength: 8,
  ambient: 0.38,
  diffuse: 0.9,
  specular: 0.3,
  shininess: 28,
  backboneThickness: 2.4,
  atomSize: 3.2,
  proteinZoom: 1,
  chainShadeDifference: 1.35,
  showLegendOverlay: true,
  showStructureOverlay: false,
  showEntryOverlay: false,
  autoRandomProtein: false,
  backboneColor: { r: 74, g: 229, b: 96 },
  atomColor: { r: 252, g: 165, b: 3 },
  highlightColor: { r: 255, g: 216, b: 92 },
  labelColor: { r: 214, g: 255, b: 223 },
  bgTopColor: { r: 5, g: 8, b: 22 },
  bgBottomColor: { r: 2, g: 3, b: 10 }
};
const RANDOM_QUEUE_TARGET = 30;
const RANDOM_QUEUE_REFILL_THRESHOLD = 10;
const RANDOM_RECENT_HISTORY_LIMIT = 12;

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.classList.toggle("error", isError);
}

function setInfoContent(message) {
  infoContentEl.textContent = message;
}

function clearNoBackboneNotice() {
  if (noBackboneTimeoutId) {
    window.clearTimeout(noBackboneTimeoutId);
    noBackboneTimeoutId = null;
  }
  noBackboneNotice = null;
}

function createStarfield(count) {
  const stars = [];

  for (let i = 0; i < count; i += 1) {
    const bright = i < 8;
    stars.push({
      x: Math.random(),
      y: Math.random(),
      radius: bright ? 1 + Math.random() * 1.2 : 0.35 + Math.random() * 0.75,
      alpha: bright ? 0.55 + Math.random() * 0.25 : 0.08 + Math.random() * 0.18
    });
  }

  return stars;
}

function drawViewerBackground() {
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, toColorString(renderConfig.bgTopColor));
  gradient.addColorStop(0.55, toColorString(mixColor(renderConfig.bgTopColor, renderConfig.bgBottomColor, 0.35)));
  gradient.addColorStop(1, toColorString(renderConfig.bgBottomColor));
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (const star of starfield) {
    const x = star.x * canvas.width;
    const y = star.y * canvas.height;

    ctx.beginPath();
    ctx.fillStyle = `rgba(214, 245, 255, ${star.alpha})`;
    ctx.arc(x, y, star.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

function resizeCanvasToDisplaySize() {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(1, Math.round(rect.width * dpr));
  const height = Math.max(1, Math.round(rect.height * dpr));
  if (canvas.width === width && canvas.height === height) {
    return false;
  }

  canvas.width = width;
  canvas.height = height;
  return true;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function mixColor(start, end, t) {
  const amount = clamp(t, 0, 1);
  return {
    r: Math.round(start.r + (end.r - start.r) * amount),
    g: Math.round(start.g + (end.g - start.g) * amount),
    b: Math.round(start.b + (end.b - start.b) * amount)
  };
}

function toColorString(color) {
  return `rgb(${color.r}, ${color.g}, ${color.b})`;
}

function toRgbaString(color, alpha) {
  return `rgba(${color.r}, ${color.g}, ${color.b}, ${clamp(alpha, 0, 1)})`;
}

function adjustColor(color, factor) {
  return {
    r: Math.round(clamp(color.r * factor, 0, 255)),
    g: Math.round(clamp(color.g * factor, 0, 255)),
    b: Math.round(clamp(color.b * factor, 0, 255))
  };
}

function tintColor(color, amount) {
  return mixColor(color, { r: 255, g: 255, b: 255 }, clamp(amount, 0, 1));
}

function shadeColor(color, amount) {
  return mixColor(color, { r: 0, g: 0, b: 0 }, clamp(amount, 0, 1));
}

function getUniqueChains(points) {
  return Array.from(new Set(points.map((point) => point.chain)));
}

function buildChainColorMap(baseColor, chains, differenceScale = 1) {
  const variants = [
    { tint: 0, shade: 0 },
    { tint: 0.2, shade: 0 },
    { tint: 0, shade: 0.22 },
    { tint: 0.32, shade: 0.05 },
    { tint: 0.08, shade: 0.34 },
    { tint: 0.42, shade: 0.12 }
  ];
  const colorMap = new Map();

  chains.forEach((chain, index) => {
    const variant = variants[index % variants.length];
    let color = tintColor(baseColor, clamp(variant.tint * differenceScale, 0, 0.75));
    color = shadeColor(color, clamp(variant.shade * differenceScale, 0, 0.58));
    colorMap.set(chain, color);
  });

  return colorMap;
}

function drawChainLegend(chains, chainBackboneColors) {
  if (!chains.length) {
    return;
  }

  const padding = 10;
  const rowHeight = 18;
  const boxSize = 11;
  const title = "Chains";
  const textWidth = Math.max(
    ctx.measureText(title).width,
    ...chains.map((chain) => ctx.measureText(`Chain ${chain}`).width)
  );
  const legendWidth = Math.ceil(textWidth + boxSize + padding * 3);
  const legendHeight = padding * 2 + 16 + chains.length * rowHeight;
  const x = 14;
  const y = 14;

  ctx.save();
  ctx.fillStyle = "rgba(8, 12, 28, 0.74)";
  ctx.fillRect(x, y, legendWidth, legendHeight);
  ctx.strokeStyle = "rgba(190, 210, 255, 0.28)";
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, legendWidth - 1, legendHeight - 1);

  ctx.fillStyle = "rgba(228, 240, 255, 0.92)";
  ctx.font = "bold 12px Consolas";
  ctx.textAlign = "left";
  ctx.fillText(title, x + padding, y + padding + 9);

  ctx.font = "11px Consolas";
  chains.forEach((chain, index) => {
    const rowY = y + padding + 18 + index * rowHeight;
    ctx.fillStyle = toColorString(chainBackboneColors.get(chain));
    ctx.fillRect(x + padding, rowY, boxSize, boxSize);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.22)";
    ctx.strokeRect(x + padding + 0.5, rowY + 0.5, boxSize - 1, boxSize - 1);
    ctx.fillStyle = "rgba(228, 240, 255, 0.92)";
    ctx.fillText(`Chain ${chain}`, x + padding + boxSize + 8, rowY + 9);
  });
  ctx.restore();
}

function drawOverlayBox(title, lines, x, y, width) {
  const padding = 10;
  const titleHeight = 16;
  const lineHeight = 14;
  const visibleLines = lines.filter(Boolean);
  const height = padding * 2 + titleHeight + visibleLines.length * lineHeight;

  ctx.save();
  ctx.fillStyle = "rgba(8, 12, 28, 0.74)";
  ctx.fillRect(x, y, width, height);
  ctx.strokeStyle = "rgba(190, 210, 255, 0.28)";
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, width - 1, height - 1);
  ctx.fillStyle = "rgba(228, 240, 255, 0.92)";
  ctx.font = "bold 12px Consolas";
  ctx.textAlign = "left";
  ctx.fillText(title, x + padding, y + padding + 9);
  ctx.font = "11px Consolas";
  visibleLines.forEach((line, index) => {
    ctx.fillText(line, x + padding, y + padding + titleHeight + index * lineHeight + 9);
  });
  ctx.restore();
}

function splitOverlayText(text, maxLength = 52) {
  const tokens = (text || "").split(/\s+/).filter(Boolean);
  if (!tokens.length) {
    return [];
  }

  const lines = [];
  let current = "";
  for (const token of tokens) {
    if (!current || `${current} ${token}`.length <= maxLength) {
      current = current ? `${current} ${token}` : token;
    } else {
      lines.push(current);
      current = token;
    }
  }
  if (current) {
    lines.push(current);
  }
  return lines;
}

function hexToColor(hex) {
  const value = hex?.trim().replace("#", "");
  if (!value || !/^[0-9a-fA-F]{6}$/.test(value)) {
    return { r: 255, g: 255, b: 255 };
  }

  return {
    r: Number.parseInt(value.slice(0, 2), 16),
    g: Number.parseInt(value.slice(2, 4), 16),
    b: Number.parseInt(value.slice(4, 6), 16)
  };
}

function computeLightPosition() {
  const distanceScale = 220;
  return {
    x: renderConfig.lightX * distanceScale,
    y: renderConfig.lightY * distanceScale,
    z: renderConfig.lightZ * distanceScale
  };
}

function computeLightingTerms(surfacePoint, normal, viewDirection, lightPosition) {
  if (!renderConfig.lightingEnabled) {
    return { intensity: 1, rim: 0, lightDirection: { x: 0, y: 0, z: 1 } };
  }

  const toLight = subtract(lightPosition, surfacePoint);
  const distance = Math.max(length(toLight), EPSILON);
  const lightDirection = normalize(toLight, { x: 0, y: 0, z: 1 });
  // Softer falloff so one light can affect the whole protein volume.
  const attenuation = clamp(1 / (1 + 0.00008 * distance * distance), 0.22, 1);
  const diffuse = Math.max(0, dot(normal, lightDirection));
  const halfVector = normalize(addVectors(lightDirection, viewDirection), viewDirection);
  const specular = Math.pow(Math.max(0, dot(normal, halfVector)), renderConfig.shininess) * renderConfig.specular;
  const intensity = clamp(
    renderConfig.ambient + renderConfig.lightStrength * attenuation * (renderConfig.diffuse * diffuse + specular),
    0.2,
    2.2
  );
  const rim = Math.pow(1 - Math.max(0, dot(normal, viewDirection)), 2) * 0.22;

  return { intensity, rim, lightDirection };
}

function smoothLightingTerms(cache, index, target, alpha = 0.2) {
  const previous = cache[index];
  if (!previous) {
    cache[index] = { ...target };
    return cache[index];
  }

  const smoothed = {
    intensity: previous.intensity + (target.intensity - previous.intensity) * alpha,
    rim: previous.rim + (target.rim - previous.rim) * alpha,
    lightDirection: normalize(
      {
        x: previous.lightDirection.x + (target.lightDirection.x - previous.lightDirection.x) * alpha,
        y: previous.lightDirection.y + (target.lightDirection.y - previous.lightDirection.y) * alpha,
        z: previous.lightDirection.z + (target.lightDirection.z - previous.lightDirection.z) * alpha
      },
      target.lightDirection
    )
  };
  cache[index] = smoothed;
  return smoothed;
}

function shadeSurface(baseColor, lightingTerms) {
  const litColor = adjustColor(baseColor, lightingTerms.intensity);
  const edgeColor = mixColor(litColor, { r: 255, g: 255, b: 255 }, lightingTerms.rim);

  return { color: litColor, edgeColor };
}

function syncRenderConfigFromInputs() {
  renderConfig.lightingEnabled = lightingEnabledInput.checked;
  renderConfig.showLightSource = showLightSourceInput.checked;
  renderConfig.lightX = Number(lightXInput.value);
  renderConfig.lightY = Number(lightYInput.value);
  renderConfig.lightZ = Number(lightZInput.value);
  renderConfig.lightStrength = Number(lightStrengthInput.value);
  renderConfig.ambient = Number(ambientStrengthInput.value);
  renderConfig.diffuse = Number(diffuseStrengthInput.value);
  renderConfig.specular = Number(specularStrengthInput.value);
  renderConfig.shininess = Number(shininessInput.value);
  renderConfig.backboneThickness = Number(backboneThicknessInput.value);
  renderConfig.atomSize = Number(atomSizeInput.value);
  renderConfig.proteinZoom = Number(proteinZoomInput.value);
  renderConfig.chainShadeDifference = Number(chainShadeDifferenceInput.value);
  renderConfig.showLegendOverlay = showLegendOverlayInput.checked;
  renderConfig.showStructureOverlay = showStructureOverlayInput.checked;
  renderConfig.showEntryOverlay = showEntryOverlayInput.checked;
  renderConfig.autoRandomProtein = autoRandomProteinInput.checked;
  renderConfig.backboneColor = hexToColor(backboneColorInput.value);
  renderConfig.atomColor = hexToColor(atomColorInput.value);
  renderConfig.highlightColor = hexToColor(highlightColorInput.value);
  renderConfig.labelColor = hexToColor(labelColorInput.value);
  renderConfig.bgTopColor = hexToColor(bgTopColorInput.value);
  renderConfig.bgBottomColor = hexToColor(bgBottomColorInput.value);
}

function setActiveLightAxis(axis) {
  lightAxisIndicator = { axis, until: performance.now() + 900 };
}

function drawLightAxisArrow(lightPosition, axis, scale) {
  const axisVectors = {
    x: { x: 1, y: 0, z: 0 },
    y: { x: 0, y: 1, z: 0 },
    z: { x: 0, y: 0, z: 1 }
  };
  const axisColors = {
    x: "rgba(255, 90, 90, 0.95)",
    y: "rgba(88, 220, 120, 0.95)",
    z: "rgba(120, 170, 255, 0.95)"
  };
  const vector = axisVectors[axis];
  if (!vector) {
    return;
  }

  const start = projectPoint(lightPosition, scale);
  const endPoint = addVectors(lightPosition, scaleVector(vector, 70));
  const end = projectPoint(endPoint, scale);
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length2d = Math.hypot(dx, dy);
  if (length2d < 2) {
    return;
  }

  const ux = dx / length2d;
  const uy = dy / length2d;
  const head = 8;
  const wing = 5;
  const left = {
    x: end.x - ux * head - uy * wing,
    y: end.y - uy * head + ux * wing
  };
  const right = {
    x: end.x - ux * head + uy * wing,
    y: end.y - uy * head - ux * wing
  };
  const color = axisColors[axis];

  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.moveTo(start.x, start.y);
  ctx.lineTo(end.x, end.y);
  ctx.stroke();

  ctx.beginPath();
  ctx.fillStyle = color;
  ctx.moveTo(end.x, end.y);
  ctx.lineTo(left.x, left.y);
  ctx.lineTo(right.x, right.y);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = color;
  ctx.font = "11px Consolas";
  ctx.textAlign = "left";
  ctx.fillText(axis.toUpperCase(), end.x + 6, end.y - 4);
}

function getRangeDecimals(input) {
  const step = input.getAttribute("step") || "1";
  if (!step.includes(".")) {
    return 0;
  }

  return Math.min(3, step.split(".")[1].length);
}

function updateRangeValueLabel(input) {
  const label = document.querySelector(`label[for="${input.id}"]`);
  if (!label) {
    return;
  }

  label.classList.add("slider-label");
  const valueId = `${input.id}Value`;
  let valueEl = document.getElementById(valueId);
  if (!valueEl) {
    valueEl = document.createElement("span");
    valueEl.id = valueId;
    valueEl.className = "slider-value";
    label.appendChild(valueEl);
  }

  const decimals = getRangeDecimals(input);
  valueEl.textContent = Number(input.value).toFixed(decimals);
}

function initRangeValueLabels() {
  for (const input of rangeInputs) {
    updateRangeValueLabel(input);
  }
}

function setConfigPanelOpen(isOpen) {
  configPanel.classList.toggle("hidden", !isOpen);
  configToggleBtn.setAttribute("aria-expanded", String(isOpen));
  configToggleBtn.textContent = isOpen ? "HIDE LIGHT + COLOR" : "LIGHT + COLOR";
}

function updateFullscreenButton() {
  fullscreenBtn.textContent = document.fullscreenElement === viewerMainEl ? "EXIT FULLSCREEN" : "FULLSCREEN";
}

async function toggleFullscreen() {
  try {
    if (document.fullscreenElement === viewerMainEl) {
      await document.exitFullscreen();
      return;
    }

    await viewerMainEl.requestFullscreen();
  } catch {
    setStatus("Fullscreen mode is not available.", true);
  }
}

function toRadians(value) {
  return (Number(value) * Math.PI) / 180;
}

function dot(a, b) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function cross(a, b) {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x
  };
}

function length(vector) {
  return Math.hypot(vector.x, vector.y, vector.z);
}

function normalize(vector, fallback = { x: 0, y: 1, z: 0 }) {
  const magnitude = length(vector);
  if (magnitude < EPSILON) {
    return { ...fallback };
  }

  return {
    x: vector.x / magnitude,
    y: vector.y / magnitude,
    z: vector.z / magnitude
  };
}

function scaleVector(vector, scalar) {
  return {
    x: vector.x * scalar,
    y: vector.y * scalar,
    z: vector.z * scalar
  };
}

function addVectors(a, b) {
  return {
    x: a.x + b.x,
    y: a.y + b.y,
    z: a.z + b.z
  };
}

function subtract(a, b) {
  return {
    x: a.x - b.x,
    y: a.y - b.y,
    z: a.z - b.z
  };
}

function multiplyMatrixVector(matrix, vector) {
  return {
    x: matrix[0][0] * vector.x + matrix[0][1] * vector.y + matrix[0][2] * vector.z,
    y: matrix[1][0] * vector.x + matrix[1][1] * vector.y + matrix[1][2] * vector.z,
    z: matrix[2][0] * vector.x + matrix[2][1] * vector.y + matrix[2][2] * vector.z
  };
}

function outerProduct(vector) {
  return [
    [vector.x * vector.x, vector.x * vector.y, vector.x * vector.z],
    [vector.y * vector.x, vector.y * vector.y, vector.y * vector.z],
    [vector.z * vector.x, vector.z * vector.y, vector.z * vector.z]
  ];
}

function subtractMatrices(a, b) {
  return a.map((row, rowIndex) => row.map((value, columnIndex) => value - b[rowIndex][columnIndex]));
}

function powerIteration(matrix, seed) {
  let vector = normalize(seed, { x: 1, y: 0, z: 0 });

  for (let i = 0; i < 18; i += 1) {
    vector = normalize(multiplyMatrixVector(matrix, vector), vector);
  }

  return vector;
}

function createFallbackBasis() {
  return {
    right: { x: 1, y: 0, z: 0 },
    up: { x: 0, y: 1, z: 0 },
    forward: { x: 0, y: 0, z: 1 }
  };
}

function computeCovarianceMatrix(points) {
  const covariance = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0]
  ];

  for (const point of points) {
    covariance[0][0] += point.x * point.x;
    covariance[0][1] += point.x * point.y;
    covariance[0][2] += point.x * point.z;
    covariance[1][0] += point.y * point.x;
    covariance[1][1] += point.y * point.y;
    covariance[1][2] += point.y * point.z;
    covariance[2][0] += point.z * point.x;
    covariance[2][1] += point.z * point.y;
    covariance[2][2] += point.z * point.z;
  }

  return covariance;
}

function alignPointToBasis(point, basis) {
  return {
    x: dot(point, basis.right),
    y: dot(point, basis.up),
    z: dot(point, basis.forward)
  };
}

function computeBackboneBasis(points) {
  if (points.length < 3) {
    return createFallbackBasis();
  }

  const covariance = computeCovarianceMatrix(points);
  let up = powerIteration(covariance, subtract(points[points.length - 1], points[0]));

  const terminalDirection = normalize(subtract(points[points.length - 1], points[0]), up);
  if (dot(up, terminalDirection) < 0) {
    up = scaleVector(up, -1);
  }

  const eigenvalue = dot(up, multiplyMatrixVector(covariance, up));
  const deflated = subtractMatrices(covariance, outerProduct(scaleVector(up, Math.max(eigenvalue, 0))));
  let right = powerIteration(deflated, { x: 1, y: 0, z: 0 });
  right = normalize(subtract(right, scaleVector(up, dot(right, up))), { x: 1, y: 0, z: 0 });

  if (length(right) < EPSILON) {
    right = normalize(cross({ x: 0, y: 0, z: 1 }, up), { x: 1, y: 0, z: 0 });
  }

  let forward = normalize(cross(right, up), { x: 0, y: 0, z: 1 });
  right = normalize(cross(up, forward), right);

  return { right, up, forward };
}

function rotatePoint(point, xAngle, yAngle, zAngle) {
  const sinX = Math.sin(xAngle);
  const cosX = Math.cos(xAngle);
  const sinY = Math.sin(yAngle);
  const cosY = Math.cos(yAngle);
  const sinZ = Math.sin(zAngle);
  const cosZ = Math.cos(zAngle);

  let x = point.x;
  let y = point.y;
  let z = point.z;

  const y1 = y * cosX - z * sinX;
  const z1 = y * sinX + z * cosX;
  y = y1;
  z = z1;

  const x1 = x * cosY + z * sinY;
  const z2 = -x * sinY + z * cosY;
  x = x1;
  z = z2;

  const x2 = x * cosZ - y * sinZ;
  const y2 = x * sinZ + y * cosZ;

  return { x: x2, y: y2, z };
}

function projectPoint(point, scale) {
  const perspective = 500;
  const depth = perspective / (perspective - point.z);
  return {
    x: canvas.width / 2 + point.x * scale * depth,
    y: canvas.height / 2 - point.y * scale * depth,
    depth
  };
}

function normalizeBackbone(points) {
  const sums = points.reduce(
    (acc, point) => {
      acc.x += point.x;
      acc.y += point.y;
      acc.z += point.z;
      return acc;
    },
    { x: 0, y: 0, z: 0 }
  );
  const center = {
    x: sums.x / points.length,
    y: sums.y / points.length,
    z: sums.z / points.length
  };

  const centered = points.map((point, index) => ({
    ...point,
    index,
    x: point.x - center.x,
    y: point.y - center.y,
    z: point.z - center.z
  }));

  const maxDistance = centered.reduce((max, point) => Math.max(max, Math.hypot(point.x, point.y, point.z)), 1);

  return centered.map((point) => ({
    ...point,
    x: (point.x / maxDistance) * 150,
    y: (point.y / maxDistance) * 150,
    z: (point.z / maxDistance) * 150
  }));
}

function parsePdb(text) {
  const residues = new Map();

  for (const line of text.split(/\r?\n/)) {
    if (!line.startsWith("ATOM")) {
      continue;
    }

    const atomName = line.slice(12, 16).trim();
    if (atomName !== "CA") {
      continue;
    }

    const altLoc = line.slice(16, 17).trim();
    if (altLoc && altLoc !== "A") {
      continue;
    }

    const chain = line.slice(21, 22).trim() || "?";
    const residueName = line.slice(17, 20).trim();
    const residueNumber = line.slice(22, 26).trim();
    const insertionCode = line.slice(26, 27).trim();
    const x = Number(line.slice(30, 38).trim());
    const y = Number(line.slice(38, 46).trim());
    const z = Number(line.slice(46, 54).trim());

    if ([x, y, z].some(Number.isNaN)) {
      continue;
    }

    const key = `${chain}:${residueNumber}${insertionCode}`;
    if (!residues.has(key)) {
      residues.set(key, {
        residueName,
        residueNumber: `${residueNumber}${insertionCode}`.trim(),
        chain,
        x,
        y,
        z
      });
    }
  }

  return Array.from(residues.values());
}

async function fetchEntryMetadata(pdbId) {
  try {
    const response = await fetch(`https://data.rcsb.org/rest/v1/core/entry/${pdbId}`);
    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return {
      title: data?.struct?.title || "Untitled entry",
      method: data?.exptl?.[0]?.method || "Unknown",
      depositionDate: data?.rcsb_accession_info?.deposit_date || "Unknown"
    };
  } catch {
    return null;
  }
}

function getHighlightSet() {
  if (!highlightRange) {
    return new Set();
  }

  const start = Math.max(1, highlightRange.start);
  const end = Math.min(backbone.length, highlightRange.end);
  const highlighted = new Set();

  for (let i = start; i <= end; i += 1) {
    highlighted.add(i - 1);
  }

  return highlighted;
}

function drawIntro() {
  drawViewerBackground();
  ctx.fillStyle = "#7fffd4";
  ctx.font = "20px Consolas";
  ctx.textAlign = "center";
  ctx.fillText("Load a protein to render its alpha-carbon backbone", canvas.width / 2, canvas.height / 2);
  ctx.fillStyle = "#d8ecff";
  ctx.font = "12px Consolas";
  ctx.fillText("Retro starfield mode ready", canvas.width / 2, canvas.height / 2 + 28);
}

function drawNoBackboneNotice() {
  drawViewerBackground();

  const remainingMs = Math.max(0, noBackboneNotice.deadline - Date.now());
  const seconds = Math.ceil(remainingMs / 1000);

  ctx.save();
  ctx.fillStyle = "rgba(8, 12, 28, 0.78)";
  ctx.fillRect(canvas.width * 0.16, canvas.height * 0.34, canvas.width * 0.68, canvas.height * 0.22);
  ctx.strokeStyle = "rgba(252, 165, 3, 0.85)";
  ctx.lineWidth = 2;
  ctx.strokeRect(canvas.width * 0.16, canvas.height * 0.34, canvas.width * 0.68, canvas.height * 0.22);

  ctx.textAlign = "center";
  ctx.fillStyle = "#fca503";
  ctx.font = "bold 18px Consolas";
  ctx.fillText(
    `Structure ${noBackboneNotice.pdbId} does not contain a CA backbone`,
    canvas.width / 2,
    canvas.height * 0.44
  );
  ctx.fillStyle = "#d8ecff";
  ctx.font = "13px Consolas";
  ctx.fillText(
    `Loading a new random structure in ${seconds} s`,
    canvas.width / 2,
    canvas.height * 0.5
  );
  ctx.restore();
}

async function fetchRemoteProteinPool() {
  if (remoteProteinPool?.length) {
    return remoteProteinPool;
  }

  if (remoteProteinPoolPromise) {
    return remoteProteinPoolPromise;
  }

  remoteProteinPoolPromise = (async () => {
    const response = await fetch(RCSB_SEARCH_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        query: {
          type: "group",
          logical_operator: "and",
          nodes: [
            {
              type: "terminal",
              service: "text",
              parameters: {
                attribute: "rcsb_entry_info.polymer_entity_count_protein",
                operator: "greater",
                value: 0
              }
            },
            {
              type: "terminal",
              service: "text",
              parameters: {
                attribute: "rcsb_entry_info.structure_determination_methodology",
                operator: "exact_match",
                value: "experimental"
              }
            }
          ]
        },
        request_options: {
          return_all_hits: true,
          results_verbosity: "compact"
        },
        return_type: "entry"
      })
    });

    if (!response.ok) {
      throw new Error(`RCSB search responded ${response.status}`);
    }

    const data = await response.json();
    const ids = (data?.result_set || [])
      .map((item) => String(item.identifier || "").toUpperCase())
      .filter((id) => /^[A-Z0-9]{4}$/.test(id));

    if (!ids.length) {
      throw new Error("RCSB search returned no protein entries");
    }

    remoteProteinPool = ids;
    return remoteProteinPool;
  })();

  try {
    return await remoteProteinPoolPromise;
  } finally {
    remoteProteinPoolPromise = null;
  }
}

function pushRecentRandomId(id) {
  if (!id) {
    return;
  }

  recentRandomIds = [id, ...recentRandomIds.filter((value) => value !== id)].slice(0, RANDOM_RECENT_HISTORY_LIMIT);
}

function shuffleArray(values) {
  const copy = values.slice();
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

async function fillRandomProteinQueue(force = false) {
  if (!force && randomProteinQueue.length >= RANDOM_QUEUE_TARGET) {
    return randomProteinQueue;
  }

  if (randomProteinQueuePromise) {
    return randomProteinQueuePromise;
  }

  randomProteinQueuePromise = (async () => {
    const excluded = new Set([structureId, ...randomProteinQueue, ...recentRandomIds].filter(Boolean));

    try {
      const remotePool = await fetchRemoteProteinPool();
      const shuffled = shuffleArray(remotePool).filter((id) => !excluded.has(id));
      const needed = Math.max(0, RANDOM_QUEUE_TARGET - randomProteinQueue.length);
      randomProteinQueue = randomProteinQueue.concat(shuffled.slice(0, needed));
    } catch {
      const shuffledFallback = shuffleArray(SAMPLE_IDS).filter((id) => !excluded.has(id));
      const needed = Math.max(0, RANDOM_QUEUE_TARGET - randomProteinQueue.length);
      randomProteinQueue = randomProteinQueue.concat(shuffledFallback.slice(0, needed));
    }

    return randomProteinQueue;
  })();

  try {
    return await randomProteinQueuePromise;
  } finally {
    randomProteinQueuePromise = null;
  }
}

function maintainRandomProteinQueue() {
  if (randomProteinQueue.length <= RANDOM_QUEUE_REFILL_THRESHOLD) {
    void fillRandomProteinQueue();
  }
}

async function getRandomProteinId(excludedIds = []) {
  const excluded = new Set([structureId, ...excludedIds].filter(Boolean));

  if (!randomProteinQueue.length) {
    await fillRandomProteinQueue(true);
  }

  for (let index = 0; index < randomProteinQueue.length; index += 1) {
    const id = randomProteinQueue[index];
    if (!excluded.has(id)) {
      randomProteinQueue.splice(index, 1);
      pushRecentRandomId(id);
      maintainRandomProteinQueue();
      return id;
    }
  }

  await fillRandomProteinQueue(true);

  for (let index = 0; index < randomProteinQueue.length; index += 1) {
    const id = randomProteinQueue[index];
    if (!excluded.has(id)) {
      randomProteinQueue.splice(index, 1);
      pushRecentRandomId(id);
      maintainRandomProteinQueue();
      return id;
    }
  }

  const fallbackCandidates = SAMPLE_IDS.filter((id) => !excluded.has(id));
  const fallbackPool = fallbackCandidates.length ? fallbackCandidates : SAMPLE_IDS;
  const id = fallbackPool[Math.floor(Math.random() * fallbackPool.length)];
  pushRecentRandomId(id);
  return id;
}

function syncAutoRandomTimer() {
  if (autoRandomIntervalId) {
    window.clearInterval(autoRandomIntervalId);
    autoRandomIntervalId = null;
  }

  if (!renderConfig.autoRandomProtein) {
    return;
  }

  autoRandomIntervalId = window.setInterval(() => {
    if (isLoadingStructure) {
      return;
    }

    getRandomProteinId()
      .then((randomId) => {
        if (isLoadingStructure) {
          return;
        }
        pdbIdInput.value = randomId;
        setStatus(`Auto-random loading ${randomId}...`);
        loadStructure(randomId);
      })
      .catch(() => {});
  }, 15000);
}

function render() {
  resizeCanvasToDisplaySize();
  drawViewerBackground();

  if (!backbone.length) {
    if (noBackboneNotice) {
      drawNoBackboneNotice();
      return;
    }
    drawIntro();
    return;
  }

  const xAngle = toRadians(xRotInput.value);
  const yAngle = toRadians(yRotInput.value);
  const zAngle = toRadians(zRotInput.value);
  const scale = Number(scaleInput.value) * 1.5 * renderConfig.proteinZoom;
  const highlighted = getHighlightSet();

  const projected = backbone.map((point) => {
    const aligned = alignPointToBasis(point, backboneBasis);
    const onTurntable = rotatePoint(aligned, 0, turntableAngle, 0);
    const rotated = rotatePoint(onTurntable, xAngle, yAngle, zAngle);
    const screen = projectPoint(rotated, scale);
    return { ...point, rotated, screen };
  });

  const lightPosition = computeLightPosition();
  const chains = getUniqueChains(backbone);
  const chainBackboneColors = buildChainColorMap(
    renderConfig.backboneColor,
    chains,
    renderConfig.chainShadeDifference
  );
  const chainAtomColors = buildChainColorMap(renderConfig.atomColor, chains, renderConfig.chainShadeDifference);
  const pointSurface = projected.map((point, index) => {
    const previous = projected[Math.max(0, index - 2)].rotated;
    const next = projected[Math.min(projected.length - 1, index + 2)].rotated;
    const tangent = normalize(subtract(next, previous), { x: 0, y: 1, z: 0 });
    const viewDirection = normalize({ x: -point.rotated.x, y: -point.rotated.y, z: 420 - point.rotated.z }, { x: 0, y: 0, z: 1 });
    let normal = cross(tangent, viewDirection);
    if (length(normal) < EPSILON) {
      normal = cross(tangent, { x: 0, y: 1, z: 0 });
    }
    normal = normalize(normal, { x: 0, y: 0, z: 1 });
    if (dot(normal, viewDirection) < 0) {
      normal = scaleVector(normal, -1);
    }

    return { normal, viewDirection, position: point.rotated };
  });
  const pointLighting = pointSurface.map((surface, index) => {
    const rawTerms = computeLightingTerms(surface.position, surface.normal, surface.viewDirection, lightPosition);
    return smoothLightingTerms(pointLightCache, index, rawTerms, 0.16);
  });
  pointLightCache.length = pointSurface.length;

  for (let i = 1; i < projected.length; i += 1) {
    const prev = projected[i - 1];
    const curr = projected[i];
    if (prev.chain !== curr.chain) {
      continue;
    }
    const segmentHighlighted = highlighted.has(i - 1) || highlighted.has(i);
    const prevSurface = pointSurface[i - 1];
    const currSurface = pointSurface[i];
    const segmentNormal = normalize(addVectors(prevSurface.normal, currSurface.normal), prevSurface.normal);
    const segmentViewDirection = normalize(
      addVectors(prevSurface.viewDirection, currSurface.viewDirection),
      prevSurface.viewDirection
    );
    const segmentPosition = {
      x: (prevSurface.position.x + currSurface.position.x) * 0.5,
      y: (prevSurface.position.y + currSurface.position.y) * 0.5,
      z: (prevSurface.position.z + currSurface.position.z) * 0.5
    };
    const segmentBase = segmentHighlighted ? renderConfig.highlightColor : chainBackboneColors.get(curr.chain);
    const startShade = shadeSurface(segmentBase, pointLighting[i - 1]);
    const endShade = shadeSurface(segmentBase, pointLighting[i]);
    const segmentTerms = computeLightingTerms(segmentPosition, segmentNormal, segmentViewDirection, lightPosition);
    const smoothSegmentTerms = smoothLightingTerms(segmentLightCache, i - 1, segmentTerms, 0.14);
    const segmentShade = shadeSurface(segmentBase, smoothSegmentTerms);
    const segmentGradient = ctx.createLinearGradient(prev.screen.x, prev.screen.y, curr.screen.x, curr.screen.y);
    segmentGradient.addColorStop(0, toColorString(startShade.color));
    segmentGradient.addColorStop(0.5, toColorString(segmentShade.color));
    segmentGradient.addColorStop(1, toColorString(endShade.color));
    const thickness = renderConfig.backboneThickness;

    if (renderConfig.lightingEnabled) {
      ctx.beginPath();
      ctx.strokeStyle = toRgbaString(adjustColor(segmentShade.color, 0.55), 0.68);
      ctx.lineWidth = thickness + 1.25;
      ctx.moveTo(prev.screen.x, prev.screen.y);
      ctx.lineTo(curr.screen.x, curr.screen.y);
      ctx.stroke();

      ctx.beginPath();
      ctx.strokeStyle = segmentGradient;
      ctx.lineWidth = thickness;
      ctx.moveTo(prev.screen.x, prev.screen.y);
      ctx.lineTo(curr.screen.x, curr.screen.y);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.strokeStyle = toColorString(segmentBase);
      ctx.lineWidth = thickness;
      ctx.moveTo(prev.screen.x, prev.screen.y);
      ctx.lineTo(curr.screen.x, curr.screen.y);
      ctx.stroke();
    }
  }
  segmentLightCache.length = Math.max(0, projected.length - 1);

  projected
    .slice()
    .sort((a, b) => a.rotated.z - b.rotated.z)
    .forEach((point) => {
      const highlightedPoint = highlighted.has(point.index);
      const baseColor = highlightedPoint ? renderConfig.highlightColor : chainAtomColors.get(point.chain);
      const shaded = shadeSurface(baseColor, pointLighting[point.index]);
      const radius = renderConfig.atomSize * (highlightedPoint ? 1.25 : 1);

      ctx.beginPath();
      if (renderConfig.lightingEnabled) {
        const pointLightDirection = pointLighting[point.index].lightDirection;
        const lx = point.screen.x + pointLightDirection.x * radius * 0.5;
        const ly = point.screen.y - pointLightDirection.y * radius * 0.5;
        const atomGradient = ctx.createRadialGradient(lx, ly, radius * 0.16, point.screen.x, point.screen.y, radius);
        atomGradient.addColorStop(0, toColorString(mixColor(shaded.edgeColor, { r: 255, g: 255, b: 255 }, 0.35)));
        atomGradient.addColorStop(0.42, toColorString(shaded.edgeColor));
        atomGradient.addColorStop(1, toColorString(adjustColor(shaded.color, 0.48)));
        ctx.fillStyle = atomGradient;
      } else {
        ctx.fillStyle = toColorString(baseColor);
      }
      ctx.arc(point.screen.x, point.screen.y, radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.strokeStyle = toRgbaString(adjustColor(shaded.color, 0.5), 0.85);
      ctx.lineWidth = 1;
      ctx.arc(point.screen.x, point.screen.y, radius, 0, Math.PI * 2);
      ctx.stroke();

      if (highlightedPoint) {
        ctx.beginPath();
        ctx.strokeStyle = toColorString(mixColor(renderConfig.highlightColor, { r: 255, g: 255, b: 255 }, 0.5));
        ctx.arc(point.screen.x, point.screen.y, radius + 0.8, 0, Math.PI * 2);
        ctx.stroke();
      }

      if (showNumbersInput.checked) {
        ctx.fillStyle = toColorString(renderConfig.labelColor);
        ctx.font = "12px Consolas";
        ctx.textAlign = "left";
        ctx.fillText(String(point.index + 1), point.screen.x + 8, point.screen.y - 8);
      }
    });

  const showAxisArrow = Boolean(lightAxisIndicator.axis) && performance.now() < lightAxisIndicator.until;
  if (renderConfig.showLightSource || showAxisArrow) {
    const lightScreen = projectPoint(lightPosition, scale);
    const orbRadius = 5;
    const orbGradient = ctx.createRadialGradient(
      lightScreen.x - 1.5,
      lightScreen.y - 1.5,
      1,
      lightScreen.x,
      lightScreen.y,
      orbRadius
    );
    orbGradient.addColorStop(0, "rgba(255, 208, 208, 1)");
    orbGradient.addColorStop(0.45, "rgba(255, 74, 74, 0.96)");
    orbGradient.addColorStop(1, "rgba(160, 0, 0, 0.86)");

    ctx.beginPath();
    ctx.fillStyle = orbGradient;
    ctx.arc(lightScreen.x, lightScreen.y, orbRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.strokeStyle = "rgba(255, 120, 120, 0.95)";
    ctx.lineWidth = 1;
    ctx.arc(lightScreen.x, lightScreen.y, orbRadius + 1.4, 0, Math.PI * 2);
    ctx.stroke();
  }

  if (showAxisArrow) {
    drawLightAxisArrow(lightPosition, lightAxisIndicator.axis, scale);
  }

  if (renderConfig.showLegendOverlay) {
    drawChainLegend(chains, chainBackboneColors);
  }

  if (renderConfig.showStructureOverlay && backbone.length) {
    const structureLines = splitOverlayText(metaEl.textContent, 48);
    const structureHeight = 20 + structureLines.length * 14 + 20;
    drawOverlayBox(
      "Structure",
      structureLines,
      14,
      Math.max(14, canvas.height - structureHeight - 14),
      330
    );
  }

  if (renderConfig.showEntryOverlay && infoContentEl.textContent) {
    const entryLines = splitOverlayText(infoContentEl.textContent, 54);
    const entryHeight = 20 + entryLines.length * 14 + 20;
    drawOverlayBox(
      "Entry Information",
      entryLines,
      Math.max(14, canvas.width - 374),
      Math.max(14, canvas.height - entryHeight - 14),
      360
    );
  }
}

function updateMeta() {
  if (!backbone.length) {
    metaEl.textContent = "No structure loaded.";
    return;
  }

  const first = backbone[0];
  const last = backbone[backbone.length - 1];
  metaEl.textContent =
    `${structureId}: ${backbone.length} alpha-carbons | start ${first.residueName} ${first.residueNumber} (${first.chain})` +
    ` | end ${last.residueName} ${last.residueNumber} (${last.chain})`;
}

function applyHighlightRange() {
  const start = Number.parseInt(highlightStartInput.value, 10);
  const end = Number.parseInt(highlightEndInput.value, 10);

  if (!backbone.length) {
    setStatus("Load a protein before highlighting a range.", true);
    return;
  }

  if (Number.isNaN(start) || Number.isNaN(end)) {
    setStatus("Enter both a start and end carbon index.", true);
    return;
  }

  if (start < 1 || end < start || end > backbone.length) {
    setStatus(`Range must be between 1 and ${backbone.length}, with start <= end.`, true);
    return;
  }

  highlightRange = { start, end };
  setStatus(`Highlighted alpha-carbons ${start} to ${end}.`);
  render();
}

function clearHighlightRange() {
  highlightRange = null;
  highlightStartInput.value = "";
  highlightEndInput.value = "";
  setStatus("Highlight cleared.");
  render();
}

async function loadStructure(id) {
  const normalizedId = id.trim().toUpperCase();
  if (!/^[A-Z0-9]{4}$/.test(normalizedId)) {
    setStatus("Enter a valid 4-character PDB ID.", true);
    return;
  }

  isLoadingStructure = true;
  clearNoBackboneNotice();
  setStatus(`Loading ${normalizedId}...`);
  setInfoContent("Fetching structure + entry metadata...");

  try {
    const response = await fetch(`${PDB_ENDPOINT}${normalizedId}.pdb`);
    if (!response.ok) {
      throw new Error(`RCSB returned ${response.status}`);
    }

    const text = await response.text();
    const parsed = parsePdb(text);
    if (!parsed.length) {
      throw new Error("__NO_CA_BACKBONE__");
    }

    structureId = normalizedId;
    backbone = normalizeBackbone(parsed);
    backboneBasis = computeBackboneBasis(backbone);
    turntableAngle = 0;
    pointLightCache = [];
    segmentLightCache = [];
    highlightRange = null;
    highlightStartInput.value = "";
    highlightEndInput.value = "";
    updateMeta();
    const entryMetadata = await fetchEntryMetadata(normalizedId);
    if (entryMetadata) {
      setInfoContent(
        `${entryMetadata.title} | Method: ${entryMetadata.method} | Deposited: ${entryMetadata.depositionDate}`
      );
    } else {
      setInfoContent(`Entry ${normalizedId} loaded (metadata unavailable).`);
    }
    setStatus(`Loaded ${normalizedId} with ${backbone.length} alpha-carbons.`);
    maintainRandomProteinQueue();
    render();
  } catch (error) {
    structureId = null;
    backbone = [];
    backboneBasis = createFallbackBasis();
    turntableAngle = 0;
    pointLightCache = [];
    segmentLightCache = [];
    updateMeta();
    setInfoContent("No entry metadata loaded.");
    if (error.message === "__NO_CA_BACKBONE__") {
      noBackboneNotice = {
        pdbId: normalizedId,
        deadline: Date.now() + 5000
      };
      noBackboneTimeoutId = window.setTimeout(() => {
        noBackboneTimeoutId = null;
        getRandomProteinId([normalizedId])
          .then((randomId) => {
            pdbIdInput.value = randomId;
            loadStructure(randomId);
          })
          .catch(() => {});
      }, 5000);
      setStatus(`Structure ${normalizedId} does not contain a CA backbone. Loading a random structure in 5 s.`, true);
      render();
    } else {
      drawIntro();
      setStatus(`Failed to load ${normalizedId}: ${error.message}.`, true);
    }
  } finally {
    isLoadingStructure = false;
    maintainRandomProteinQueue();
    syncAutoRandomTimer();
  }
}

function stepAutoRotate(timestamp) {
  if (noBackboneNotice && !backbone.length) {
    render();
  }
  if (autoRotateInput.checked && backbone.length) {
    const previous = autoRotateLastTime ?? timestamp;
    const deltaSeconds = (timestamp - previous) / 1000;
    autoRotateLastTime = timestamp;
    turntableAngle += toRadians(Number(turntableSpeedInput.value) * deltaSeconds);
    render();
  } else {
    autoRotateLastTime = null;
  }

  window.requestAnimationFrame(stepAutoRotate);
}

loadBtn.addEventListener("click", () => {
  loadStructure(pdbIdInput.value);
});

randomBtn.addEventListener("click", () => {
  getRandomProteinId()
    .then((randomId) => {
      pdbIdInput.value = randomId;
      loadStructure(randomId);
    })
    .catch(() => {
      setStatus("Could not fetch a random protein ID.", true);
    });
});

pdbIdInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    loadStructure(pdbIdInput.value);
  }
});

[xRotInput, yRotInput, zRotInput, scaleInput, turntableSpeedInput, showNumbersInput].forEach((input) => {
  input.addEventListener("input", render);
});

const configInputs = [
  lightingEnabledInput,
  showLightSourceInput,
  lightXInput,
  lightYInput,
  lightZInput,
  lightStrengthInput,
  ambientStrengthInput,
  diffuseStrengthInput,
  specularStrengthInput,
  shininessInput,
  backboneThicknessInput,
  atomSizeInput,
  proteinZoomInput,
  chainShadeDifferenceInput,
  showLegendOverlayInput,
  showStructureOverlayInput,
  showEntryOverlayInput,
  autoRandomProteinInput,
  backboneColorInput,
  atomColorInput,
  highlightColorInput,
  labelColorInput,
  bgTopColorInput,
  bgBottomColorInput
];

configInputs.forEach((input) => {
  const onChange = () => {
    syncRenderConfigFromInputs();
    syncAutoRandomTimer();
    if (
      input === lightingEnabledInput ||
      input === lightXInput ||
      input === lightYInput ||
      input === lightZInput
    ) {
      pointLightCache = [];
      segmentLightCache = [];
    }
    render();
  };

  input.addEventListener("input", onChange);
  input.addEventListener("change", onChange);
});

rangeInputs.forEach((input) => {
  const updateValue = () => updateRangeValueLabel(input);
  input.addEventListener("input", updateValue);
  input.addEventListener("change", updateValue);
});

lightXInput.addEventListener("input", () => setActiveLightAxis("x"));
lightYInput.addEventListener("input", () => setActiveLightAxis("y"));
lightZInput.addEventListener("input", () => setActiveLightAxis("z"));

configToggleBtn.addEventListener("click", () => {
  const isOpen = configPanel.classList.contains("hidden");
  setConfigPanelOpen(isOpen);
  if (resizeCanvasToDisplaySize()) {
    render();
  }
});

fullscreenBtn.addEventListener("click", toggleFullscreen);

document.addEventListener("fullscreenchange", () => {
  updateFullscreenButton();
  resizeCanvasToDisplaySize();
  render();
});

window.addEventListener("resize", () => {
  if (resizeCanvasToDisplaySize()) {
    render();
  }
});

autoRotateInput.addEventListener("change", () => {
  if (!autoRotateInput.checked) {
    autoRotateLastTime = null;
  }
});

applyRangeBtn.addEventListener("click", applyHighlightRange);
clearRangeBtn.addEventListener("click", clearHighlightRange);

syncRenderConfigFromInputs();
syncAutoRandomTimer();
initRangeValueLabels();
setConfigPanelOpen(false);
updateFullscreenButton();
resizeCanvasToDisplaySize();
drawIntro();
setInfoContent("No entry metadata loaded.");
void fillRandomProteinQueue(true);
window.requestAnimationFrame(stepAutoRotate);
