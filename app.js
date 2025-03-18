let modelUrl = "";
let model;
let microbitDevice;
let microbitCharacteristic;
let rxCharacteristic;  // ✅ Added RX characteristic
let reconnecting = false;
let writeQueue = [];
let lastPrediction = "";
let isSending = false; // Prevent multiple writes at the same time

// Proxy object to detect prediction changes
let predictionState = new Proxy({ value: "" }, {
    set: function (obj, prop, newValue) {
        if (prop === "value" && obj[prop] !== newValue) {
            console.log("🧠 Detected:", newValue);
            sendToMicrobit(newValue);
        }
        obj[prop] = newValue;
        return true;
    },
});

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

        document.getElementById("output").innerText = `${topPrediction.className}`;

        // Update the proxy state (triggers sendToMicrobit automatically)
        predictionState.value = topPrediction.className;
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

        // ✅ TX Characteristic (Write)
        microbitCharacteristic = await service.getCharacteristic('6e400002-b5a3-f393-e0a9-e50e24dcca9e');

        // ✅ RX Characteristic (Read)
        rxCharacteristic = await service.getCharacteristic('6e400003-b5a3-f393-e0a9-e50e24dcca9e');
        rxCharacteristic.startNotifications();
        rxCharacteristic.addEventListener("characteristicvaluechanged", onDataReceived);

        console.log("✅ Connected to micro:bit Bluetooth UART.");
        updateConnectionStatus(true);

        microbitDevice.addEventListener('gattserverdisconnected', handleDisconnect);
    } catch (error) {
        console.error("❌ Micro:bit connection failed", error);
        alert("Failed to connect. Try again.");
    }
}

// ✅ Handle received data from micro:bit
function onDataReceived(event) {
    let receivedData = [];
    for (var i = 0; i < event.target.value.byteLength; i++) {
        receivedData[i] = event.target.value.getUint8(i);
    }

    const receivedString = String.fromCharCode.apply(null, receivedData);
    console.log("📥 Received from micro:bit:", receivedString);

    if (receivedString.trim() === "S") {
        console.log("🎭 Micro:bit detected shake event!");
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

// Queue for handling BLE write operations
function queueGattOperation(operation) {
    writeQueue.push(operation);

    if (writeQueue.length === 1) {
        processGattQueue();
    }
}

async function processGattQueue() {
    if (writeQueue.length === 0) return;

    try {
        await writeQueue[0]();
        writeQueue.shift();
    } catch (error) {
        console.error("❌ BLE write failed:", error);
    } finally {
        if (writeQueue.length > 0) {
            processGattQueue();
        }
    }
}

// ✅ Send data to micro:bit with a newline at the end
async function sendToMicrobit(prediction) {
    if (!microbitCharacteristic) {
        console.warn("⚠️ Micro:bit not connected.");
        return;
    }
    if (isSending) {
        console.warn("⚠️ Waiting for previous write to complete...");
        return;
    }

    if (prediction !== lastPrediction) {
        queueGattOperation(async () => {
            try {
                isSending = true;
                const message = prediction + "\n";  // ✅ Added newline
                const data = new TextEncoder().encode(message);

                await microbitCharacteristic.writeValueWithResponse(data);
                console.log("📡 Sent to micro:bit:", message);

                lastPrediction = prediction;
            } catch (error) {
                console.error("❌ Failed to send:", error);
            } finally {
                isSending = false;
            }
        });
    }
}

// Update button status
function updateConnectionStatus(isConnected) {
    const connectButton = document.getElementById("connectButton");
    if (connectButton) {
        connectButton.innerText = isConnected ? "Connected ✅" : "Connect";
    }
}
