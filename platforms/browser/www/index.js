
// Add event listener to handle when the device is ready to go
document.addEventListener("deviceready", onDeviceReady, false);

// Create customised options for gauge using gauge.min.js
var opts = {
  lines: 12,
  angle: 0.10,
  lineWidth: 0.44,
  pointer: {
    length: 0.5,
    strokeWidth: 0.035,
    color: '#000000'
  },
  limitMax: 'true', 
  percentColors: [[0.0, "#00a878" ], [0.9, "#00a878"], [1.0, "#fe4a49"]],
  strokeColor: '#bbdefb',
  generateGradient: false,
  highDpiSupport: true,
  staticLabels: {
    font: "14px sans-serif",  // Specifies font
    labels: [0, 5, 10],  // Print labels at these values
    color: "#000000" // Optional: Label text color
  }
};

var target = document.getElementById('gauge');
var gauge = new Gauge(target).setOptions(opts);
gauge.maxValue = 10;
gauge.animationSpeed = 40;
gauge.set(10);

var updates = 0;
var km = 0;
var watchingPosition = false;
var allowLock = true;

// This function is called when device is ready
function onDeviceReady(){

    // Add pause event listener for when app is in background 
    document.addEventListener("pause", onAppPause, false);

    // Initialise bluetooth via bluetoothle plugin 
    bluetoothle.initialize(initResult, {"request": true, "statusReceiver": true});

    // If it has permissions
    cordova.plugins.notification.local.hasPermission(function(granted){
        // If it is allowed
        if(granted == true){
            // We are allowed to send notifications 
        }
        else{
            // Otherwise register the permission
            cordova.plugins.notification.local.registerPermission(function(granted){
                // If it is then allowed
                if(granted == true){
                    // We are now allowed to send notifications
                }
                // If it is still not allowed 
                else{
                    document.getElementById("info").innerText = "Notifications are not allowed";
                }
            });
        }
    });
}

// This function is called when the app is put to background or minimised
function onAppPause(){
    // Send local notification informing user app is paused 
    cordova.plugins.notification.local.schedule({
        title: "Paused in background",
        message: "Aaron's app paused"
    });
}

// initResult is called once Bluetooth is initialised
var initResult = function(result){
    // If Bluetooth was successfully enabled
    if(result.status == "enabled"){
        // Run this function which contains four parameters
        // These parameters define what Bluetooth beacon to monitor 
        createBeaconAndMonitor("mint", "b9407f30-f5f8-466e-aff9-25556b57fe6d", 4906, 24494);
    }
    else{
        // Otherwise we have a problem with Bluetooth
        //alert("Bluetooth error");
    }
}

// Called after Bluetooth being enabled to start monitoring for beacons
function createBeaconAndMonitor(identifier, uuid, major, minor){
    // Create delegate object that holds beacon callback functions.
    var delegate = new cordova.plugins.locationManager.Delegate();

    // When the device actively starts looking for the beacon region 
    delegate.didStartMonitoringForRegion = function(result){
        document.getElementById("bluetoothState").innerHTML = 
        'Searching for beacon... ';
    }
    
    // When the device has entered or exited the beacon region 
    delegate.didDetermineStateForRegion = function(result){
        // If inside/entered beacon region 
        if(result.state == "CLRegionStateInside"){
            // This is done so watching location is only done when near 
            // the Bluetooth beacon, which would be placed inside a vehicle. 
            // It doesn't make sense to do it anywhere else. 

            document.getElementById("bluetoothState").innerHTML = 
            'In beacon region';
            // watchingPosition false by default
            // so if not watchingPosition
            if(!watchingPosition){
                // watchingPosition to true
                watchingPosition = true;
                // Start watching location
                var watchPosition = navigator.geolocation.watchPosition(onSuccess, onError, {enableHighAccuracy: true});
            }
            // Send a local notification informing user you are near the vehicle 
            cordova.plugins.notification.local.schedule({
                title: "Near vehicle",
                message: "Make sure this app is open"
            });
        }
        // Else if outside/exited beacon region
        else if(result.state == "CLRegionStateOutside"){
            // This only works once you initially enter a beacon region 
            // then leave it. Once you leave the region there is no need
            // to monitor the user's location. 

            document.getElementById("bluetoothState").innerHTML = 'Left beacon region';
            // If you are watchingPosition
            if(watchingPosition){
                // watchingPosition to false
                watchingPosition = false;
                // Stop watching location 
                navigator.geolocation.clearWatch(watchPosition);
            }
            // Send a local notification informing user that they have moved away 
            cordova.plugins.notification.local.schedule({
                title: "Moving away from vehicle",
                message: "Remember to open the app next time"
            });
        }
    }

    // Storing the passed parameters as a beacon region object
    // This is the beacon we want to listen out for 
    var mintRegion = new cordova.plugins.locationManager.BeaconRegion(identifier, uuid, major, minor);

    // Set the delegate object we want to use for beacon callbacks 
    cordova.plugins.locationManager.setDelegate(delegate);

    // Request permission from user to access location info.
    cordova.plugins.locationManager.requestAlwaysAuthorization();

    // Start monitoring for mint beacon 
    cordova.plugins.locationManager.startMonitoringForRegion(mintRegion)
        .fail(function(e) { alert("BLE Error: " + e); })
        .done();
}

// When location is successfully retrieved
var onSuccess = function(position){
    // Multiply m/s by 3.6 to get km/h 
    km = Math.round(position.coords.speed * 3.6);
    // Increment update 
    updates++;
    // Update text
    document.getElementById("speedometer").innerHTML = 
        'You are driving at ' + km + ' km per hour';
    gauge.set(km);

        // If speed greater than 10
        // and allowLock is true
        if(km >= 10 && allowLock){
            // Lock the phone
            window.forceLock.lock(
                function(){
                    // success
                    // allowLock to false to stop repeating locks
                    allowLock = false;
                    // Send notification
                    cordova.plugins.notification.local.schedule({
                        title: "Warning!",
                        message: "Do not use your phone while driving"
                    });
                },
                function(e){
                    // error 
                    alert("error: " + e);
                })
        }
        // Else if moving at 10km or less
        // and not allowed to lock
        else if(km < 10 && !allowLock){
            // allowLock to be true again
            allowLock = true;
        }
}

// When there is an error with location 
var onError = function(error){
    document.getElementById("info").innerText = error.message;
}