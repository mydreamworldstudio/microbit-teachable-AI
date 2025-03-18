document.addEventListener("DOMContentLoaded", function () {
    let uBitDevice;
    let rxCharacteristic;
    let txCharacteristic;
    let model, webcam;
    let lastPrediction = ""; // Stores last prediction to avoid repeating messages

    document.getElementById("connectBtn").addEventListener("click", connectMicrobit);

    async function connectMicrobit() {
        try {
            console.log("🔍 Searching for micro:bit...");
            uBitDevice = await navigator.bluetooth.requestDevice({
                filters: [{ namePrefix: "BBC micro:bit" }],
                optionalServices: ["6e400001-b5a3-f393-e0a9-e50e24dcca9e"]
            });

            console.log("🔗 Connecting to GATT Server...");
            await connectToGattServer();
            enterFullScreen(); // Force full-screen after connection

        } catch (error) {
            console.error("❌ Connection failed:", error);
        }
    }

    async function connectToGattServer() {
        try {
            if (!uBitDevice) return;
            const server = await uBitDevice.gatt.connect();

            console.log("🔧 Getting Service...");
            const service = await server.getPrimaryService("6e400001-b5a3-f393-e0a9-e50e24dcca9e");

            console.log("🔑 Getting Characteristics...");
            txCharacteristic = await service.getCharacteristic("6e400002-b5a3-f393-e0a9-e50e24dcca9e");
            rxCharacteristic = await service.getCharacteristic("6e400003-b5a3-f393-e0a9-e50e24dcca9e");

            console.log("✅ Bluetooth Connection Successful");

            updateConnectionStatus(true);
            enterFullScreen(); // Ensure full-screen after reconnect

            txCharacteristic.startNotifications();
            txCharacteristic.addEventListener("characteristicvaluechanged", onTxCharacteristicValueChanged);

            uBitDevice.addEventListener('gattserverdisconnected', reconnectMicrobit);

        } catch (error) {
            console.error("❌ GATT Connection Failed:", error);
            updateConnectionStatus(false);
        }
    }

    function updateConnectionStatus(connected) {
        const connectBtn = document.getElementById("connectBtn");
        if (connected) {
            connectBtn.innerText = "Connected!";
            connectBtn.style.background = "#0077ff";
        } else {
            connectBtn.innerText = "Reconnect";
            connectBtn.style.background = "#ff3333";
        }
    }

    async function reconnectMicrobit() {
        console.log("🔄 Micro:bit disconnected. Attempting to reconnect...");
        updateConnectionStatus(false);

        setTimeout(async () => {
            if (uBitDevice) {
                try {
                    console.log("🔄 Reconnecting...");
                    await connectToGattServer();
                    console.log("✅ Reconnected!");
                    updateConnectionStatus(true);
                    enterFullScreen();
                } catch (error) {
                    console.error("❌ Reconnect failed:", error);
                }
            }
        }, 3000);
    }

    async function sendUART(command) {
        if (!rxCharacteristic) return;
        let encoder = new TextEncoder();
        queueGattOperation(() =>
            rxCharacteristic.writeValue(encoder.encode(command + "\n"))
                .then(() => console.log("📡 Sent to micro:bit:", command))
                .catch(error => console.error("❌ Error sending data:", error))
        );
    }

    let queue = Promise.resolve();
    function queueGattOperation(operation) {
        queue = queue.then(operation, operation);
        return queue;
    }

    function onTxCharacteristicValueChanged(event) {
        let receivedData = [];
        for (let i = 0; i < event.target.value.byteLength; i++) {
            receivedData[i] = event.target.value.getUint8(i);
        }
        const receivedString = String.fromCharCode.apply(null, receivedData);
        console.log("📥 Received from micro:bit:", receivedString);
    }

    async function loadTeachableMachineModel() {
        const modelURL = document.getElementById("modelInput").value;
        if (!modelURL) {
            console.error("❌ No model URL provided.");
            return;
        }

        try {
            console.log("📥 Loading Teachable Machine model...");
            model = await tmImage.load(modelURL + "model.json", modelURL + "metadata.json");
            const flip = true;
            webcam = new tmImage.Webcam(200, 200, flip);
            await webcam.setup();
            await webcam.play();
            document.getElementById("webcamContainer").appendChild(webcam.canvas);

            console.log("✅ Model Loaded Successfully.");
            setInterval(startPrediction, 1000); // Start predicting every second

        } catch (error) {
            console.error("❌ Model loading failed:", error);
        }
    }

    async function startPrediction() {
        if (!model || !webcam) return;
        webcam.update();
        const predictions = await model.predict(webcam.canvas);

        let bestPrediction = predictions.reduce((prev, current) => 
            (prev.probability > current.probability ? prev : current)
        );

        if (bestPrediction.className !== lastPrediction) {
            lastPrediction = bestPrediction.className;
            console.log("🧠 Detected:", lastPrediction);
            sendUART(lastPrediction); // Sends only new predictions
        }
    }

    function enterFullScreen() {
        let elem = document.documentElement;
        if (elem.requestFullscreen) {
            elem.requestFullscreen();
        } else if (elem.mozRequestFullScreen) { // Firefox
            elem.mozRequestFullScreen();
        } else if (elem.webkitRequestFullscreen) { // Chrome, Safari, Opera
            elem.webkitRequestFullscreen();
        } else if (elem.msRequestFullscreen) { // IE/Edge
            elem.msRequestFullscreen();
        }
    }

    document.getElementById("loadModelBtn").addEventListener("click", loadTeachableMachineModel);
});
