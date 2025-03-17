let modelUrl = "";
let model;
let microbitDevice;

// Load model URL and switch to second page
function loadModel() {
    modelUrl = document.getElementById("modelUrl").value;
    if (!modelUrl) {
        alert("Please enter a valid model URL!");
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
        model = await tmImage.load(modelUrl + "/model.json", modelUrl + "/metadata.json");
        console.log("Model loaded!");
        startPrediction();
    } catch (error) {
        console.error("Failed to load model:", error);
    }
}

// Setup live camera feed
async function setupCamera() {
    const video = document.getElementById("webcam");
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    video.srcObject = stream;
}

// Start predictions automatically
async function startPrediction() {
    const video = document.getElementById("webcam");
    
    setInterval(async () => {
        if (model) {
            const predictions = await model.predict(video);
            document.getElementById("output").innerText = predictions[0].className;
            sendToMicrobit(predictions[0].className);
        }
    }, 1000);
}

// Connect to micro:bit
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
