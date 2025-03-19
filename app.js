window.onload = function () {
    let uBitDevice;
    let rxCharacteristic;
    let txCharacteristic;
    let model, webcam;
    let lastPrediction = "";
    let isPredicting = false;
    let currentFacingMode = "user"; // Default to front camera

    // Button References
    const connectBtn = document.getElementById("connectButton");
    const loadModelBtn = document.getElementById("loadModelButton");
    const switchCameraBtn = document.getElementById("switchCameraButton");
    const outputDiv = document.getElementById("output");

    // Event Listeners
    if (connectBtn) connectBtn.addEventListener("click", connectMicrobit);
    if (loadModelBtn) loadModelBtn.addEventListener("click", loadTeachableMachineModel);
    if (switchCameraBtn) switchCameraBtn.addEventListener("click", switchCamera);

    async function loadTeachableMachineModel() {
        const modelURL = document.getElementById("modelUrl")?.value;
        if (!modelURL) {
            console.error("❌ No model URL provided.");
            return;
        }

        try {
            console.log("📥 Loading Teachable Machine model...");
            model = await tmImage.load(modelURL + "/model.json", modelURL + "/metadata.json");

            await startCamera();
            
            document.getElementById("page1").classList.add("hidden");
            document.getElementById("page2").classList.remove("hidden");

            console.log("✅ Model Loaded Successfully.");
            startPredictionLoop();

        } catch (error) {
            console.error("❌ Model loading failed:", error);
        }
    }

    async function startCamera() {
        stopCamera();

        const constraints = {
            video: { facingMode: currentFacingMode } 
        };

        try {
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            const videoElement = document.getElementById("webcam");
            videoElement.srcObject = stream;
            webcam = new tmImage.Webcam(200, 200, true); 
            await webcam.setup(); 
            await webcam.play();
            videoElement.appendChild(webcam.canvas);
        } catch (error) {
            console.error("❌ Camera access failed:", error);
        }
    }

    function switchCamera() {
        currentFacingMode = currentFacingMode === "user" ? "environment" : "user"; 
        startCamera();
    }

    function stopCamera() {
        let videoElement = document.getElementById("webcam");
        let stream = videoElement.srcObject;
        if (stream) {
            let tracks = stream.getTracks();
            tracks.forEach(track => track.stop());
        }
    }

    async function startPredictionLoop() {
        if (isPredicting) return;
        isPredicting = true;

        function loop() {
            predict();
            requestAnimationFrame(loop);
        }
        loop();
    }

    async function predict() {
        if (!model || !webcam) return;
        webcam.update();
        const predictions = await model.predict(webcam.canvas);

        let bestPrediction = predictions.reduce((prev, current) => 
            (prev.probability > current.probability ? prev : current)
        );

        let newPrediction = bestPrediction.className;

        if (newPrediction !== lastPrediction) {
            lastPrediction = newPrediction;
            console.log("📡 Result:", lastPrediction);
            outputDiv.innerText = `Prediction: ${lastPrediction}`;  // ✅ Updating output

            sendUART(lastPrediction); // ✅ Sending to micro:bit
        }
    }

    async function connectMicrobit() {
        try {
            console.log("🔍 Searching for micro:bit...");
            uBitDevice = await navigator.bluetooth.requestDevice({
                filters: [{ namePrefix: "BBC micro:bit" }],
                optionalServices: ["6e400001-b5a3-f393-e0a9-e50e24dcca9e"]
            });

            console.log("🔗 Connecting to GATT Server...");
            await connectToGattServer();
            enterFullScreen();

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

            txCharacteristic.startNotifications();
            txCharacteristic.addEventListener("characteristicvaluechanged", onTxCharacteristicValueChanged);

            uBitDevice.addEventListener('gattserverdisconnected', () => reconnectMicrobit());

        } catch (error) {
            console.error("❌ GATT Connection Failed:", error);
            updateConnectionStatus(false);
        }
    }

    async function reconnectMicrobit() {
        console.warn("⚠️ Micro:bit disconnected. Attempting to reconnect...");
        updateConnectionStatus(false);

        setTimeout(async () => {
            if (uBitDevice && uBitDevice.gatt.connected === false) {
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

    function updateConnectionStatus(connected) {
        if (!connectBtn) return;
        connectBtn.innerText = connected ? "Connected!" : "Reconnect";
        connectBtn.style.background = connected ? "#0077ff" : "#ff3333";
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
        let receivedString = new TextDecoder().decode(event.target.value);
        console.log("📥 Received from micro:bit:", receivedString);
    }

    function enterFullScreen() {
        let elem = document.documentElement;
        document.body.addEventListener('click', () => elem.requestFullscreen(), { once: true });
    }
};
