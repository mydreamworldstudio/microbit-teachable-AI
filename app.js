let modelUrl = "";
let model;
let microbitDevice;
let microbitCharacteristic;
let reconnecting = false;
let isSending = false; // Prevents multiple writes at once

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

// Handle micro:bit disconnection and attempt to reconnect
async function handleDisconnect() {
    console.warn("⚠️ Micro:bit disconnected.");
    updateConnectionStatus(false);

    if (!reconnecting) {
        reconnecting = true;
        setTimeout(() => {
            console.log("🔄 Attempting to reconnect...");
            connectMicrobit();
            reconnecting = false;
        }, 3000); // Try reconnecting after 3 seconds
    }
}

// Send data to micro:bit
async function sendToMicrobit(prediction) {
    if (!microbitCharacteristic) {
        console.warn("⚠️ Micro:bit not connected.");
        return;
    }
    if (isSending) {
        console.warn("⚠️ Waiting for previous write to complete...");
        return;
    }

    try {
        isSending = true; // Lock sending
        const message = prediction + "\n"; // Ensure a newline is added
        const data = new TextEncoder().encode(message);

        await microbitCharacteristic.writeValueWithoutResponse(data);
        console.log("📡 Sent to micro:bit:", message);
    } catch (error) {
        console.error("❌ Failed to send:", error);
    } finally {
        isSending = false; // Unlock sending
    }
}

// Update button status (Fix for undefined function issue)
function updateConnectionStatus(isConnected) {
    const connectButton = document.getElementById("connectButton");
    if (connectButton) {
        connectButton.innerText = isConnected ? "Connected ✅" : "Connect";
    }
}
