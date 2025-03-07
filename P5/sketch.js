'use strict'

// Variables globales
let color, depth, escorzo = true;
let is_simulating = false;
let intervalId;
let fallback = [], points = [];
let record;
let nextToAdd = { count: 100, seed: 44 };
let cachedVectors;
let recordButton, generateButton;

const x_size = 800;
const y_size = 600;

// Variables para renderizado optimizado
let instancedRenderer;
let staticBuffersNeedUpdate = true;

function preload() {
  loadJSON('cloud_500.json', json => fallback = json.map(entry => ({
    worldPosition: createVector(entry.x, entry.y, entry.z),
    color: Array.isArray(entry.color) ? entry.color : [1, 0.75, 0.8, 1] // Color por defecto rosado
  }))
  )
}

function setup() {
  frameRate(1000);
  const canvas = createCanvas(x_size, y_size, WEBGL);
  colorMode(RGB, 1);
  document.oncontextmenu = () => false;

  cachedVectors = {
    direction: createVector(),
    defaultForward: createVector(0, 0, 1),
    rotationAxis: createVector()
  };

  points = fallback.map(pt => {
    pt.rotation = getLookAtRotation(pt.worldPosition);
    return pt;
  });

  performanceMonitor = new PerformanceMonitor();

  const o = parsePosition([0, 0, 0], { from: Tree.WORLD, to: Tree.SCREEN });

  depth = createSlider(0.01, 0.99, 0.5, 0.01);
  depth.position(10, 10);
  depth.style('width', '580px');

  color = createColorPicker('#FFC0CB');
  color.position(width - 70, 40);

  // Botón para toggle recording
  recordButton = createButton('Draw');
  recordButton.position(10, 40);
  recordButton.style('padding', '5px 10px');
  recordButton.style('background-color', '#333');
  recordButton.style('color', 'white');
  recordButton.style('border', 'none');
  recordButton.style('border-radius', '4px');
  recordButton.style('cursor', 'pointer');
  recordButton.mousePressed(() => {
    record = !record;
    recordButton.style('background-color', record ? '#cc0000' : '#333');
    recordButton.html(record ? 'Drawing (Click: Stop)' : 'Draw');
  });

  // Botón para generar puntos aleatorios
  generateButton = createButton('Gen. Random Pts');
  generateButton.position(10, 70);
  generateButton.style('padding', '5px 10px');
  generateButton.style('background-color', '#333');
  generateButton.style('color', 'white');
  generateButton.style('border', 'none');
  generateButton.style('border-radius', '4px');
  generateButton.style('cursor', 'pointer');
  generateButton.mousePressed(() => {
    generatePseudoRandomPoints(nextToAdd, 44);
  });
  instancedRenderer = new InstancedRenderer();
}

function draw() {
  // Performance tracking
  performanceMonitor.update(points.length);

  // If is simulating addRandom points eveery 2 seconds

  // Controles de órbita solo si el ratón está por debajo de la interfaz
  (mouseY >= 30) && orbitControl();

  if (record) {
    update();
    staticBuffersNeedUpdate = true;
  }

  background('#000000');
  axes({ size: 50, bits: Tree.X | Tree.Y | Tree.Z | Tree._X | Tree._Y | Tree._Z });

  instancedRenderer.render(points, staticBuffersNeedUpdate);
  staticBuffersNeedUpdate = false;
}

class InstancedRenderer {
  constructor() {
    this.gl = drawingContext;
    this.ellipseVertices = this.createEllipseGeometry();
    this.pointCount = 0;
    this.maxInstances = 1000000; // Máximo número de instancias

    // Buffers para almacenar posiciones y colores
    this.positionBuffer = new Float32Array(this.maxInstances * 3);
    this.colorBuffer = new Float32Array(this.maxInstances * 4);
    this.rotationBuffer = new Float32Array(this.maxInstances * 4); // Almacena el eje (xyz) y el ángulo (w)
  }

  createEllipseGeometry() {
    const vertices = [];
    const resolution = 0;
    for (let i = 0; i < resolution; i++) {
      const angle = (i / resolution) * TWO_PI;
      const x = cos(angle);
      const y = sin(angle) * 0.5; // Para hacer una elipse 2:1
      vertices.push(x, y, 0);
    }
    return vertices;
  }

  updateBuffers(points) {
    this.pointCount = Math.min(points.length, this.maxInstances);

    for (let i = 0; i < this.pointCount; i++) {
      const point = points[i];

      // Posición
      this.positionBuffer[i * 3] = point.worldPosition.x;
      this.positionBuffer[i * 3 + 1] = point.worldPosition.y;
      this.positionBuffer[i * 3 + 2] = point.worldPosition.z;

      // Color
      const col = point.color;
      this.colorBuffer[i * 4] = Array.isArray(col) ? col[0] : red(col);
      this.colorBuffer[i * 4 + 1] = Array.isArray(col) ? col[1] : green(col);
      this.colorBuffer[i * 4 + 2] = Array.isArray(col) ? col[2] : blue(col);
      this.colorBuffer[i * 4 + 3] = Array.isArray(col) ? col[3] : alpha(col);

      // Rotación (eje y ángulo)
      if (point.rotation) {
        this.rotationBuffer[i * 4] = point.rotation.axis.x;
        this.rotationBuffer[i * 4 + 1] = point.rotation.axis.y;
        this.rotationBuffer[i * 4 + 2] = point.rotation.axis.z;
        this.rotationBuffer[i * 4 + 3] = point.rotation.angle;
      }
    }
  }

