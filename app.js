let modelUrl = "";
let model;
let microbitDevice;

// Load model URL and switch to second page
function loadModel() {
    modelUrl = document.getElementById("modelUrl").value.trim();
    if (!modelUrl) {
        alert("Please enter a valid model URL!");
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
        const modelURL = modelUrl + "/model.json";
        const metadataURL = modelUrl + "/metadata.json";

        model = await tmImage.load(modelURL, metadataURL);
        console.log("Model loaded!");

        startPrediction(); // Start predictions once model loads
    } catch (error) {
        console.error("Failed to load model:", error);
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
        console.log("Camera feed started.");
    } catch (error) {
        console.error("Failed to access camera:", error);
    }
}

// Start predictions automatically
async function startPrediction() {
    const video = document.getElementById("webcam");

    setInterval(async () => {
        if (model) {
            const predictions = await model.predict(video);
            
            // Find the class with the highest probability
            const topPrediction = predictions.reduce((prev, current) =>
                prev.probability > current.probability ? prev : current
            );

            // Update UI with the best prediction
            document.getElementById("output").innerText = 
                `Prediction: ${topPrediction.className} (${(topPrediction.probability * 100).toFixed(2)}%)`;

            sendToMicrobit(topPrediction.className);
        }
    }, 1000); // Run every second
}

// Connect to micro:bit via Bluetooth
async function connectMicrobit() {
    try {
        microbitDevice = await navigator.bluetooth.requestDevice({
            acceptAllDevices: true,
            optionalServices: ['battery_service']
        });
        console.log("Connected to Micro:bit");
    } catch (error) {
        console.error("Micro:bit connection failed", error);
    }
}

// Send prediction to micro:bit (to be expanded)
function sendToMicrobit(prediction) {
    console.log("Sending to Micro:bit:", prediction);
}
