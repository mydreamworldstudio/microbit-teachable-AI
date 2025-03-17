let video;
let model;
let microbitDevice;

async function loadModel() {
    model = await tmImage.load("YOUR_MODEL_URL/model.json", "YOUR_MODEL_URL/metadata.json");
}

async function setupCamera() {
    video = document.getElementById("webcam");
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    video.srcObject = stream;
}

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

async function startPrediction() {
    const prediction = await model.predict(video);
    console.log(prediction);
    // Send command to micro:bit based on prediction
}

window.onload = async () => {
    await setupCamera();
    await loadModel();
};