  render(points, forceUpdate = false) {
    if (forceUpdate || this.pointCount !== points.length) {
      this.updateBuffers(points);
    }

    // Si no hay puntos, no hay nada que renderizar
    if (this.pointCount === 0) return;

    // Guardar el estado actual del renderer
    push();

    beginShape(TRIANGLE_FAN);
    noStroke();

    for (let i = 0; i < this.pointCount; i++) {
      // Aplicar posición y rotación para cada instancia
      push();
      translate(
        this.positionBuffer[i * 3],
        this.positionBuffer[i * 3 + 1],
        this.positionBuffer[i * 3 + 2]
      );

      // Aplicar rotación usando un vector temporal
      const rotX = this.rotationBuffer[i * 4];
      const rotY = this.rotationBuffer[i * 4 + 1];
      const rotZ = this.rotationBuffer[i * 4 + 2];
      const rotAngle = this.rotationBuffer[i * 4 + 3];

      if (p5.Vector) {
        const rotVector = new p5.Vector(rotX, rotY, rotZ);
        rotate(rotAngle, rotVector);
      } else {
        rotate(rotAngle, [rotX, rotY, rotZ]);
      }

      // Aplicar color
      fill(
        this.colorBuffer[i * 4],
        this.colorBuffer[i * 4 + 1],
        this.colorBuffer[i * 4 + 2],
        this.colorBuffer[i * 4 + 3]
      );

      ellipse(0, 0, 2, 1, 8);

      pop();
    }

    endShape();

    pop();
  }
}

function update() {
  const pos = parsePosition([mouseX, mouseY, depth.value()], { from: Tree.SCREEN, to: Tree.WORLD });
  points.push({
    worldPosition: pos,
    color: color.color(),
    rotation: getLookAtRotation(pos)
  });
  staticBuffersNeedUpdate = true;
}

function getLookAtRotation(pointPosition) {
  const camPos = parsePosition(Tree.ORIGIN, { from: Tree.EYE, to: Tree.WORLD });

  const direction = p5.Vector.sub(camPos, pointPosition, cachedVectors.direction).normalize();
  const defaultForward = cachedVectors.defaultForward;

  let rotationAxis = p5.Vector.cross(defaultForward, direction, cachedVectors.rotationAxis);
  if (rotationAxis.magSq() < 0.00001) {
    rotationAxis.set(1, 0, 0);
  } else {
    rotationAxis.normalize();
  }

  const rotationAngle = Math.acos(p5.Vector.dot(defaultForward, direction));

  return {
    angle: rotationAngle,
    axis: rotationAxis.copy() // Necesario para evitar referencias compartidas
  };
}

function keyPressed() {
  switch (key) {
    case 'c':
      points = [];
      staticBuffersNeedUpdate = true;
      break;
    case 'f':
      focus();
      break;
    case 'l':
      points = [...fallback];
      staticBuffersNeedUpdate = true;
      break;
    case 'p':
      escorzo = !escorzo;
      escorzo ? perspective() : ortho();
      break;
    case 'r':
      record = !record;
      recordButton.style('background-color', record ? '#cc0000' : '#333');
      recordButton.html(record ? 'Drawing (Click: Stop)' : 'Draw');
      break;
    case 's':
      saveCloud();
      break;
    case 'k':
      generatePseudoRandomPoints(nextToAdd, 44); break;
    case 'z':
      if (is_simulating) {
        stopSimulation();
      } else {
        startSimulation();
      }
      break;
  }
}

function startSimulation() {
  is_simulating = true;
  intervalId = setInterval(generatePseudoRandomPoints, 2000, nextToAdd, 44);
}

function stopSimulation() {
  is_simulating = false;
  clearInterval(intervalId);
}

function saveCloud() {
  const data = points.map(point => {
    const color = point.color;
    const colorArray = Array.isArray(color)
      ? color
      : [red(color), green(color), blue(color), alpha(color)];

    return {
      x: point.worldPosition.x,
      y: point.worldPosition.y,
      z: point.worldPosition.z,
      color: colorArray
    }
  });

  saveJSON(data, 'custom_cloud.json');
}

class PerformanceMonitor {
  constructor() {
    this.startTime = 0;
    this.frameCount = 0;
    this.fps = 0;
    this.maxPoints = 0;
    this.displayDiv = null;
    this.setupDisplay();
  }

  setupDisplay() {
    this.displayDiv = createDiv('');
    this.displayDiv.position(width, 0);
    this.displayDiv.style('background-color', 'rgba(0,0,0,0.8)');
    this.displayDiv.style('color', 'white');
    this.displayDiv.style('padding', '10px');
    this.startTime = millis();
  }

  update(pointsCount) {
    this.frameCount++;
    const currentTime = millis();

    if (currentTime - this.startTime >= 1000) {
      this.fps = this.frameCount / ((currentTime - this.startTime) / 1000);
      this.startTime = currentTime;
      this.frameCount = 0;
      this.maxPoints = Math.max(this.maxPoints, pointsCount);
      this.updateDisplay(pointsCount);
    }
  }

  updateDisplay(pointsCount) {
    this.displayDiv.html(`
      FPS: ${this.fps.toFixed(2)}<br>
      Points: ${pointsCount}<br>
      Max Points: ${this.maxPoints}
    `);
  }
}

let performanceMonitor;

const mouseWheel = () => false



function generatePseudoRandomPoints(nextPoints, seed) {
  const x_scale = width * 0.5;
  const y_scale = height * 0.5;
  const x_offset = width * 0.25;
  const y_offset = height * 0.25;
  for (let i = 0; i < nextPoints.count; i++) {
    const pos = createVector(
      Math.random() * x_scale - x_offset,
      Math.random() * y_scale - y_offset,
      Math.random() * x_scale - x_offset
    );

    points.push({
      worldPosition: pos,
      color: color.color(),
      rotation: getLookAtRotation(pos)
    });
  }

  nextPoints.count *= 2;
  staticBuffersNeedUpdate = true;
}
