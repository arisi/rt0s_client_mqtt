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
const path = require("path")
const JSON5 = require('json5');
const mqttsn = require("@rt0s/rt0s_client_mqtt");
const yargs = require('yargs');

console.log("RT0S Artifact Uploder");

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
  .option('schema', {
    description: 'Schema json5',
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
  .option('config', {
    description: 'Config as dict string',
    type: 'string',
    default: `{}`
  })
  .option('srec', {
    description: 'SREC file name',
    type: 'string',
  })
  .help()
  .alias('help', 'h').argv;

var files = [
  argv.hw,
  argv.syms,
  argv.srec,
]
console.log(argv);
console.log(files);

var symtab = (syms_fn) => {
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
  return [stub, symtab]
}

var config = JSON5.parse(fs.readFileSync('config.json5').toString())
var p = path.join(argv.path, config.af)
console.log( config.af, p);
fs.mkdirSync(p)
var conf = {}
for (var f of ['schema', 'hw', 'srec', 'config']) {
  var fn = path.basename(argv[f])
  fs.copyFileSync(argv[f], path.join(p, `${f}.json5`))
  conf[f] = fn
}
var [stub, syms] = symtab(argv.syms)
fs.writeFileSync(path.join(p, 'stub.S'), stub)
fs.writeFileSync(path.join(p, 'syms.json5'), JSON5.stringify(syms, null, 2))
fs.writeFileSync(path.join(p, 'manifest.json5'), JSON5.stringify(conf, null, 2))
