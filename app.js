window.onload = function () {
    let uBitDevice;
    let rxCharacteristic;
    let txCharacteristic;
    let model, webcam;
    let lastPrediction = "";
    let isPredicting = false;
    let useFrontCamera = true; // For front/back camera switching

    // Button References
    const connectBtn = document.getElementById("connectButton");
    const loadModelBtn = document.getElementById("loadModelButton");
    const switchCameraBtn = document.getElementById("switchCameraButton"); // Already in HTML

    // Ensure Switch Camera Button has Event Listener
    if (switchCameraBtn) {
        switchCameraBtn.addEventListener("click", switchCamera);
    }

    // Event Listeners
    if (loadModelBtn) loadModelBtn.addEventListener("click", loadTeachableMachineModel);
    if (connectBtn) connectBtn.addEventListener("click", connectMicrobit);

    // ✅ Load Teachable Machine Model & Start Camera
    async function loadTeachableMachineModel() {
        const modelURL = document.getElementById("modelUrl")?.value;
        if (!modelURL) {
            console.error("❌ No model URL provided.");
            return;
        }

        try {
            console.log("📥 Loading Teachable Machine model...");
            model = await tmImage.load(modelURL + "/model.json", modelURL + "/metadata.json");

            // ✅ Start Webcam with front camera by default
            await startWebcam(useFrontCamera);

            document.getElementById("page1").classList.add("hidden");
            document.getElementById("page2").classList.remove("hidden");

            console.log("✅ Model Loaded Successfully.");
            startPredictionLoop();

        } catch (error) {
            console.error("❌ Model loading failed:", error);
        }
    }

    // ✅ Start or Restart Webcam
    async function startWebcam(useFront) {
        if (webcam) {
            await webcam.stop(); // Stop current webcam before switching
        }

        console.log("📸 Starting Webcam: " + (useFront ? "Front Camera" : "Back Camera"));
        webcam = new tmImage.Webcam(250, 250, useFront ? "user" : "environment");
        await webcam.setup();
        await webcam.play();

        // ✅ Replace the webcam display
        const webcamContainer = document.getElementById("webcam-container");
        if (webcamContainer) {
            webcamContainer.innerHTML = ""; // Clear existing content
            webcamContainer.appendChild(webcam.canvas);
        } else {
            console.error("❌ webcam-container not found.");
        }
    }

    // ✅ Switch Camera Function (Front/Back Toggle)
    async function switchCamera() {
        useFrontCamera = !useFrontCamera; // Toggle front/back camera
        console.log("🔄 Switching Camera...");
        await startWebcam(useFrontCamera);
    }

    // ✅ Start Prediction Loop
    async function startPredictionLoop() {
        if (isPredicting) return;
        isPredicting = true;
        function loop() {
            predict();
            requestAnimationFrame(loop); // Runs continuously for smoother updates
        }
        loop();
    }

    // ✅ Prediction Function
    async function predict() {
        if (!model || !webcam) return;
        webcam.update();
        const predictions = await model.predict(webcam.canvas);

        let bestPrediction = predictions.reduce((prev, current) => 
            (prev.probability > current.probability ? prev : current)
        );

        if (bestPrediction.className !== lastPrediction) {
            lastPrediction = bestPrediction.className;
            console.log("📡 Result:", lastPrediction);
            document.getElementById("output").innerText = lastPrediction;
            sendUART(lastPrediction);
        }
    }

    // ✅ Connect Micro:bit
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
        let receivedData = [];
        for (let i = 0; i < event.target.value.byteLength; i++) {
            receivedData[i] = event.target.value.getUint8(i);
        }
        const receivedString = String.fromCharCode.apply(null, receivedData);
        console.log("📥 Received from micro:bit:", receivedString);
    }

    function enterFullScreen() {
        let elem = document.documentElement;
        if (elem.requestFullscreen) {
            document.body.addEventListener('click', () => elem.requestFullscreen(), { once: true });
        }
    }
};
