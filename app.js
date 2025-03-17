let modelUrl = "";
let model;
let microbitDevice;
let microbitCharacteristic;

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

        const modelURL = modelUrl + "/model.json";
        const metadataURL = modelUrl + "/metadata.json";

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
    video.setAttribute("autoplay", "");
    video.setAttribute("playsinline", "");
    video.style.width = "100%";
    video.style.maxHeight = "50vh";

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

        // Find the class with the highest probability
        const topPrediction = predictions.reduce((prev, current) =>
            prev.probability > current.probability ? prev : current
        );

        // Update UI with the best prediction
        document.getElementById("output").innerText = 
            `Prediction: ${topPrediction.className} (${(topPrediction.probability * 100).toFixed(2)}%)`;

        sendToMicrobit(topPrediction.className);
    }, 1000); // Run every second
}

// Connect to micro:bit via Bluetooth
async function connectMicrobit() {
    try {
        microbitDevice = await navigator.bluetooth.requestDevice({
            acceptAllDevices: true,
            optionalServices: ['6e400001-b5a3-f393-e0a9-e50e24dcca9e'] // UART Service UUID
        });

        const server = await microbitDevice.gatt.connect();
        const service = await server.getPrimaryService('6e400001-b5a3-f393-e0a9-e50e24dcca9e'); 
        microbitCharacteristic = await service.getCharacteristic('6e400002-b5a3-f393-e0a9-e50e24dcca9e'); 

        console.log("✅ Connected to micro:bit Bluetooth UART.");
        alert("Connected to micro:bit successfully!");
    } catch (error) {
        console.error("❌ Micro:bit connection failed", error);
        alert("Failed to connect to micro:bit. Please try again.");
    }
}

// Send prediction to micro:bit
async function sendToMicrobit(prediction) {
    if (!microbitCharacteristic) {
        console.warn("⚠️ Not connected to micro:bit. Skipping send.");
        return;
    }

    try {
        const data = new TextEncoder().encode(prediction);
        await microbitCharacteristic.writeValue(data);
        console.log("📡 Sent to micro:bit:", prediction);
    } catch (error) {
        console.error("❌ Failed to send data to micro:bit:", error);
    }
}
