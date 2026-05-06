/**
* Casturria playout engine
* Audio encoding wrapper
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

export class Encoder extends AudioBase {
  /**
   * Constructor.
   * Constructs the object in an uninitialized state, because event listeners need to be bound before the encoder itself can be created.
   */
  constructor() {
    super();
  }

  /**
   * Opens the encoder.
   * @param url the asset to open for encoding.
   * @param sampleRate the sample rate of the incoming audio.
   * @param channels the channel count of the incoming audio.
   * @param options an optional list of codec, muxer and protocol private options.
   */
  open(
    url: string,
    sampleRate: number,
    channels: number,
    options: object | null,
  ) {
    this.verify(true);
    Validation.validateSampleRate(sampleRate);
    Validation.validateChannelCount(channels);
    const json = JSON.stringify(options ?? {});
    this.pHandle = SupportLayer.casturria_newEncoder(
      url,
      this.pCallbackHandle,
      sampleRate,
      channels,
      json,
    );
    this.inChannels = channels;
    this.inSampleRate = sampleRate;
  }

  /**
   * Attempts to encode some audio.
   * @param buffer a buffer of input audio (will be copied).
   * @throws {BadResource} if the decoder has already been closed.
   */
  encode(buffer: AudioBuffer): void {
    this.verify();
    if (buffer.length % this.inChannels != 0) {
      throw new RangeError(
        "The provided buffer's length must be divisible by the input channel count.",
      );
    }
    const pMem = SupportLayer.malloc(
      buffer.length * Float32Array.BYTES_PER_ELEMENT,
    );
    try {
      SupportLayer.instance.HEAPF32.set(
        buffer,
        pMem / Float32Array.BYTES_PER_ELEMENT,
      );
      SupportLayer.casturria_encode(
        this.pHandle,
        pMem,
        buffer.length / this.inChannels,
      );
    } finally {
      SupportLayer.free(pMem);
    }
  }

  /**
   * Drains the encoder and writes the final few frames.
   * To be called once before the encoder is closed.
   */
  finalize() {
    this.verify();
    SupportLayer.casturria_finalizeEncoder(this.pHandle);
  }

  /**
   * Frees the external resources held by this encoder.
   * Idempotent.
   */
  override close() {
    if (this.pHandle !== 0) {
      SupportLayer.casturria_freeEncoder(this.pHandle);
    }
    super.close();
  }
}
