#!/usr/bin/env node

/******************************************************************************/
/*                                                                            */
/* RT0S Client Mqtt                                                           */
/*                                                                            */
/* Copyright (c) 2023, Rt0s Global Ltd                                        */
/* All Rights Reserved                                                        */
/*                                                                            */
/******************************************************************************/

const fs = require("fs")
const JSON5 = require('json5');
const mqttsn = require("../rt0s_client_mqtt.js");
const yargs = require('yargs');

console.log("configurator");

const argv = yargs
  .option('schema', {
    description: 'Base Schema json5',
    type: 'string',
    default: `base_mqtt.json5`
  })
  .option('config', {
    description: 'Config as dict string',
    type: 'string',
    default: `{}`
  })
  .option('srec', {
    description: 'SREC file name',
    type: 'string',
    default: `a.srec`
  })
  .help()
  .alias('help', 'h').argv;

mqttsn.init(argv.schema)
var C = JSON5.parse(argv.config)
mqttsn.configurator(C,'example.srec')