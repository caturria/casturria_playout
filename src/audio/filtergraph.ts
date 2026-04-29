/**
* Casturria playout engine
* Audio filtering wrapper
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

const { BadResource} = Deno.errors;

class FilterGraph extends EventTarget {
  //This is largely a duplicate of Decoder because JS lacks a reasonable way for a parent class to share private internals with a child. These FFI assets absolutely must be private.

  #handle: Deno.PointerValue<unknown> | null = null; //Raw asset from the support layer.
  #callback: Events.EventCallback; //The support layer uses this callback to report various success/ failure events.
  #closed: boolean = false; //used to make close idempotent.
  #mutex: Mutex = new Mutex(); //FFmpeg assets aren't threadsafe. Allow one nonblocking operation at a time.
  #inSampleRate: number = 0; //of the incoming audio.
  #inChannels: number = 0; //of the incoming audio.
  #outSampleRate: number = 0; //of the outgoing audio.
  #outChannels: number = 0; //of the outgoing audio.
  #inputs: number = 0; //How many distinct inputs does the graph have? Available after open().
  #outputs: number = 0; //How many distinct outputs does the graph have? Available after open().

  #lastError: string | null = null; //We can't throw an error from a support layer callback, so we use this to defer it.

  /**
   * Verifies that a filtergraph is in a usable state.
   * @param forOpening if true, verifies that the filtergraph is ready to be opened.
   */
  #verifyFilterGraph(forOpening: boolean = false) {
    if (this.#closed === true) {
      throw new BadResource("This filtergraph has already been closed.");
    }
    if (forOpening === true && this.#handle !== null) {
      throw new BadResource("This filtergraph has already been opened.");
    }
    if (forOpening !== true && this.#handle === null) {
      throw new BadResource("This filtergraph has not yet been opened.");
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
   * Opens the filtergraph.
   * @param description the FFmpeg filtergraph description.
   * @see https://ffmpeg.org/ffmpeg-filters.html
   * @param inSampleRate the sample rate of the incoming audio.
   * @param inChannels the channel count of the incoming audio.
   * @param outSampleRate the sampling rate of the outgoing audio.
   * @param outChannels the channel count of the outgoing audio.
   */
  async open(
    description: string,
    inSampleRate: number,
    inChannels: number,
    outSampleRate: number,
    outChannels: number,
  ) {
    await this.#mutex.lock<void>(async () => {
      this.#verifyFilterGraph(true);
      Validation.validateChannelCount(inChannels);
      Validation.validateSampleRate(inSampleRate);
      Validation.validateChannelCount(outChannels);
      Validation.validateSampleRate(outSampleRate);
        this.#handle = await SupportLayer.symbols.casturria_newFilterGraph(
          SupportLayer.toCString(description),
          this.#callback.pointer,
          inSampleRate,
          inChannels,
          outSampleRate,
          outChannels,
        );
        if (this.#handle === null) {
          throw new Error(this.#lastError ?? "Unknown error");
        }

        this.#inChannels = inChannels;
        this.#inSampleRate = inSampleRate;
        this.#outChannels = outChannels;
        this.#outSampleRate = outSampleRate;

        //Now that it's been opened, we can query it for the number of usable inputs and outputs.
        this.#inputs = Number(
          await SupportLayer.symbols.casturria_getFilterGraphInputs(
            this.#handle,
          ),
        );
        this.#outputs = Number(
          await SupportLayer.symbols.casturria_getFilterGraphOutputs(
            this.#handle,
          ),
        );
    });
  }

  get inChannels(): number {
    return this.#inChannels;
  }

  get inSampleRate(): number {
    return this.#inSampleRate;
  }

  get outChannels(): number {
    return this.#outChannels;
  }

  get outSampleRate(): number {
    return this.#outSampleRate;
  }

  get inputs()
  {
    return this.#inputs;
  }
  
  get outputs()
  {
    return this.#outputs;

  }

  /**
   * Attempts to send some audio through the filtergraph.
   * @param buffer a buffer of input audio (will be copied), or null to enter flush mode.
   * @param input the input to send the audio to.
   * @throws {BadResource} if the decoder has already been closed.
   * @throws {RangeError} if an invalid input is specified.
   * When there is no more input to filter, send a null buffer to flush the graph, then call receive until no more data comes out.
   */
  async send(buffer: AudioBuffer | null, input: number): Promise<void> {
    return await this.#mutex.lock<void>(async () => {
      this.#verifyFilterGraph();
          if (buffer !== null && buffer.length % this.#inChannels != 0) {
      throw new RangeError(
        "The provided buffer's length must be divisible by the input channel count.",
      );
    }
    if (!Number.isSafeInteger(input)) {
      throw new TypeError("The 'input' argument must be an integer.");
    }
    
    if(input < 0 || input >= this.#inputs) {
      throw new RangeError("Out of range input for this filtergraph.");
    }

    //We copy the buffer to prevent unsafe modification while the job is in flight.
    const bufferCopy = buffer === null ? null : new Float32Array(buffer);
      this.#callback.ref(); //Prevent the event loop from shutting down while the callback could fire.
      await SupportLayer.symbols.casturria_sendInput(
        this.#handle,
        bufferCopy,
        BigInt(bufferCopy === null ? 0 : bufferCopy.length / this.#inChannels),
        BigInt(input),
      );
      this.#callback.unref();
    });
  }

  /**
   * Attempts to obtain some filtered audio.
   * @param desiredSamples the desired number of samples per channel.
   * @param output the output to retrieve audio from.
   * @returns {AudioBuffer} containing the requested number of samples per channel or fiewer.
   * @throws {BadResource} if the decoder has already been closed.
   * @throws {RangeError} if an invalid output is specified.
   * If the filtergraph has not been flushed, this API will always return either the exact number of samples requested or none at all.
   * Once the graph has been flushed, the final calls may return a smaller final buffer and fire filterComplete.
   */
  async receive(desiredSamples: number, output: number): Promise<AudioBuffer> {
    return await this.#mutex.lock<AudioBuffer>(async () => {
      this.#verifyFilterGraph();
          if (
      !Number.isSafeInteger(output)) {
        throw new TypeError("The 'input' argument must be an integer.");
      }
      if(output < 0 || output >= this.#outputs
    ) {
      throw new RangeError("Out of range output for this filtergraph.");
    }

    const buffer = new Float32Array(desiredSamples * this.#outChannels);

      this.#callback.ref(); //Prevent the event loop from shutting down while the callback could fire.
      const result = Number(
        await SupportLayer.symbols.casturria_receiveOutput(
          this.#handle,
          buffer,
          BigInt(desiredSamples),
          BigInt(output),
        ),
      );
      this.#callback.unref();
      if (result < desiredSamples) {
        return buffer.slice(0, result * this.#outChannels);
      }
      return buffer;
    });
  }

  /**
   * Frees the external resources held by this filtergraph.
   * Idempotent.
   */
  async close() {
    return await this.#mutex.lock<void>(async () => {
      if (this.#handle !== null) {
        await SupportLayer.symbols.casturria_freeFilterGraph(this.#handle);
        this.#handle = null;
      }
      if (this.#closed === false) {
        this.#callback.close();
        this.#closed = true;
      }
      this.#inChannels = 0;
      this.#inSampleRate = 0;
      this.#outChannels = 0;
      this.#outSampleRate = 0;
    });
  }

  async [Symbol.asyncDispose]() {
    await this.close();
  }
}

export { FilterGraph };
