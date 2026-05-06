/**
* Casturria playout engine
* Support layer bindings
* Copyright (C) 2026  Jordan Verner and contributors

* This program is free software: you can redistribute it and/or modify
* it under the terms of the GNU Affero General Public License as published by
* the Free Software Foundation, either version 3 of the License, or
* (at your option) any later version.

* This program is distributed in the hope that it will be useful,
* but WITHOUT ANY WARRANTY; without even the implied warranty of
* MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
* GNU Affero General Public License for more details.

* You should have received a copy of the GNU Affero General Public License
* along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import * as SupportModule from "@vendor/supportlayer";
type EventCallback = (code: number, message: number) => void;

interface Instance {
  addFunction: (func: EventCallback, signature: string) => number;
  removeFunction: (handle: number) => void;
  cwrap: <t>(name: string, returnType: string, args: string[]) => t;
  UTF8ToString: (pointer: number) => string;
  stringToNewUTF8: (str: string) => number;
  HEAPF32: Float32Array;
}

const SupportLayer: Instance = await SupportModule.default() as Instance;

const malloc: (size: number) => number = SupportLayer.cwrap(
  "malloc",
  "number",
  ["number"],
);
const free: (pointer: number) => void = SupportLayer.cwrap("free", "void", [
  "number",
]);

//Low level decoding:
const casturria_newDecoder: (
  url: string,
  pCallback: number,
  sampleRate: number,
  channels: number,
) => number = SupportLayer.cwrap("casturria_newDecoder", "number", [
  "string",
  "Function",
  "number",
  "number",
]);
const casturria_freeDecoder: (pDecoder: number) => void = SupportLayer.cwrap(
  "casturria_freeDecoder",
  "void",
  ["number"],
);
const casturria_decode: (
  pDecoder: number,
  pMem: number,
  size: number,
) => number = SupportLayer.cwrap("casturria_decode", "number", [
  "number",
  "number",
  "number",
]);

//Low level encoding:
const casturria_newEncoder: (
  url: string,
  callback: number,
  inSampleRate: number,
  inChannels: number,
  options: string,
) => number = SupportLayer.cwrap("casturria_newEncoder", "number", [
  "string",
  "Function",
  "number",
  "number",
  "string",
]);
const casturria_freeEncoder: (pEncoder: number) => void = SupportLayer.cwrap(
  "casturria_freeEncoder",
  "void",
  ["number"],
);
const casturria_finalizeEncoder: (pEncoder: number) => void = SupportLayer
  .cwrap("casturria_finalizeEncoder", "void", ["number"]);
const casturria_encode: (pDecoder: number, pMem: number, size: number) => void =
  SupportLayer.cwrap("casturria_encode", "number", [
    "number",
    "number",
    "number",
  ]);

//Low level filtering:
const casturria_newFilterGraph: (
  description: string,
  pCallback: number,
  inSampleRate: number,
  inChannels: number,
  outSampleRate: number,
  outChannels: number,
) => number = SupportLayer.cwrap("casturria_newFilterGraph", "number", [
  "string",
  "number",
  "number",
  "number",
  "number",
  "number",
]);
const casturria_freeFilterGraph: (pFilterGraph: number) => void = SupportLayer
  .cwrap("casturria_freeFilterGraph", "void", ["number"]);
const casturria_getFilterGraphInputs: (pFilterGraph: number) => number =
  SupportLayer.cwrap("casturria_getFilterGraphInputs", "number", ["number"]);
const casturria_getFilterGraphOutputs: (pFilterGraph: number) => number =
  SupportLayer.cwrap("casturria_getFilterGraphOutputs", "number", ["number"]);
const casturria_sendInput: (
  pFilterGraph: number,
  pMem: number,
  length: number,
  input: number,
) => void = SupportLayer.cwrap("casturria_sendInput", "void", [
  "number",
  "number",
  "number",
  "number",
]);
const casturria_receiveOutput: (
  pFilterGraph: number,
  pMem: number,
  desiredSamples: number,
  output: number,
) => number = SupportLayer.cwrap("casturria_receiveOutput", "number", [
  "number",
  "number",
  "number",
  "number",
]);

export type AudioBuffer = Float32Array<ArrayBuffer>;

export {
  casturria_decode,
  casturria_encode,
  casturria_finalizeEncoder,
  casturria_freeDecoder,
  casturria_freeEncoder,
  casturria_freeFilterGraph,
  casturria_getFilterGraphInputs,
  casturria_getFilterGraphOutputs,
  casturria_newDecoder,
  casturria_newEncoder,
  casturria_newFilterGraph,
  casturria_receiveOutput,
  casturria_sendInput,
  free,
  malloc,
  SupportLayer as instance,
};
