/**
* Casturria playout engine
* Support layer FFI bindings
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

const SUPPORT_PATH =
  "/home/caturria/casturria_support/lib/libcasturria_support.so"; //Very temporary.
const SupportLayer = Deno.dlopen(SUPPORT_PATH, {

  //Decoding:

  casturria_newDecoder: {
    parameters: ["buffer", "function", "u32", "u8"],
    result: "pointer",
    nonblocking: true,
  },
  casturria_freeDecoder: {
    parameters: ["pointer"],
    result: "void",
    nonblocking: true,
  },
  casturria_decode: {
    parameters: ["pointer", "buffer", "usize"],
    result: "usize",
    nonblocking: true,
  },

  //Encoding:

  casturria_newEncoder: {
    parameters: ["buffer", "function", "u32", "u8", "buffer"],
    result: "pointer",
    nonblocking: true,
  },
  casturria_freeEncoder: {
    parameters: ["pointer"],
    result: "void",
    nonblocking: true,
  },
  casturria_encode: {
    parameters: ["pointer", "buffer", "usize"],
    result: "void",
    nonblocking: true,
  },
  casturria_finalizeEncoder: {
    parameters: ["pointer"],
    result: "void",
    nonblocking: true,
  },

  //Filter graph:

  casturria_newFilterGraph: {
    parameters: ["buffer", "function", "u32", "u8", "u32", "u8"],
    result: "pointer",
    nonblocking: true,
  },
  casturria_freeFilterGraph: {
    parameters: ["pointer"],
    result: "void",
    nonblocking: true,
  },
  casturria_getFilterGraphInputs: {
    parameters: ["pointer"],
    result: "usize",
    nonblocking: true,
  },
  casturria_getFilterGraphOutputs: {
    parameters: ["pointer"],
    result: "usize",
    nonblocking: true,
  },
  casturria_sendInput: {
    parameters: ["pointer", "buffer", "usize", "usize"],
    result: "bool",
    nonblocking: true,
  },
  casturria_receiveOutput: {
    parameters: ["pointer", "buffer", "usize", "usize"],
    result: "usize",
    nonblocking: true,
  },
});
export { SupportLayer };
