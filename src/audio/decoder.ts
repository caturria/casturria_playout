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

type EventCallback = Deno.UnsafeCallback<
  { readonly parameters: readonly ["u32", "pointer"]; readonly result: "void" }
>;
export type AudioBuffer = Float32Array<ArrayBuffer>;

const { BadResource, InvalidData } = Deno.errors;

//Singleton EventHandler instance for all decoders.
const eventHandler = SupportLayer.symbols.casturria_newEventHandler();

const minSampleRate = 2000;
const maxSampleRate = 192000;
const minChannels = 1;
const maxChannels = 6;

/**
 * A callback for use with the support layer's event handler.
 * @param type the event that was triggered.
 * @param details the event details returned from the support layer.
 */
function eventCallback(
  type: number,
  _details: Deno.PointerValue<unknown>,
): void {
  console.log(`Got event ${type}`);
}

const privateKey = {}; //prevent outside construction.

class Decoder {
  #handle: Deno.PointerValue<unknown> | null = null; //Raw asset from the support layer.
  #callback: EventCallback; //The support layer uses this callback to report various success/ failure events.
  #callbackFreed: boolean = false; //used to make free idempotent.
  #mutex: Mutex = new Mutex(); //FFmpeg assets aren't threadsafe. Allow one nonblocking operation at a time.
  #channels: number; //number of output channels configured.
  #sampleRate: number; //the configured output sample rate.

  /**
   * Private constructor.
   * Constructs the object in an uninitialized state, because the callback needs to be bound before the decoder itself can be created.
   * @param key private constructor key.
   */
  constructor(key: unknown) {
    if (key !== privateKey) {
      throw new Deno.errors.NotSupported(
        "Decoder does not support external construction.",
      );
    }
    this.#channels = 0;
    this.#sampleRate = 0;
    this.#callback = new Deno.UnsafeCallback({
      parameters: ["u32", "pointer"],
      result: "void",
    }, eventCallback.bind(this));
  }

  /**
   * Creates a new decoder.
   * @param url the asset to open for decoding.
   * @param sampleRate the sample rate to decode to.
   * @param channels the channel count to decode to.
   */
  static async make(url: string, sampleRate: number, channels: number) {
    if (
      !Number.isSafeInteger(sampleRate) || sampleRate < minSampleRate ||
      sampleRate > maxSampleRate
    ) {
      throw new InvalidData(
        `The 'sampleRate' argument must be an integer between ${minSampleRate} and ${maxSampleRate}.`,
      );
    }

    if (
      !Number.isSafeInteger(channels) || channels < minChannels ||
      channels > maxChannels
    ) {
      throw new InvalidData(
        `The 'channels' argument must be an integer between ${minChannels} and ${maxChannels}.`,
      );
    }

    const decoder = new Decoder(privateKey);
    decoder.#channels = channels;
    decoder.#sampleRate = sampleRate;
    decoder.#handle = await SupportLayer.symbols.casturria_newDecoder(
      Buffer.from(url),
      eventHandler,
      decoder.#callback.pointer,
      sampleRate,
      channels,
    );
    if (decoder.#handle === null) {
      throw new Error(
        "Todo: get some event handling implemented so we know why we fail.",
      );
    }
    return decoder;
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
      if (this.#handle === null) {
        throw new BadResource("This decoder has already been closed.");
      }

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
      if (this.#callbackFreed === false) {
        this.#callback.close();
        this.#callbackFreed = true;
      }
    });
  }

  async [Symbol.dispose]() {
    await this.close();
  }
}

export { Decoder };
