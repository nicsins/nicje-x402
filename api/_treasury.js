// Generated from x403-harbinger lib/treasury.ts (TREASURY_ADDRESS + EIP-55 check). Edit there.
"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var treasury_exports = {};
__export(treasury_exports, {
  DEFAULT_TREASURY_ADDRESS: () => DEFAULT_TREASURY_ADDRESS,
  LEGACY_PAY_TO: () => LEGACY_PAY_TO,
  TREASURY_ADDRESS: () => TREASURY_ADDRESS,
  assertChecksumAddress: () => assertChecksumAddress,
  keccak256Hex: () => keccak256Hex,
  legacyMaxBlock: () => legacyMaxBlock,
  toChecksumAddress: () => toChecksumAddress
});
module.exports = __toCommonJS(treasury_exports);
const DEFAULT_TREASURY_ADDRESS = "0xc22f9CAEBAc37fE72D5142f35f21f6696Ea9Ef69";
const LEGACY_PAY_TO = ["0xDa1Eab46918882f8656a41cF9fCa80e2415369d1"];
const RC = [];
{
  let r = BigInt(1);
  for (let i = 0; i < 24; i++) {
    let rc = BigInt(0);
    for (let j = 0; j < 7; j++) {
      r = (r << BigInt(1) ^ (r >> BigInt(7)) * BigInt(113)) & BigInt(255);
      if (r & BigInt(2)) rc ^= BigInt(1) << (BigInt(1) << BigInt(j)) - BigInt(1);
    }
    RC.push(rc);
  }
}
const ROT = [0, 1, 62, 28, 27, 36, 44, 6, 55, 20, 3, 10, 43, 25, 39, 41, 45, 15, 21, 8, 18, 2, 61, 56, 14];
const M64 = (BigInt(1) << BigInt(64)) - BigInt(1);
const rotl = (x, n) => n === 0 ? x : (x << BigInt(n) | x >> BigInt(64 - n)) & M64;
function keccakF(s) {
  for (let round = 0; round < 24; round++) {
    const c = [0, 1, 2, 3, 4].map((x) => s[x] ^ s[x + 5] ^ s[x + 10] ^ s[x + 15] ^ s[x + 20]);
    for (let x = 0; x < 5; x++) {
      const d = c[(x + 4) % 5] ^ rotl(c[(x + 1) % 5], 1);
      for (let y = 0; y < 25; y += 5) s[x + y] = s[x + y] ^ d;
    }
    const b = new Array(25).fill(BigInt(0));
    for (let x = 0; x < 5; x++)
      for (let y = 0; y < 5; y++) b[y + 5 * ((2 * x + 3 * y) % 5)] = rotl(s[x + 5 * y], ROT[x + 5 * y]);
    for (let x = 0; x < 5; x++)
      for (let y = 0; y < 5; y++)
        s[x + 5 * y] = b[x + 5 * y] ^ ~b[(x + 1) % 5 + 5 * y] & M64 & b[(x + 2) % 5 + 5 * y];
    s[0] = s[0] ^ RC[round];
  }
}
function keccak256Hex(input) {
  const rate = 136;
  const padLen = rate - input.length % rate;
  const msg = new Uint8Array(input.length + padLen);
  msg.set(input);
  msg[input.length] ^= 1;
  msg[msg.length - 1] ^= 128;
  const s = new Array(25).fill(BigInt(0));
  for (let off = 0; off < msg.length; off += rate) {
    for (let i = 0; i < rate / 8; i++) {
      let lane = BigInt(0);
      for (let k = 7; k >= 0; k--) lane = lane << BigInt(8) | BigInt(msg[off + i * 8 + k]);
      s[i] = s[i] ^ lane;
    }
    keccakF(s);
  }
  let out = "";
  for (let i = 0; i < 4; i++) for (let k = 0; k < 8; k++) out += Number(s[i] >> BigInt(8 * k) & BigInt(255)).toString(16).padStart(2, "0");
  return out;
}
function toChecksumAddress(addr) {
  const lower = addr.toLowerCase().replace(/^0x/, "");
  const hash = keccak256Hex(new TextEncoder().encode(lower));
  let out = "0x";
  for (let i = 0; i < 40; i++) out += parseInt(hash[i], 16) >= 8 ? lower[i].toUpperCase() : lower[i];
  return out;
}
function assertChecksumAddress(addr, name = "TREASURY_ADDRESS") {
  if (!/^0x[0-9a-fA-F]{40}$/.test(addr)) throw new Error(`${name} is not a valid EVM address`);
  if (/^0x0{40}$/.test(addr)) throw new Error(`${name} must not be the zero address`);
  if (toChecksumAddress(addr) !== addr) throw new Error(`${name} is not EIP-55 checksummed`);
  return addr;
}
function clean(v) {
  return (v ?? "").trim().replace(/^["']|["']$/g, "");
}
const TREASURY_ADDRESS = assertChecksumAddress(clean(process.env.TREASURY_ADDRESS) || DEFAULT_TREASURY_ADDRESS);
function legacyMaxBlock() {
  const v = clean(process.env.LEGACY_PAY_TO_MAX_BLOCK);
  return /^\d+$/.test(v) ? BigInt(v) : null;
}
