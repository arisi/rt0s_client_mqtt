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
const srec = require('node-srec');

var schema = {}
var seq_cnt = 0
var bsize = 8;
var flash_top = 0x08020000;

var configurator = (C, srec_fn) => {
  var flash = []

  for (var [m, o] of Object.entries(schema.messages)) {
    if (!o.config) continue
    var obj = { topic: m }
    for (var f of o.payload) {
      if (f.name in C)
        obj[f.name] = C[f.name];
    }
    var [id, s] = encode(obj)
    flash.unshift(s.length)
    flash.unshift(...s)
  }

  var adjust = bsize - (flash.length % bsize)

  if (adjust)
    for (var i = adjust; i; i--)
      flash.unshift(0xff);
  var addr = flash_top - flash.length;

  var recs = {}
  recs[addr] = flash
  var bl = srec.blockify({ recs }, addr, flash_top, bsize);
  console.log(C);
  var s = ""
  for (a in bl) {
    var addr2 = parseInt(a);
    s += block2srec(addr + addr2 * bsize, bl[a]) + "\n";
  }
  fs.writeFileSync(srec_fn, s);
}

var encode = (payload) => {
  var bits = []
  var my_seq = seq_cnt
  var sch = schema.messages[payload.topic]
  for (b = 0; b < schema.config.seqlen; b++) {
    bits.push(seq_cnt & (1 << b) ? 1 : 0)
  }
  seq_cnt += 1
  seq_cnt &= (1 << (schema.config.seqlen)) - 1;
  for (b = 0; b < schema.config.idlen; b++) {
    bits.push(sch.id & (1 << b) ? 1 : 0)
  }
  var lens = []
  for (p of sch.payload) {
    if (p.type == "string") {
      if (p.name in payload)
        lens.push([`${p.name}_len`, payload[p.name].length])
      else {
        lens.push([`${p.name}_len`, 0])
        lens.push([p.name, ''])
      }
    }
  }
  for (var obj of lens) {
    payload[obj[0]] = obj[1];
  }
  console.log(payload)
  for (p of sch.payload) {
    var val = payload[p.name];
    var len = 0
    if (p.n != undefined) {
      if (typeof val == "string") {
        var data = [];
        for (var i = 0; i < val.length; i++) {
          data.push(val.charCodeAt(i));
        }
        val = data
      }
      if (typeof val != "object") {
        console.error("no array???");
        continue;
      }
      if (typeof p.n == "string")
        len = payload[p.n]
      else
        len = val.length;
    }
    if (len > 0) {
      for (i = 0; i < len; i++) {
        v = val[i]
        for (b = 0; b < p.size; b++) {
          bits.push(v & (1 << b) ? 1 : 0)
        }
      }

    } else {
      for (b = 0; b < p.size; b++) {
        bits.push(val & (1 << b) ? 1 : 0)
      }
    }
  }
  var bytes = Math.ceil(bits.length / 8)
  var ret = []
  for (byte = 0; byte < bytes; byte++) {
    var val = 0
    for (bit = 0; bit < 8 && bit + byte * 8 < bits.length; bit++) {
      var pos = bit + byte * 8;
      if (bits[pos])
        val |= 1 << bit
    }
    ret.push(val)
  }
  return [my_seq, ret]
}

var decode = (s) => {
  bits = [], bc = 0
  for (byte of s) {
    for (bit = 0; bit < 8; bit++) {
      bits[bc++] = (byte >> bit) & 1
    }
  }
  var pick = (size) => {
    var ret = 0;
    var i;
    for (i = 0; i < size; i++) {
      ret += bits.shift() * (1 << i)
    }
    return ret
  }
  var seq = pick(schema.config.seqlen)
  var id = pick(schema.config.idlen)
  if (schema.ids[id]) {
    var msg = schema.messages[schema.ids[id]]
    //console.log("msg: ", schema.ids[id], msg.payload);
    var payload = {
      topic: schema.ids[id],
      seq,
    }
    for (p of msg.payload) {
      var len = 0
      if (p.n != undefined) {
        if (typeof p.n == "string") {
          len = payload[p.n]
        } else
          len = p.n;
      }
      if (len) {
        payload[p.name] = []
        for (var i = 0; i < len; i++)
          payload[p.name].push(pick(p.size));
        if (p.type == "string") {
          payload[p.name] = String.fromCharCode.apply(null, payload[p.name]);
          delete (payload[p.name + "_len"])
        }
      } else
        payload[p.name] = pick(p.size);
    }
    return payload
  }
  console.log("bad msg id: ", id);
  return {}
}

var curr_schema_fn = "";

init = (schema_fn) => {
  if (schema_fn == curr_schema_fn)
    return;
  try {
    schema = JSON5.parse(fs.readFileSync(schema_fn).toString())
    schema.ids = []
    for (const [key, msg] of Object.entries(schema.messages)) {
      schema.ids[msg.id] = key
    }
    curr_schema_fn = schema_fn;
    return schema;
  } catch (error) {
    console.log("schema file missing", schema_fn);
    throw `schema file missing ${schema_fn}`
  }
}

module.exports = {
  init,
  decode,
  encode,
  configurator,
}
