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
const path = require("path")
var AdmZip = require("adm-zip");

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
  .option('path', {
    description: 'Path to artifact repository',
    type: 'string',
  })
  .option('hw', {
    description: 'HW schema json5',
    type: 'string',
  })
  .option('syms', {
    description: 'Symbols schema json5',
    type: 'string',
  })
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
    description: 'SREC file to write name (serno)',
    type: 'string',
    default: `a.srec`
  })
  .option('fw_srec', {
    description: 'Firmware SREC file name',
    type: 'string',
    default: `a.srec`
  })
  .help()
  .alias('help', 'h').argv;


console.log("RT0S Configurator phase serialization");

mqttsn.init(argv.schema)
var af = uuidv4()
//var C = JSON5.parse(argv.config)
console.log(argv.config);
var C = {
  ...JSON5.parse(argv.config),
  af,
}
mqttsn.configurator(C, argv.srec)
console.log("RT0S Configurator phase serialization done");

// artefact phase

var symtab = (syms_fn) => {
  console.log("RT0S Configurator phase symtab", syms_fn);

  //defunct -- needs to be run at build time
  var symtab = []
  for (var line of fs.readFileSync(syms_fn).toString().split("\n")) {
    var hit = line.match(/(\d+): +(\w+) +(\d+) +(\w+) +(\w+) +(\w+) +(\d+) (.+)$/)
    if (hit) {
      var a =
        o = {
          value: parseInt(hit[2], 16),
          size: parseInt(hit[3]),
          type: hit[4],
          bind: hit[5],
          name: hit[8],
        }
      if (o.name != "" && o.name[0] != '$')
        symtab.push(o)
    }
  }
  symtab = symtab.sort((a, b) => {
    return a.value - b.value;
  })

  var stub = "  .syntax unified\n  .section stub\n\n";
  for (var o of symtab) {
    if (o.type == "FUNC") {
      var addr = sprintf("%08X", o.value);
      stub += `  .type ${o.name},%function\n`
      stub += `  .global ${o.name}\n`
      stub += `  .set ${o.name},0x${addr}\n\n`
    } else if (o.type == "OBJECT") {
      var addr = sprintf("%08X", o.value);
      stub += `  .type ${o.name},%object\n`
      stub += `  .global ${o.name}\n`
      stub += `  .set ${o.name},0x${addr}\n\n`
    }
  }
  console.log("RT0S Configurator phase symtab done");

  return [stub, symtab]
}

console.log("RT0S Configurator phase artefact");

var p = path.join(argv.path, af)
console.log(af, p);
try {
  fs.mkdirSync(p)
} catch (error) {

}
var inc_p = path.join(argv.path, af, 'inc')
try {
  fs.mkdirSync(inc_p)
} catch (error) {

}

var conf = {}
for (var f of ['schema', 'hw', 'fw_srec', 'srec']) {
  var fn = path.basename(argv[f])
  var tfn = path.join(p, `${f}.json5`)
  console.log("doin", f, argv[f], tfn);
  fs.copyFileSync(argv[f], tfn)
  conf[f] = fn
}
console.log("RT0S Configurator phase artefact done");
var [stub, syms] = symtab(argv.syms)
fs.writeFileSync(path.join(p, 'stub.S'), stub)
fs.writeFileSync(path.join(p, 'syms.json5'), JSON5.stringify(syms, null, 2))
fs.writeFileSync((argv.syms.replace('.syms','_syms'))+'.json5', JSON5.stringify(syms, null, 2))
fs.writeFileSync(path.join(p, 'manifest.json5'), JSON5.stringify(conf, null, 2))
fs.writeFileSync(path.join(p, 'config.json5'), JSON5.stringify(C, null, 2))

for (var inc of fs.readdirSync('./inc')) {
  fs.copyFileSync(path.join('./inc', inc), path.join(inc_p, inc))
}

var zip = new AdmZip();
zip.addLocalFolder(p)
var afn = path.join(argv.path, `${af}.zip`)
zip.writeZip(afn);
