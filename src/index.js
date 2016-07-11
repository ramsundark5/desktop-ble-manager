var express = require('express');
var app = express();
var noble = require('noble');
var LRU = require("lru-cache");
var speakeasy = require('speakeasy');
var lruOptions = { max: 10, maxAge: 1000 * 60 * 60 };
var cache = LRU(lruOptions);
var SERVICE_UUID = "7E61";
var CHARACTERISTIC_UUID = "c71e";

init();

function init(){
    var server = app.listen(process.env.PORT || 3000, function () {
        var port = server.address().port;
        console.log('server listening at port ' + port);
    });
    app.use(express.static('public'));
    app.get('/read/:username', getCurrentCharacteristicValue);
    var secret = speakeasy.generateSecret({length: 20});
    console.log(secret.base32);
}

function getCurrentCharacteristicValue(req, res){
    var username = req.params.username;
    var passcode = cache.get(username);
    return res.json({ username: username, passcode: passcode })
}

noble.on('stateChange', function(state) {
  if (state === 'poweredOn') {
    noble.startScanning([SERVICE_UUID]);
  } else {
    noble.stopScanning();
  }
});

noble.on('discover', function(peripheral) {

      printPeripheralDetails(peripheral);

      peripheral.connect(function(connectError) {
          if(connectError){
              console.log('unable to connect to peripheral '+connectError);
          }
          peripheral.discoverAllServicesAndCharacteristics(
              discoverServicesAndCharacteristics
          );
      });
});

function discoverServicesAndCharacteristics(error, services, availableCharacteristics){
    var characteristic = null;
    console.log('\there is my service data:' + availableCharacteristics);
    if(!availableCharacteristics){
        console.log('no characteristic found');
        return;
    }

    availableCharacteristics.forEach(function(availableCharacteristic) {
        if (CHARACTERISTIC_UUID == availableCharacteristic.uuid) {
            characteristic = availableCharacteristic;
        }
    });

    if(characteristic){
        subscribeToCharacteristic(characteristic);
        characteristic.on('data', onCharacteristicUpdate);
    }
}

function onCharacteristicUpdate(value, isNotification){
    console.log('new value is '+value.toString());
    try {
        var updatedValue = JSON.parse(value.toString());
        if(updatedValue){
            cache.set(updatedValue.username, updatedValue.passcode);
        }
    } catch (e) {
        console.log('error updating characteristic value '+ e);
    }

}

function subscribeToCharacteristic(characteristic) {
    characteristic.subscribe(function(error){
        if(error){
            console.log('error subscribing to characteristic '+ characteristic.uuid + '. Error is '+error);
        }else{
            console.log('successfully subscribed to characteristic '+ characteristic.uuid);
        }
    });
}

function printPeripheralDetails(peripheral){
    console.log('peripheral discovered (' + peripheral.id +
        ' with address <' + peripheral.address +  ', ' + peripheral.addressType + '>,' +
        ' connectable ' + peripheral.connectable + ',' +
        ' RSSI ' + peripheral.rssi + ':');
    console.log('\thello my local name is:');
    console.log('\t\t' + peripheral.advertisement.localName);
    console.log('\tcan I interest you in any of the following advertised services:');
    console.log('\t\t' + JSON.stringify(peripheral.advertisement.serviceUuids));
}