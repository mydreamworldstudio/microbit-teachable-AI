let modelUrl = "";
let model;
let microbitDevice;
let microbitCharacteristic;
let reconnecting = false;

// Load model URL and switch to second page
function loadModel() {
    modelUrl = document.getElementById("modelUrl").value.trim();

    if (!modelUrl.startsWith("https://teachablemachine.withgoogle.com/models/")) {
        alert("Please enter a valid Teachable Machine model URL!");
        return;
    }

    // Switch to second page
    document.getElementById("page1").classList.add("hidden");
    document.getElementById("page2").classList.remove("hidden");

    loadTeachableMachineModel();
    setupCamera();
}

// Load Teachable Machine model
async function loadTeachableMachineModel() {
    try {
        if (!window.tmImage) {
            console.error("❌ Teachable Machine library not loaded!");
            alert("Teachable Machine library failed to load.");
            return;
        }

        const modelURL = modelUrl.replace(/\/+$/, '') + "/model.json";
        const metadataURL = modelUrl.replace(/\/+$/, '') + "/metadata.json";

        model = await tmImage.load(modelURL, metadataURL);
        console.log("✅ Model loaded!");

        startPrediction();
    } catch (error) {
        console.error("❌ Failed to load model:", error);
        alert("Failed to load model. Please check the URL and try again.");
    }
}

// Setup live camera feed
async function setupCamera() {
    const video = document.getElementById("webcam");

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        video.srcObject = stream;
        console.log("📷 Camera feed started.");
    } catch (error) {
        console.error("❌ Failed to access camera:", error);
        alert("Camera access denied. Please enable camera permissions.");
    }
}

// Start predictions automatically
async function startPrediction() {
    const video = document.getElementById("webcam");

    setInterval(async () => {
        if (!model) return;

        const predictions = await model.predict(video);

        const topPrediction = predictions.reduce((prev, current) =>
            prev.probability > current.probability ? prev : current
        );

        let output = document.getElementById("output");
        output.innerText = `${topPrediction.className}`;

        sendToMicrobit(topPrediction.className);
    }, 1000);
}

// Connect to micro:bit
async function connectMicrobit() {
    try {
        microbitDevice = await navigator.bluetooth.requestDevice({
            filters: [{ namePrefix: "BBC micro:bit" }],
            optionalServices: ['6e400001-b5a3-f393-e0a9-e50e24dcca9e']
        });

        const server = await microbitDevice.gatt.connect();
        const service = await server.getPrimaryService('6e400001-b5a3-f393-e0a9-e50e24dcca9e');
        microbitCharacteristic = await service.getCharacteristic('6e400002-b5a3-f393-e0a9-e50e24dcca9e');

        console.log("✅ Connected to micro:bit Bluetooth UART.");
        updateConnectionStatus(true);

        microbitDevice.addEventListener('gattserverdisconnected', handleDisconnect);

    } catch (error) {
        console.error("❌ Micro:bit connection failed", error);
        alert("Failed to connect. Try again.");
    }
}

// Handle disconnection
async function handleDisconnect() {
    console.warn("⚠️ Micro:bit disconnected.");
    updateConnectionStatus(false);
}

// Send data to micro:bit
async function sendToMicrobit(prediction) {
    if (!microbitCharacteristic) return;

    try {
        const data = new TextEncoder().encode(prediction + "\n");
        await microbitCharacteristic.writeValueWithoutResponse(data);
        console.log("📡 Sent to micro:bit:", prediction);
    } catch (error) {
        console.error("❌ Failed to send:", error);
    }
}

// Update button status
function updateConnectionStatus(isConnected) {
    document.getElementById("connectButton").innerText = isConnected ? "Connected ✅" : "Connect";
}
