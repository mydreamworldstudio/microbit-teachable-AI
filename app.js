window.onload = function () {
    let uBitDevice;
    let rxCharacteristic;
    let txCharacteristic;
    let model;
    let lastPrediction = "";
    let isPredicting = false;
    let currentFacingMode = "user"; // Default to front camera
    let videoElement;

    // Button References
    const connectBtn = document.getElementById("connectButton");

    // ✅ Fix: Ensure Bluetooth request runs directly inside user-initiated event
    if (connectBtn) {
        connectBtn.addEventListener("click", async function () {
            enterFullScreen(); // ✅ Force fullscreen on user click

            try {
                console.log("🔍 Searching for micro:bit...");
                
                // ✅ Bluetooth Request MUST be inside user-initiated event
                uBitDevice = await navigator.bluetooth.requestDevice({
                    filters: [{ namePrefix: "BBC micro:bit" }],
                    optionalServices: ["6e400001-b5a3-f393-e0a9-e50e24dcca9e"]
                });

                console.log("🔗 Connecting to GATT Server...");
                await connectToGattServer();

            } catch (error) {
                console.error("❌ Connection failed:", error);
            }
        });
    }

    // ✅ Connect to micro:bit GATT Server
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

    // ✅ Enter Fullscreen Function
    function enterFullScreen() {
        let elem = document.documentElement;
        if (elem.requestFullscreen) {
            elem.requestFullscreen().catch(err => console.warn("Fullscreen request failed:", err));
        } else if (elem.webkitRequestFullscreen) { /* Safari */
            elem.webkitRequestFullscreen();
        } else if (elem.msRequestFullscreen) { /* IE11 */
            elem.msRequestFullscreen();
        }
    }
};
