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

import { SupportLayer } from "./supportlayer.ts";
import { Mutex } from "./mutex.ts";
import { Buffer } from "node:buffer";
import { EventCallback, EventCodes, makeEventCallback, AudioEvent } from "./events.ts";
import {validateChannelCount, validateSampleRate} from "./validation.ts";

export type AudioBuffer = Float32Array<ArrayBuffer>;

const { BadResource} = Deno.errors;

class Decoder extends EventTarget {
  #handle: Deno.PointerValue<unknown> | null = null; //Raw asset from the support layer.
  #callback: EventCallback; //The support layer uses this callback to report various success/ failure events.
  #closed: boolean = false; //used to make close idempotent.
  #mutex: Mutex = new Mutex(); //FFmpeg assets aren't threadsafe. Allow one nonblocking operation at a time.
  #channels: number; //number of output channels configured.
  #sampleRate: number; //the configured output sample rate.
  #lastError: string| null = null;//We can't throw an error from a support layer callback, so we use this to defer it.

  /**
   * Verifies that a decoder is in a usable state.
   * @param forOpening if true, verifies that the decoder is ready to be opened.
   */
  #verifyDecoder(forOpening: boolean = false)
  {
    if(this.#closed === true)
    {
      throw new BadResource("This decoder has already been closed.");
    }
    if(forOpening === true && this.#handle !== null)
    {
      throw new BadResource("This decoder has already been opened.");
    }
    if(forOpening !== true && this.#handle === null)
    {
      throw new BadResource("This decoder has not yet been opened.");
    }
  }

  /**
   * Constructor.
   * Constructs the object in an uninitialized state, because event listeners need to be bound before the decoder itself can be created.
   */
  constructor() {
    super();
    this.#channels = 0;
    this.#sampleRate = 0;
    this.#callback = makeEventCallback((code: number, type: string, message: string): void => {
      if(code === EventCodes.EVENTTYPE_SETUP_FAILURE)
      {
        this.#lastError = message;
        return;
      }
      this.dispatchEvent(new AudioEvent(type, code, message));
    });

  }

  /**
   * Opens the decoder.
   * @param url the asset to open for decoding.
   * @param sampleRate the sample rate to decode to.
   * @param channels the channel count to decode to.
   */
  async open(url: string, sampleRate: number, channels: number) {
    await this.#mutex.lock <void>(async () => {
      this.#verifyDecoder(true);
    let succeeded: boolean = false;
    this.#channels = validateChannelCount(channels);
    this.#sampleRate = validateSampleRate(sampleRate);
    try
    {
    this.#handle = await SupportLayer.symbols.casturria_newDecoder(
      Buffer.from(url),
      this.#callback.pointer,
      sampleRate,
      channels,
    );
    if (this.#handle === null) {
      throw new Error(this.#lastError ?? "Unknown error");
    }
    succeeded = true;
  }
  finally {
    if(succeeded === false)
    {
      await this.close();
    }
  }
});

  }

  get channels(): number {
    return this.#channels;
  }

  get sampleRate(): number {
    return this.#sampleRate;
  }

  /**
   * Attempts to decode some audio.
   * @param desiredSamples the desired number of samples per channel.
   * @returns {AudioBuffer} containing the requested number of samples per channel or fiewer.
   * @throws {BadResource} if the decoder has already been closed.
   */
  async decode(desiredSamples: number): Promise<AudioBuffer> {
    return await this.#mutex.lock<AudioBuffer>(async () => {
      this.#verifyDecoder();

      const buffer = new Float32Array(desiredSamples * this.#channels);
      this.#callback.ref(); //Prevent the event loop from shutting down while the callback could fire.
      const result = Number(
        await SupportLayer.symbols.casturria_decode(
          this.#handle,
          buffer,
          BigInt(desiredSamples),
        ),
      );
      this.#callback.unref();
      if (result < desiredSamples) {
        return buffer.slice(0, result * this.#channels);
      }
      return buffer;
    });
  }

  /**
   * Frees the external resources held by this decoder.
   * Idempotent.
   */
  async close() {
    return await this.#mutex.lock<void>(async () => {
      if (this.#handle !== null) {
        await SupportLayer.symbols.casturria_freeDecoder(this.#handle);
        this.#handle = null;
      }
      if (this.#closed === false) {
        this.#callback.close();
        this.#closed = true;
      }
    });
  }

  async [Symbol.dispose]() {
    await this.close();
  }
}

export { Decoder };
