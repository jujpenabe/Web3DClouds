'use strict'

let color, depth, brush, escorzo = true;
let fallback = [], points = [];
let record;

// Performance tracking variables
let performanceStartTime = 0;
let performanceFrameCount = 0;
let performanceFPS = 0;
let performanceMaxPoints = 0;
let performanceDiv;

function preload() {
  loadJSON('cloud_500.json', json =>
    fallback = json.map(entry => ({
      worldPosition: createVector(entry.x, entry.y, entry.z),
      color: entry.color
    }))
  )
}

function setup() {
  frameRate(1000);
  const canvas = createCanvas(800, 600, WEBGL);
  colorMode(RGB, 1);
  document.oncontextmenu = () => false;
  points = [...fallback];

  // Create performance display
  performanceDiv = createDiv('');
  performanceDiv.position(width, 0);
  performanceDiv.style('background-color', 'rgba(0,0,0,0.8)');
  performanceDiv.style('color', 'white');
  performanceDiv.style('padding', '10px');

  const o = parsePosition([0,0,0], { from: Tree.WORLD, to: Tree.SCREEN });
  console.log("O: ", o);
  
  depth = createSlider(0, 1, o.z, 0.001);
  depth.position(10, 10);
  depth.style('width', '580px');
  
  color = createColorPicker('#C7C08D');
  color.position(width - 70, 40);
  
  // select initial brush
  brush = sphereBrush;

  // Initialize performance start time
  performanceStartTime = millis();
}

function draw() {
  // Performance tracking
  performanceFrameCount++;
  const currentTime = millis();
  
  // Calculate FPS every second
  if (currentTime - performanceStartTime >= 1000) {
    performanceFPS = performanceFrameCount / ((currentTime - performanceStartTime) / 1000);
    performanceStartTime = currentTime;
    performanceFrameCount = 0;
    
    // Track max points
    performanceMaxPoints = Math.max(performanceMaxPoints, points.length);
    
    // Update performance display
    performanceDiv.html(`
      FPS: ${performanceFPS.toFixed(2)}<br>
      Points: ${points.length}<br>
      Max Points: ${performanceMaxPoints}
    `);
  }

  (mouseY >= 30) && orbitControl();
  record && update();
  background('#000000');
  axes({ size: 50, bits: Tree.X | Tree.Y | Tree.Z | Tree._X | Tree._Y | Tree._Z });
  
  for (const point of points) {
    push();
    translate(point.worldPosition);
    brush(point);
    pop();
  }
}

function update() {
  points.push({
    worldPosition: parsePosition([mouseX, mouseY, depth.value()], { from: Tree.SCREEN, to: Tree.WORLD }),
    color: color.color(),
  })
}

function sphereBrush(point) {
  push()
  noStroke()
  fill(point.color)
  sphere(1)
  pop()
}

function keyPressed() {
  key === 'c' && (points = [])
  key === 'f' && focus()
  key === 'l' && (points = [...fallback])
  key === 'p' && (escorzo = !escorzo) && (escorzo ? perspective() : ortho())
  key === 'r' && (record = !record)
  key === 's' && saveCloud()
}

function saveCloud() {
  const data = points.map(point => {
    const color = point.color
    const colorArray = [red(color) / 255, green(color) / 255, blue(color) / 255, alpha(color) / 255]
    return {
      x: point.worldPosition.x,
      y: point.worldPosition.y,
      z: point.worldPosition.z,
      color: colorArray
    }
  })
  saveJSON(data, 'custom_cloud.json')
}

const mouseWheel = () => false