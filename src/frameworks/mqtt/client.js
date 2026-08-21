const mqtt = require('mqtt');
const { config } = require('../../config/config');
const logger = require('../helpers/logger');

let client

function connectMqtt(){
    client = mqtt.connect(config.mqtt.brokerUrl,{
        username: config.mqtt.username,
        password: config.mqtt.password
    })

    client.on('connect', ()=> {
        logger.info('[MQTT] Connected to broker');
    });

    client.on('error', (err) => {
        logger.error('[MQTT] Connection error:', err.message);
    });

  return client;
}

function getClient(){
    if (!client){
        throw new Error('MQTT client belum diinisialisasi, panggil connectMqtt() dulu')
    }

    return client
}

module.exports = {connectMqtt,getClient}
