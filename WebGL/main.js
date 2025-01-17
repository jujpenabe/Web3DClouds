const canvas = document.getElementById('webgl-canvas');
const gl = canvas.getContext('webgl');

if (!gl) {
    throw new Error('WebGL not supported');
}

// Set canvas size
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// Vertex shader program
const vsSource = `
    attribute vec3 aPosition;
    attribute vec3 aColor; // New color attribute
    varying vec3 vColor; // Varying to pass color to fragment shader
    uniform mat4 uMVPMatrix;
    void main() {
        gl_Position = uMVPMatrix * vec4(aPosition, 1.0);
        gl_PointSize = 5.0; // Size of each point
        vColor = aColor; // Pass color to fragment shader
    }
`;

// Fragment shader program
const fsSource = `
    precision mediump float;
    varying vec3 vColor; // Receive color from vertex shader
    void main() {
        gl_FragColor = vec4(vColor, 1.0); // Use the vertex color
    }
`;

function compileShader(source, type) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        return shader;
    } else {
        console.error(gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }
}

function createProgram() {
    const vertexShader = compileShader(vsSource, gl.VERTEX_SHADER);
    const fragmentShader = compileShader(fsSource, gl.FRAGMENT_SHADER);
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    return program;
}

// Generate random points in a sphere and random colors
function generatePointCloud(pointCount, depth) {
    const points = [];
    const colors = [];
    for (let i = 0; i < pointCount; i++) {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(Math.random() * 2 - 1);
        const x = Math.sin(phi) * Math.cos(theta);
        const y = Math.sin(phi) * Math.sin(theta);
        const z = Math.cos(phi); 
        points.push(x, y, z);

        const r = Math.random();
        const g = Math.random();
        const b = Math.random();
        colors.push(r, g, b);
    }
    return {
        positions: new Float32Array(points),
        colors: new Float32Array(colors)
    };
}

// Create buffer and load data
const pointCount = 100000;
let depth = 5; 
let { positions, colors } = generatePointCloud(pointCount, depth);
const positionBuffer = gl.createBuffer();
const colorBuffer = gl.createBuffer();

gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
gl.bufferData(gl.ARRAY_BUFFER, colors, gl.STATIC_DRAW);

// Create the shader program
const program = createProgram();
gl.useProgram(program);

// Get attribute and uniform locations
const positionLocation = gl.getAttribLocation(program, 'aPosition');
const colorLocation = gl.getAttribLocation(program, 'aColor'); 
const mvpMatrixLocation = gl.getUniformLocation(program, 'uMVPMatrix');

gl.enableVertexAttribArray(positionLocation);
gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
gl.vertexAttribPointer(positionLocation, 3, gl.FLOAT, false, 0, 0);

gl.enableVertexAttribArray(colorLocation);
gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
gl.vertexAttribPointer(colorLocation, 3, gl.FLOAT, false, 0, 0);

const projectionMatrix = mat4.create();
const viewMatrix = mat4.create();
const mvpMatrix = mat4.create();

mat4.perspective(projectionMatrix, Math.PI / 4, canvas.width / canvas.height, 0.1, 100);

// Camera control variables
let cameraRadius = 5;
let cameraTheta = Math.PI / 4; // Vertical angle
let cameraPhi = Math.PI / 4; // Horizontal angle
let isDragging = false;
let lastMouseX = 0;
let lastMouseY = 0;

const depthSlider = document.getElementById('depth-slider');
const depthValueDisplay = document.getElementById('depth-value');

depthSlider.addEventListener('input', (event) => {
    depth = parseFloat(event.target.value);
    depthValueDisplay.textContent = depth; 
});

canvas.addEventListener('mousedown', (event) => {
    isDragging = true;
    lastMouseX = event.clientX;
    lastMouseY = event.clientY;
});

canvas.addEventListener('mousemove', (event) => {
    if (isDragging) {
        const deltaX = event.clientX - lastMouseX;
        const deltaY = event.clientY - lastMouseY;

        cameraPhi += deltaX * 0.005; // Horizontal movement
        cameraTheta += deltaY * 0.005; // Vertical movement
        cameraTheta = Math.max(0.1, Math.min(Math.PI - 0.1, cameraTheta)); // Clamp theta

        lastMouseX = event.clientX;
        lastMouseY = event.clientY;
    }
});

canvas.addEventListener('mouseup', () => {
    isDragging = false;
});

window.addEventListener('wheel', (event) => {
    cameraRadius += event.deltaY * 0.01; 
    cameraRadius = Math.max(1, Math.min(20, cameraRadius)); 
});

window.addEventListener('keydown', (event) => {
    if (event.key === 'r') {
        const mouseX = lastMouseX / canvas.width * 2 - 1; 
        const mouseY = -(lastMouseY / canvas.height * 2 - 1); 

        const inverseMVP = mat4.create();
        mat4.invert(inverseMVP, mvpMatrix);
        const clipCoords = [mouseX, mouseY, -1, 1]; //
        const worldCoords = vec4.create();
        vec4.transformMat4(worldCoords, clipCoords, inverseMVP);
        const point = [
            worldCoords[0] * (depth / 10) / worldCoords[3], 
            worldCoords[1] * (depth / 10) / worldCoords[3], 
            worldCoords[2] * (depth / 10) / worldCoords[3]];

        positions = new Float32Array([...positions, ...point]);
        const r = Math.random();
        const g = Math.random();
        const b = Math.random();
        colors = new Float32Array([...colors, r, g, b]);

        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, colors, gl.STATIC_DRAW);
    }
});

function updateViewMatrix() {
    const cameraX = (cameraRadius * Math.sin(cameraTheta) * Math.cos(cameraPhi));
    const cameraY = (cameraRadius * Math.sin(cameraTheta) * Math.sin(cameraPhi));
    const cameraZ = cameraRadius * Math.cos(cameraTheta);
    mat4.lookAt(viewMatrix, [cameraX, cameraY, cameraZ], [0, 0, 0], [0, 1, 0]);
}

let lastFrameTime = performance.now();
let frameCount = 0;
let fps = 0;

function updateFPSDisplay() {
    frameCount++;
    const currentTime = performance.now();
    const deltaTime = currentTime - lastFrameTime;

    if (deltaTime >= 1000) {
        fps = frameCount;
        frameCount = 0;
        lastFrameTime = currentTime;
        document .getElementById('fps-display').textContent = `FPS: ${fps}`;
    }
}

function animate() {
    requestAnimationFrame(animate);
    updateViewMatrix(); 
    mat4.multiply(mvpMatrix, projectionMatrix, viewMatrix);

    gl.uniformMatrix4fv(mvpMatrixLocation, false, mvpMatrix);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.viewport(0, 0, canvas.width, canvas.height);

    gl.drawArrays(gl.POINTS, 0, positions.length / 3);
    
    updateFPSDisplay();
}

animate();