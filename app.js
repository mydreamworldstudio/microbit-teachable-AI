let modelUrl = "";
let model;
let microbitDevice;
let microbitCharacteristic;
let rxCharacteristic;
let reconnecting = false;
let writeQueue = [];
let lastPrediction = "";
let isSending = false;
let videoStream = null;

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

// Load model and switch to second page
function loadModel() {
    modelUrl = document.getElementById("modelUrl").value.trim();
    if (!modelUrl.startsWith("https://teachablemachine.withgoogle.com/models/")) {
        alert("Please enter a valid Teachable Machine model URL!");
        return;
    }
    document.getElementById("page1").classList.add("hidden");
    document.getElementById("page2").classList.remove("hidden");
    loadTeachableMachineModel();
    setupCamera();
}

// Load Teachable Machine model
async function loadTeachableMachineModel() {
    try {
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
        videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
        video.srcObject = videoStream;
        console.log("📷 Camera feed started.");
    } catch (error) {
        console.error("❌ Failed to access camera:", error);
        alert("Camera access denied. Please enable camera permissions.");
    }
}

// Stop camera when exiting
function stopCamera() {
    if (videoStream) {
        videoStream.getTracks().forEach(track => track.stop());
        videoStream = null;
        console.log("📷 Camera feed stopped.");
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
        predictionState.value = topPrediction.className;
    }, 1000);
}

// ✅ Connect to micro:bit (Using stable Bluetooth Controller Code)
async function connectMicrobit() {
    try {
        console.log("🔍 Searching for micro:bit...");

        // Request micro:bit connection
        microbitDevice = await navigator.bluetooth.requestDevice({
            filters: [{ namePrefix: "BBC micro:bit" }],
            optionalServices: ['6e400001-b5a3-f393-e0a9-e50e24dcca9e']
        });

        console.log("📡 Connecting to GATT server...");
        const server = await microbitDevice.gatt.connect();
        console.log("✅ GATT server connected!");

        // List all available services for debugging
        const services = await server.getPrimaryServices();
        console.log("📜 Available services:", services.map(s => s.uuid));

        // Get UART Service
        const service = await server.getPrimaryService('6e400001-b5a3-f393-e0a9-e50e24dcca9e');

        // Get TX & RX characteristics
        microbitCharacteristic = await service.getCharacteristic('6e400002-b5a3-f393-e0a9-e50e24dcca9e');
        rxCharacteristic = await service.getCharacteristic('6e400003-b5a3-f393-e0a9-e50e24dcca9e');

        // Start receiving notifications
        await rxCharacteristic.startNotifications();
        rxCharacteristic.addEventListener("characteristicvaluechanged", onDataReceived);

        console.log("✅ Micro:bit UART Service connected.");
        updateConnectionStatus(true);

        // Handle disconnection
        microbitDevice.addEventListener('gattserverdisconnected', handleDisconnect);

    } catch (error) {
        console.error("❌ Micro:bit connection failed", error);
        alert("⚠️ Failed to connect. Try again and ensure Bluetooth is on.");
    }
}


// ✅ Handle received data from micro:bit (Debugging improved)
function onDataReceived(event) {
    let receivedData = [];
    for (var i = 0; i < event.target.value.byteLength; i++) {
        receivedData[i] = event.target.value.getUint8(i);
    }

    const receivedString = String.fromCharCode.apply(null, receivedData);
    console.log("📥 Received raw data:", receivedData);
    console.log("📥 Received string:", receivedString);

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
        }, 3000);
    }
}

// ✅ Send data to micro:bit (Improved)
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
                const message = prediction + "\n";
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

// ✅ Queue system for BLE operations (Avoids Overloading)
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

// ✅ Update UI Connection Status
function updateConnectionStatus(isConnected) {
    const connectButton = document.getElementById("connectButton");
    if (connectButton) {
        connectButton.innerText = isConnected ? "Connected ✅" : "Connect";
    }
}
