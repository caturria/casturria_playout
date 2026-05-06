/**
* Casturria playout engine
* Audio decoding wrapper
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

import { AudioBase } from "./base.ts";
import * as SupportLayer from "./supportlayer.ts";
import * as Validation from "validation";

export type AudioBuffer = Float32Array<ArrayBuffer>;

export class Decoder extends AudioBase {
  /**
   * Constructor.
   * Constructs the object in an uninitialized state, because event listeners need to be bound before the decoder itself can be created.
   */
  constructor() {
    super();
  }

  /**
   * Opens the decoder.
   * @param url the asset to open for decoding.
   * @param sampleRate the sample rate to decode to.
   * @param channels the channel count to decode to.
   */
  open(url: string, sampleRate: number, channels: number) {
    this.verify(true);
    Validation.validateChannelCount(channels);
    Validation.validateSampleRate(sampleRate);
    this.pHandle = SupportLayer.casturria_newDecoder(
      url,
      this.pCallbackHandle,
      sampleRate,
      channels,
    );

    this.outChannels = channels;
    this.outSampleRate = sampleRate;
  }

  /**
   * Attempts to decode some audio.
   * @param desiredSamples the desired number of samples per channel.
   * @returns {AudioBuffer} containing the requested number of samples per channel or fiewer.
   * @throws {BadResource} if the decoder has already been closed.
   */
  decode(desiredSamples: number): AudioBuffer {
    this.verify();
    const pMem = SupportLayer.malloc(
      desiredSamples * this.outChannels * Float32Array.BYTES_PER_ELEMENT,
    );
    try {
      const memOffset = pMem / Float32Array.BYTES_PER_ELEMENT; //Index into HEAPF32.
      const result = SupportLayer.casturria_decode(
        this.pHandle,
        pMem,
        desiredSamples,
      );
      return new Float32Array(
        SupportLayer.instance.HEAPF32.slice(
          memOffset,
          memOffset + (result * this.outChannels),
        ),
      );
    } finally {
      SupportLayer.free(pMem);
    }
  }

  /**
   * Frees the external resources held by this decoder.
   * Idempotent.
   */
  override close() {
    if (this.pHandle !== 0) {
      SupportLayer.casturria_freeDecoder(this.pHandle);
    }
    super.close();
  }
}
