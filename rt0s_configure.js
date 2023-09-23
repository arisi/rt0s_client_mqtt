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
const mqttsn = require("@rt0s/rt0s_client_mqtt");
const yargs = require('yargs');

console.log("RT0S Configurator");

const uuidv4 = () => {
  var result, i, j
  result = ''
  for (j = 0; j < 32; j++) {
    if (j == 8 || j == 12 || j == 16 || j == 20) result = result + '-'
    i = Math.floor(Math.random() * 16).toString(16).toUpperCase()
    result = result + i
  }
  return result
}

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

//var C = JSON5.parse(argv.config)
var C = {
  ...JSON5.parse(argv.config),
  af: uuidv4(),
}
mqttsn.configurator(C, argv.srec)
fs.writeFileSync('config.json5', JSON5.stringify(C, null, 2))