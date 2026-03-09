const canvas = document.getElementById("viewerCanvas");
const ctx = canvas.getContext("2d");
const pdbInput = document.getElementById("pdbId");
const loadBtn = document.getElementById("loadBtn");
const randomBtn = document.getElementById("randomBtn");
const statusEl = document.getElementById("status");
const metaEl = document.getElementById("meta");
const xRotInput = document.getElementById("xRot");
const yRotInput = document.getElementById("yRot");
const scaleInput = document.getElementById("scale");

const randomPool = [
  "1CRN",
  "4HHB",
  "1UBQ",
  "2MNR",
  "3NIR",
  "1BNA",
  "1A3N",
  "2PTC",
  "5XNL",
  "6VXX"
];

let currentPoints = [];
let currentLabel = "";

function setStatus(message) {
  statusEl.textContent = message;
}

function setMeta(message) {
  metaEl.textContent = message;
}

function parseAlphaCarbons(pdbText) {
  const lines = pdbText.split("\n");
  const points = [];

  for (const line of lines) {
    if (!line.startsWith("ATOM")) continue;
    const atomName = line.slice(12, 16).trim();
    if (atomName !== "CA") continue;

    const x = Number.parseFloat(line.slice(30, 38));
    const y = Number.parseFloat(line.slice(38, 46));
    const z = Number.parseFloat(line.slice(46, 54));

    if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)) {
      points.push({ x, y, z });
    }
  }

  return points;
}

function rotatePoint(point, rotXDeg, rotYDeg) {
  const rx = (rotXDeg * Math.PI) / 180;
  const ry = (rotYDeg * Math.PI) / 180;

  const cosX = Math.cos(rx);
  const sinX = Math.sin(rx);
  const cosY = Math.cos(ry);
  const sinY = Math.sin(ry);

  const y1 = point.y * cosX - point.z * sinX;
  const z1 = point.y * sinX + point.z * cosX;

  const x2 = point.x * cosY + z1 * sinY;
  const z2 = -point.x * sinY + z1 * cosY;

  return { x: x2, y: y1, z: z2 };
}

function drawBackbone(points, label) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (!points.length) {
    setStatus("No alpha-carbon atoms found.");
    return;
  }

  const rotX = Number.parseFloat(xRotInput.value);
  const rotY = Number.parseFloat(yRotInput.value);
  const scaleFactor = Number.parseFloat(scaleInput.value);
  const transformed = points.map((p) => rotatePoint(p, rotX, rotY));

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const p of transformed) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }

  const spanX = Math.max(1, maxX - minX);
  const spanY = Math.max(1, maxY - minY);
  const padding = 50;
  const fitScale =
    Math.min((canvas.width - padding * 2) / spanX, (canvas.height - padding * 2) / spanY) *
    (scaleFactor / 5);

  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  const projected = transformed.map((p) => ({
    x: (p.x - centerX) * fitScale + canvas.width / 2,
    y: (p.y - centerY) * -fitScale + canvas.height / 2,
    z: p.z
  }));

  projected.sort((a, b) => a.z - b.z);

  ctx.lineWidth = 2;
  ctx.strokeStyle = "#00ff66";
  ctx.shadowColor = "#00ffcc";
  ctx.shadowBlur = 8;

  ctx.beginPath();
  ctx.moveTo(projected[0].x, projected[0].y);
  for (let i = 1; i < projected.length; i += 1) {
    ctx.lineTo(projected[i].x, projected[i].y);
  }
  ctx.stroke();

  ctx.shadowBlur = 0;
  ctx.fillStyle = "#ff00aa";
  for (let i = 0; i < projected.length; i += 12) {
    ctx.beginPath();
    ctx.arc(projected[i].x, projected[i].y, 2.6, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = "#ffffff";
  ctx.font = 'bold 16px "Courier New", monospace';
  ctx.fillText(`${label} | Cα atoms: ${projected.length}`, 14, 24);

  setStatus(
    `Loaded ${label}. Parsed ${projected.length} alpha-carbon coordinates from ATOM records.`
  );
}

async function fetchEntryMetadata(pdbId) {
  try {
    const response = await fetch(`https://data.rcsb.org/rest/v1/core/entry/${pdbId}`);
    if (!response.ok) return null;
    const data = await response.json();
    return {
      title: data?.struct?.title || "Untitled entry",
      depositionDate: data?.rcsb_accession_info?.deposit_date || "Unknown",
      method: data?.exptl?.[0]?.method || "Unknown"
    };
  } catch {
    return null;
  }
}

async function loadProtein(rawId) {
  const pdbId = rawId.trim().toUpperCase();
  if (!/^[A-Z0-9]{4}$/.test(pdbId)) {
    setStatus("Invalid PDB ID. Use exactly 4 letters/numbers.");
    return;
  }

  setStatus(`Loading ${pdbId} from wwPDB...`);
  setMeta("Fetching structure + entry metadata...");

  try {
    const pdbResponse = await fetch(`https://files.rcsb.org/download/${pdbId}.pdb`);
    if (!pdbResponse.ok) {
      throw new Error(`wwPDB responded ${pdbResponse.status}`);
    }
    const pdbText = await pdbResponse.text();
    const points = parseAlphaCarbons(pdbText);

    if (!points.length) {
      throw new Error("No alpha-carbons found in this file.");
    }

    currentPoints = points;
    currentLabel = pdbId;
    drawBackbone(currentPoints, currentLabel);

    const meta = await fetchEntryMetadata(pdbId);
    if (meta) {
      setMeta(`${meta.title} | Method: ${meta.method} | Deposited: ${meta.depositionDate}`);
    } else {
      setMeta(`Entry ${pdbId} loaded (metadata unavailable).`);
    }
  } catch (error) {
    setStatus(`Failed to load ${pdbId}: ${error.message}`);
    setMeta("No structure loaded.");
  }
}

loadBtn.addEventListener("click", () => {
  loadProtein(pdbInput.value);
});

pdbInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    loadProtein(pdbInput.value);
  }
});

randomBtn.addEventListener("click", () => {
  const pdbId = randomPool[Math.floor(Math.random() * randomPool.length)];
  pdbInput.value = pdbId;
  loadProtein(pdbId);
});

[xRotInput, yRotInput, scaleInput].forEach((input) => {
  input.addEventListener("input", () => {
    if (currentPoints.length) {
      drawBackbone(currentPoints, currentLabel);
    }
  });
});

function drawIntro() {
  ctx.fillStyle = "#050515";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#00ff66";
  ctx.font = 'bold 22px "Courier New", monospace';
  ctx.fillText("RETRO PROTEIN BACKBONE VIEWER", 130, 220);
  ctx.font = '16px "Courier New", monospace';
  ctx.fillText("Load a PDB ID or click RANDOM PROTEIN to begin.", 150, 260);
}

drawIntro();
