import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

class PointCloudApp {
  constructor() {
    // Scene setup
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x000000);

    // Camera configuration
    this.camera = new THREE.PerspectiveCamera(75, 800 / 600, 2, 1000);
    this.camera.position.set(350, 150, 40);

    // Renderer setup
    this.renderer = new THREE.WebGLRenderer();
    this.renderer.setSize(800, 600);
    document.body.appendChild(this.renderer.domElement);

    // Controls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);

    // Application state
    this.points = [];
    this.fallback = [];
    this.color = "#C70000";
    this.depth = 0.5;
    this.recording = false;

    // Performance tracking
    this.performanceStartTime = 0;
    this.performanceFrameCount = 0;
    this.performanceFPS = 0;
    this.performanceMaxPoints = 0;

    // Initialize the application
    this.init();
  }

  init() {
    // Draw coordinate axes
    this.drawCoordinateAxes();

    // Create performance display
    this.createPerformanceDiv();

    // Create UI elements
    this.createUI();

    // Load initial point cloud
    this.loadPointsFromJSON("cloud_500.json");

    // Event listeners
    window.addEventListener("keydown", this.handleKeyEvents.bind(this));
    window.addEventListener("mousemove", this.handleMouseEvents.bind(this));

    // Start animation loop
    this.animate();
  }

  drawCoordinateAxes() {
    const axisLength = 50;
    const axisColors = [
      0xff0000, // X-axis (Red)
      0x00ff00, // Y-axis (Green)
      0x0000ff, // Z-axis (Blue)
    ];

    // Positive axes
    const axes = [
      { start: [0, 0, 0], end: [axisLength, 0, 0], color: axisColors[0] },
      { start: [0, 0, 0], end: [0, axisLength, 0], color: axisColors[1] },
      { start: [0, 0, 0], end: [0, 0, axisLength], color: axisColors[2] },
    ];

    // Negative axes (darker shades)
    const negAxes = [
      { start: [0, 0, 0], end: [-axisLength, 0, 0], color: 0x800000 },
      { start: [0, 0, 0], end: [0, -axisLength, 0], color: 0x008000 },
      { start: [0, 0, 0], end: [0, 0, -axisLength], color: 0x000080 },
    ];

    [...axes, ...negAxes].forEach((axis) => {
      const geometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(...axis.start),
        new THREE.Vector3(...axis.end),
      ]);
      const material = new THREE.LineBasicMaterial({ color: axis.color });
      const line = new THREE.Line(geometry, material);
      this.scene.add(line);
    });
  }

  createPerformanceDiv() {
    this.performanceDiv = document.createElement("div");
    this.performanceDiv.style.position = "absolute";
    this.performanceDiv.style.top = "0px";
    this.performanceDiv.style.left = "800px";
    this.performanceDiv.style.backgroundColor = "rgba(0,0,0,0.8)";
    this.performanceDiv.style.color = "white";
    this.performanceDiv.style.padding = "10px";
    this.performanceDiv.style.zIndex = "100";
    document.body.appendChild(this.performanceDiv);
  }

  createUI() {
    // Depth slider
    const depthSlider = document.createElement("input");
    depthSlider.type = "range";
    depthSlider.min = 0;
    depthSlider.max = 1;
    depthSlider.step = 0.01;
    depthSlider.value = this.depth;
    depthSlider.style.position = "absolute";
    depthSlider.style.top = "20px";
    depthSlider.style.left = "20px";
    depthSlider.style.width = "300px";
    depthSlider.oninput = (e) => (this.depth = parseFloat(e.target.value));
    document.body.appendChild(depthSlider);

    // Color picker
    const colorPicker = document.createElement("input");
    colorPicker.type = "color";
    colorPicker.value = this.color;
    colorPicker.style.position = "absolute";
    colorPicker.style.top = "40px";
    colorPicker.style.left = "20px";
    colorPicker.oninput = (e) => (this.color = e.target.value);
    document.body.appendChild(colorPicker);
  }

  loadPointsFromJSON(filePath) {
    const loader = new THREE.FileLoader();
    loader.load(
      filePath,
      (data) => {
        const json = JSON.parse(data);
        this.fallback = json.map((entry) => ({
          worldPosition: new THREE.Vector3(entry.x, entry.y, entry.z),
          color: this.convertColor(entry.color),
        }));
        this.points = [...this.fallback];
        this.fallback.forEach(this.addPointToScene.bind(this));
      },
      undefined,
      (error) => console.error("Error loading JSON file:", error)
    );
  }

  convertColor(colorArray) {
    // Convert color array [r,g,b,a] to hex or three.js color
    if (Array.isArray(colorArray)) {
      return new THREE.Color(colorArray[0], colorArray[1], colorArray[2]);
    }
    return new THREE.Color(colorArray);
  }

  addPointToScene({ worldPosition, color }) {
    const geometry = new THREE.SphereGeometry(1);
    const material = new THREE.MeshBasicMaterial({ color });
    const point = new THREE.Mesh(geometry, material);
    point.position.copy(worldPosition);
    this.scene.add(point);
  }

  addNewPoint(event) {
    if (!this.recording) return;

    // Normalize mouse coordinates
    const mouseXNorm = (event.clientX * 2) / 600 - 1;
    const mouseYNorm = -((event.clientY / 300) * 2) + 1;

    // Create mouse position vector
    const mousePosition = new THREE.Vector3(mouseXNorm, mouseYNorm, this.depth);

    // Unproject to world coordinates
    mousePosition.unproject(this.camera);

    const newPoint = {
      worldPosition: mousePosition,
      color: new THREE.Color(this.color),
    };

    this.addPointToScene(newPoint);
    this.points.push(newPoint);
  }

  clearPoints() {
    // Remove points from scene
    this.points.forEach((point) => this.scene.remove(point));
    this.points = [];
  }

  saveCloud() {
    const data = this.points.map((point) => ({
      x: point.worldPosition.x,
      y: point.worldPosition.y,
      z: point.worldPosition.z,
      color: point.color.toArray(),
    }));

    const jsonBlob = new Blob([JSON.stringify(data)], {
      type: "application/json",
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(jsonBlob);
    link.download = "custom_cloud.json";
    link.click();
  }

  handleKeyEvents(event) {
    switch (event.key) {
      case "c": // Clear points
        this.clearPoints();
        break;
      case "r": // Toggle recording
        this.recording = !this.recording;
        break;
      case "s": // Save cloud
        this.saveCloud();
        break;
      case "f": // Focus camera
        this.focusCamera();
        break;
      default:
        break;
    }
  }

  handleMouseEvents(event) {
    this.addNewPoint(event);
  }

  focusCamera() {
    this.controls.target.set(0, 0, 0);
    this.controls.update();
  }
  
  getMemoryUsage() {
    // Verificar si performance.memory está disponible (Chrome/Chromium)
    if (window.performance && window.performance.memory) {
      const memory = window.performance.memory;
      return {
        totalJSHeapSize: memory.totalJSHeapSize,
        usedJSHeapSize: memory.usedJSHeapSize,
        jsHeapSizeLimit: memory.jsHeapSizeLimit
      };
    }

    // Fallback para navegadores que no soportan performance.memory
    if ('memory' in window.performance) {
      try {
        const memory = window.performance.memory;
        return {
          totalJSHeapSize: memory.totalJSHeapSize,
          usedJSHeapSize: memory.usedJSHeapSize,
          jsHeapSizeLimit: memory.jsHeapSizeLimit
        };
      } catch (error) {
        console.warn('No se puede acceder a la información de memoria.');
        return null;
      }
    }

    // Intentar usar la API de memoria del navegador como último recurso
    if ('memory' in navigator) {
      try {
        const memory = navigator.memory;
        return {
          totalJSHeapSize: memory.totalJSHeapSize,
          usedJSHeapSize: memory.usedJSHeapSize,
          jsHeapSizeLimit: memory.jsHeapSizeLimit
        };
      } catch (error) {
        console.warn('No se puede acceder a la información de memoria.');
        return null;
      }
    }

    return null;
  }

  animate() {
    requestAnimationFrame(this.animate.bind(this));

    // Performance tracking
    this.performanceFrameCount++;
    const currentTime = performance.now();

    // Calculate FPS every second
    if (currentTime - this.performanceStartTime >= 1000) {
      this.performanceFPS =
        this.performanceFrameCount /
        ((currentTime - this.performanceStartTime) / 1000);
      this.performanceStartTime = currentTime;
      this.performanceFrameCount = 0;

      // Track max points
      this.performanceMaxPoints = Math.max(
        this.performanceMaxPoints,
        this.points.length
      );

      // Update performance display
      if (this.performanceDiv) {
        this.performanceDiv.innerHTML = `
          FPS: ${this.performanceFPS.toFixed(2)}<br>
          Points: ${this.points.length}<br>
          Max Points: ${this.performanceMaxPoints}
        `;
      }
      
      
    // Get memory usage
    const memoryUsage = this.getMemoryUsage();
      
      // Update performance display
    if (this.performanceDiv) {
        let memoryInfo = 'Memoria no disponible';
        if (memoryUsage) {
          memoryInfo = `
            Total JS Heap: ${(memoryUsage.totalJSHeapSize / 1024 / 1024).toFixed(2)} MB<br>
            Used JS Heap: ${(memoryUsage.usedJSHeapSize / 1024 / 1024).toFixed(2)} MB<br>
            JS Heap Limit: ${(memoryUsage.jsHeapSizeLimit / 1024 / 1024).toFixed(2)} MB
          `;
        }

        this.performanceDiv.innerHTML = `
          FPS: ${this.performanceFPS.toFixed(2)}<br>
          Points: ${this.points.length}<br>
          Max Points: ${this.performanceMaxPoints}<br>
          ${memoryInfo}
        `;
      }
    }

    
    
    
    // Update controls and render
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
}

// Initialize the application
const app = new PointCloudApp();
