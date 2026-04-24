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

import * as SupportLayer from "./supportlayer.ts";
import { Mutex } from "./mutex.ts";
import * as Events from "./events.ts";
import * as Validation from "./validation.ts";
export type AudioBuffer = Float32Array<ArrayBuffer>;

const { BadResource, InvalidData } = Deno.errors;

class Encoder extends EventTarget {
  //This is largely a duplicate of Decoder because JS lacks a reasonable way for a parent class to share private internals with a child. These FFI assets absolutely must be private.

  #handle: Deno.PointerValue<unknown> | null = null; //Raw asset from the support layer.
  #callback: Events.EventCallback; //The support layer uses this callback to report various success/ failure events.
  #closed: boolean = false; //used to make close idempotent.
  #mutex: Mutex = new Mutex(); //FFmpeg assets aren't threadsafe. Allow one nonblocking operation at a time.
  #sampleRate: number = 0; //of the incoming audio.
  #channels: number = 0; //of the incoming audio.

  #lastError: string | null = null; //We can't throw an error from a support layer callback, so we use this to defer it.

  /**
   * Verifies that an encoder is in a usable state.
   * @param forOpening if true, verifies that the encoder is ready to be opened.
   */
  #verifyEncoder(forOpening: boolean = false) {
    if (this.#closed === true) {
      throw new BadResource("This encoder has already been closed.");
    }
    if (forOpening === true && this.#handle !== null) {
      throw new BadResource("This encoder has already been opened.");
    }
    if (forOpening !== true && this.#handle === null) {
      throw new BadResource("This encoder has not yet been opened.");
    }
  }

  /**
   * Constructor.
   * Constructs the object in an uninitialized state, because event listeners need to be bound before the decoder itself can be created.
   */
  constructor() {
    super();
    this.#callback = Events.makeEventCallback(
      (code: number, type: string, message: string): void => {
        if (code === Events.EventCodes.EVENTTYPE_SETUP_FAILURE) {
          this.#lastError = message;
          return;
        }
        this.dispatchEvent(new Events.AudioEvent(type, code, message));
      },
    );
  }

  /**
   * Opens the encoder.
   * @param url the asset to open for encoding.
   * @param sampleRate the sample rate of the incoming audio.
   * @param channels the channel count of the incoming audio.
   * @param options an optional list of codec, muxer and protocol private options.
   */
  async open(
    url: string,
    sampleRate: number,
    channels: number,
    options: object | null,
  ) {
    const json = JSON.stringify(options ?? {});

    await this.#mutex.lock<void>(async () => {
      this.#verifyEncoder(true);
      let succeeded: boolean = false;
      this.#channels = Validation.validateChannelCount(channels);
      this.#sampleRate = Validation.validateSampleRate(sampleRate);
      try {
        this.#handle = await SupportLayer.symbols.casturria_newEncoder(
          SupportLayer.toCString(url),
          this.#callback.pointer,
          sampleRate,
          channels,
          SupportLayer.toCString(json),
        );
        if (this.#handle === null) {
          throw new Error(this.#lastError ?? "Unknown error");
        }
        succeeded = true;
      } finally {
        if (succeeded === false) {
          this.close(); //Don't await or it's a deadlock!
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
   * Attempts to encode some audio.
   * @param buffer a buffer of input audio (will be copied).
   * @throws {BadResource} if the decoder has already been closed.
   */
  async encode(buffer: AudioBuffer): Promise<void> {
    if (buffer.length % this.#channels != 0) {
      throw new InvalidData(
        "The provided buffer's length must be divisible by the input channel count.",
      );
    }
    //We copy the buffer to prevent unsafe modification while the job is in flight.
    const bufferCopy = new Float32Array(buffer);
    return await this.#mutex.lock<void>(async () => {
      this.#verifyEncoder();
      this.#callback.ref(); //Prevent the event loop from shutting down while the callback could fire.
      await SupportLayer.symbols.casturria_encode(
        this.#handle,
        bufferCopy,
        BigInt(buffer.length / this.#channels),
      );
      this.#callback.unref();
    });
  }

  /**
   * Drains the encoder and writes the final few frames.
   * To be called once before the decoder is closed.
   */
  async finalize() {
    await this.#mutex.lock<void>(async () => {
      await SupportLayer.symbols.casturria_finalizeEncoder(this.#handle);
    });
  }

  /**
   * Frees the external resources held by this encoder.
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

export { Encoder };
