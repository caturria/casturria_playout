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

import { AudioBase } from "./base.ts";
import * as SupportLayer from "./supportlayer.ts";
import * as Validation from "validation";
export type AudioBuffer = Float32Array<ArrayBuffer>;

export class FilterGraph extends AudioBase {
  #outSampleRate: number = 0; //of the outgoing audio.
  #outChannels: number = 0; //of the outgoing audio.
  #inputs: number = 0; //How many distinct inputs does the graph have? Available after open().
  #outputs: number = 0; //How many distinct outputs does the graph have? Available after open().

  /**
   * Constructor.
   * Constructs the object in an uninitialized state, because event listeners need to be bound before the decoder itself can be created.
   */
  constructor() {
    super();
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
  open(
    description: string,
    inSampleRate: number,
    inChannels: number,
    outSampleRate: number,
    outChannels: number,
  ) {
    this.verify(true);
    Validation.validateSampleRate(inSampleRate);
    Validation.validateChannelCount(inChannels);
    Validation.validateSampleRate(outSampleRate);
    Validation.validateChannelCount(outChannels);

    this.pHandle = SupportLayer.casturria_newFilterGraph(
      description,
      this.pCallbackHandle,
      inSampleRate,
      inChannels,
      outSampleRate,
      outChannels,
    );

    this.inChannels = inChannels;
    this.inSampleRate = inSampleRate;
    this.outChannels = outChannels;
    this.outSampleRate = outSampleRate;

    //Now that it's been opened, we can query it for the number of usable inputs and outputs.
    this.#inputs = SupportLayer.casturria_getFilterGraphInputs(
      this.pHandle,
    );
    this.#outputs = SupportLayer.casturria_getFilterGraphOutputs(this.pHandle);
  }

  get inputs() {
    return this.#inputs;
  }

  get outputs() {
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
  send(buffer: AudioBuffer | null, input: number) {
    this.verify();
    if (buffer !== null && buffer.length % this.inChannels != 0) {
      throw new RangeError(
        "The provided buffer's length must be divisible by the input channel count.",
      );
    }
    if (!Number.isSafeInteger(input)) {
      throw new TypeError("The 'input' argument must be an integer.");
    }

    if (input < 0 || input >= this.#inputs) {
      throw new RangeError("Out of range input for this filtergraph.");
    }
    const pMem = buffer === null
      ? 0
      : SupportLayer.malloc(buffer.length * Float32Array.BYTES_PER_ELEMENT);
    try {
      if (buffer !== null) {
        SupportLayer.instance.HEAPF32.set(
          buffer,
          pMem / Float32Array.BYTES_PER_ELEMENT,
        );
      }
      SupportLayer.casturria_sendInput(
        this.pHandle,
        pMem,
        buffer === null ? 0 : buffer.length / this.inChannels,
        input,
      );
    } finally {
      if (pMem !== 0) {
        SupportLayer.free(pMem);
      }
    }
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
  receive(desiredSamples: number, output: number): AudioBuffer {
    this.verify();
    if (
      !Number.isSafeInteger(output)
    ) {
      throw new TypeError("The 'input' argument must be an integer.");
    }
    if (output < 0 || output >= this.#outputs) {
      throw new RangeError("Out of range output for this filtergraph.");
    }
    const pMem = SupportLayer.malloc(
      desiredSamples * Float32Array.BYTES_PER_ELEMENT * this.outChannels,
    );
    try {
      const result = SupportLayer.casturria_receiveOutput(
        this.pHandle,
        pMem,
        desiredSamples,
        output,
      );
      const memOffset = pMem / Float32Array.BYTES_PER_ELEMENT;
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
   * Frees the external resources held by this filtergraph.
   * Idempotent.
   */
  override close() {
    if (this.pHandle !== null) {
      SupportLayer.casturria_freeFilterGraph(this.pHandle);
    }
    super.close();
  }
}
