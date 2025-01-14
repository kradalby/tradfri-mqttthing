/**
 * Homebridge-MQTTThing Codec (encoder/decoder) for IKEA Trådfri bulbs.
 */

"use strict";

const conv = require("./cie-rgb-converter.js");

/**
 * Initialise codec for accessory
 * @param {object} params Initialisation parameters object
 * @param {function} params.log Logging function
 * @param {object} params.config Configuration
 * @return {object} Encode and/or decode functions
 */
exports.init = function(params) {
  // extract parameters for convenience
  let { log, config } = params;
  log(`Trådfri codec initialized with ${config.name}.`);

  return {
    /**
     * Encode message before sending.
     * The output function may be called to deliver an encoded value for the property later.
     * @param {string} message Message from mqttthing to be published to MQTT
     * @param {object} info Object giving contextual information
     * @param {string} info.topic MQTT topic to be published
     * @param {string} info.property Property associated with publishing operation
     * @param {function} output Function which may be called to deliver the encoded value asynchronously
     * @returns {string} Processed message (optionally)
     */
    function(message, info, output) {
      log(
        `encode() called for topic [${info.topic}], property [${info.property}] with message [${message}]`
      );

      output(message); // no-op
    },

    /**
     * Decode received message, and optionally return decoded value.
     * The output function may be called to deliver a decoded value for the property later.
     * @param {string} message Message received from MQTT
     * @param {object} info Object giving contextual information
     * @param {string} info.topic MQTT topic received
     * @param {string} info.property Property associated with subscription
     * @param {function} output Function which may be called to deliver the decoded value asynchronously
     * @returns {string} Processed message (optionally)
     */
    function(message, info, output) {
      // eslint-disable-line no-unused-vars
      log(
        `decode() called for topic [${info.topic}], property [${info.property}] with message [${message}]`
      );

      output(message); // no-op
    },

    properties: {
      on: {
        encode: function(message) {
          return JSON.stringify({ state: message ? "ON" : "OFF" });
        },

        decode: function(message) {
          const msg = JSON.parse(message);
          if (msg.state) {
            return msg.state == "ON";
          }
        },
      },

      brightness: {
        encode: function(message) {
          // scale up to 0-254 range
          const brightness = Math.round(message * 2.54);

          return JSON.stringify({
            state: brightness ? "ON" : "OFF",
            brightness: brightness,
          });
        },

        decode: function(message) {
          // scale down to 0-100 range
          const msg = JSON.parse(message);
          if (msg.brightness) {
            return Math.round(msg.brightness / 2.54);
          }
        },
      },

      colorTemperature: {
        // To IKEA
        encode: function(message) {
          let ikeaMax = 454;
          let ikeaMin = 250;
          let ikeaRange = ikeaMax - ikeaMin;

          let zigbeeMax = 500;
          let zigbeeMin = 140;
          let zigbeeRange = zigbeeMax - zigbeeMin;

          const colorTemp = Math.round(
            ((message - zigbeeMin) * ikeaRange) / zigbeeRange + ikeaMin
          );

          return JSON.stringify({
            color_temp: colorTemp,
          });
        },

        // To HomeKit
        decode: function(message) {
          let ikeaMax = 454;
          let ikeaMin = 250;
          let ikeaRange = ikeaMax - ikeaMin;

          let zigbeeMax = 500;
          let zigbeeMin = 140;
          let zigbeeRange = zigbeeMax - zigbeeMin;

          const msg = JSON.parse(message);
          if (msg.color_temp) {
            let colorTemp = Math.round(
              ((msg.color_temp - ikeaMin) * zigbeeRange) / ikeaRange + zigbeeMin
            );
            return colorTemp;
          }
        },
      },

      RGB: {
        encode: function(message) {
          log(`RGB encode request: ${message}`);

          const rgb = message.split(","),
            // http://www.w3.org/TR/AERT#color-contrast
            brightness = Math.round(
              0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]
            );

          let response = JSON.stringify({
            state: brightness ? "ON" : "OFF",
            brightness: brightness,
            color: { r: +rgb[0], g: +rgb[1], b: +rgb[2] },
          });

          log(`RGB encode response: ${response}`);

          return response;
        },

        decode: function(message) {
          log(`RGB decode request: ${message}`);

          const msg = JSON.parse(message);
          if (msg.color) {
            const rgb = conv.cie_to_rgb(
              msg.color.x,
              msg.color.y,
              msg.brightness
            );
            return rgb.join(",");
          }
        },
      },
    },
  };
};
