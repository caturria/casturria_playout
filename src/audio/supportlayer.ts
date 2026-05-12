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

/**
 * Internal event callback that translates casturria_support events into JS events.
 * @param code something from the enum defined in events.ts.
 * @param pMessage a pointer to a UTF8 string.
 */
type EventCallback = (code: number, pMessage: number) => void;

/**
 * A callback that can be registered to receive data written to a virtual device.
 * @param buffer a Uint8Array containing a copy of the data.
 */
type WriteCallback = (data: Uint8Array) => void;

/**
 * Pretend that this is the type returned by FS.mkdev().
 * The real type is unimportant, and it's largely undocumented anyway.
 * This is here only to allow a custom write callback to be attached to a device node.
 */
interface Node {
  writeCallback: WriteCallback;
}

/**
 * An oversimplified version of the type that gets passed as the first argument to a device's internal write callback.
 * The only thing we care about is the node field because we monkey-patch it with our own write callback.
 */
interface HasNode {
  node: Node;
}

/**
 * An oversimplified version of the type that FS.registerDevice() wants.
 * For now we only care about creating write-only virtual devices, so only the internal write callback is specified.
 */
interface VirtualDevice {
  //This is the write signature that Emscripten expects, minus the last couple of arguments that appear to always be 0 and undefined respectively.
  //This gets translated into the earlier WriteCallback type that the outside world sees.
  write: (
    hasNode: HasNode,
    mem: Uint8Array,
    pMem: number,
    size: number,
  ) => void;
}

/**
 * A simplified version of the options type that NODEFS wants (second argument to FS.mount).
 * Only the root field matters for now (it's the location in the VFS to which the host directory gets attached).
 */
interface Opts {
  root: string;
}

/**
 * An oversimplified representation of the type returned by FS.open().
 * All we need from this at present is to be able to extract the raw file descriptor.
 */
export interface FileStream {
  fd: number;
}

interface Instance {
  addFunction: (func: EventCallback, signature: string) => number;
  removeFunction: (handle: number) => void;
  cwrap: <t>(name: string, returnType: string, args: string[]) => t;
  UTF8ToString: (pointer: number) => string;
  stringToNewUTF8: (str: string) => number;
  HEAPF32: Float32Array;
  FS: {
    filesystems: {
      NODEFS: never;
    };
    mount: (fs: never, opts: Opts, realpath: string) => void;
    mkdir: (path: string) => never;
    makedev: (ma: number, mi: number) => number;
    registerDevice: (dev: number, ops: VirtualDevice) => Node;
    mkdev: (path: string, permissions: number, dev: number) => Node;
    readFile: (path: string, opts: {
      encoding: "binary" | "utf8";
      flags: string;
    }) => string | Uint8Array;
    writeFile: (path: string, data: string | ArrayBufferView, opts: {
      flags: string;
    }) => void;
    open(path: string, flags: string, mode: number): FileStream;
    close: (file: FileStream) => void;
  };
}

const SupportLayer: Instance = await SupportModule.default() as Instance;
const { FS } = SupportLayer;

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

//Admittedly arbitrary device ID for creating write-only virtual files.
const virtualFile = SupportLayer.FS.makedev(1024, 16);
SupportLayer.FS.registerDevice(virtualFile, {
  write: (hasNode: HasNode, mem: Uint8Array, pMem: number, size: number) => {
    hasNode.node.writeCallback(new Uint8Array(mem.slice(pMem, pMem + size)));
    return size;
  },
});

/**
 * Register a virtual file at the given path.
 * The data being written will be sent to the provided callback.
 */
function registerVirtualFile(path: string, write: WriteCallback): void {
  const node = SupportLayer.FS.mkdev(path, 0o777, virtualFile);
  node.writeCallback = write;
}

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
  FS,
  malloc,
  registerVirtualFile,
  SupportLayer as instance,
};
