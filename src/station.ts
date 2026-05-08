/**
* Casturria playout engine
* Station controller
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

import * as Validation from "./audio/validation.ts";
import * as Logtape from "@logtape/logtape";
import { Output } from "output";
import * as Errors from "errors";
import { Source } from "source";

export type AudioBuffer = Float32Array<ArrayBuffer>;
const minFrameSize = 64;
const maxFrameSize = 65536;

export class Station {
  #name: string;
  #sampleRate: number;
  #channels: number;
  #logger: Logtape.Logger;
  #startTime: number = 0; //High-res timestamp when the station's clock was started.
  #samplesPlayed: number = 0; //Total samples emitted since the station was started. Used to keep the clock speed accurate.
  #running: boolean = false;
  #timeout: number = 0; //Current timeout ID while the station is running.
  #timeoutCallback: () => void; //Just an instance-bound tick() for use with setTimeout.
  #outputs: Map<string, Output> = new Map();
  #currentSource: Source | null = null;
  #frameSize: number = 0; //How many samples per channel to process per step?

  /**
   * Pulls the next frame from the station's source and sends it to all outputs.
   */
  #tick() {
    //Get next frame of music ready:
    const frame = (this.#currentSource as Source).getFrame(this.#frameSize);
    //Immediately transmit it:
    this.#outputs.forEach((output) => output.sendFrame(frame as AudioBuffer));
    //We're slightly ahead of schedule now (unless this was the first frame).
    //Find out how much time we still have before that frame was due:
    let timeToTransmition = this.#getTimeToNextTransmition();
    if (timeToTransmition < 0) {
      //Todo: handle running late here.
      //The first batch of samples after station start is due immediately, so a late result is expected.
      timeToTransmition = 0;
    }
    //Rest until the frame we just dispatched comes due
    this.#timeout = setTimeout(this.#timeoutCallback, timeToTransmition);
    //Update the clock so that it reflects when the next frame will be due:
    this.#samplesPlayed += frame.length / this.#channels;
  }

  /**
   * Determines how long the station should wait before transmitting its next batch of samples.
   * Procedure:
   * Convert total number of samples transmitted to a duration in milliseconds.
   * Then subtract time elapsed since station started.
   */
  #getTimeToNextTransmition() {
    return ((this.#samplesPlayed / this.#sampleRate) * 1000) -
      (performance.now() - this.#startTime);
  }

  /**
   * Constructor.
   * @param name the station's name.
   * @param sampleRate the station's output sampling rate.
   * @param channels the station's output channel count.
   * @param frameSize how many samples per channel to process per step?
   */
  constructor(
    name: string,
    sampleRate: number,
    channels: number,
    frameSize: number,
  ) {
    if (name.length === 0) {
      throw new RangeError(
        "The 'length' argument must not be an empty string.",
      );
    }
    if (!Number.isSafeInteger(frameSize)) {
      throw new TypeError("The 'frameSize' argument must be an integer.");
    }
    if (frameSize < minFrameSize || frameSize > maxFrameSize) {
      throw new RangeError(
        `The 'frameSize' argument must be an integer between ${minFrameSize} and ${maxFrameSize}.`,
      );
    }
    this.#name = name;
    this.#sampleRate = Validation.validateSampleRate(sampleRate);
    this.#channels = Validation.validateChannelCount(channels);
    this.#logger = Logtape.getLogger(["Stations", name]);
    this.#timeoutCallback = this.#tick.bind(this);
    this.#frameSize = frameSize;
  }

  get sampleRate() {
    return this.#sampleRate;
  }

  get channels() {
    return this.#channels;
  }

  get name() {
    return this.#name;
  }

  get logger() {
    return this.#logger;
  }

  get frameSize() {
    return this.#frameSize;
  }

  /**
   * Checks if an output name has already been registered with the station.
   * @throws {Errors.AlreadyTaken} if it has.
   */
  verifyOutputNameAvailability(name: string): void {
    if (this.#outputs.has(name)) {
      throw new Errors.AlreadyTaken(
        `An input called '${name}' is already registered with station '${this.#name}'.`,
      );
    }
  }

  /**
   * Registers an output with a station.
   * Should only be called by output factories.
   * @param output the output being registered.
   * @throws {Errors.AlreadyTaken} if an output by that name is already registered.
   */
  registerOutput(output: Output): void {
    this.verifyOutputNameAvailability(output.name);
    this.#outputs.set(name, output);
  }

  /**
   * Unregisters an output.
   * Idempotent.
   * The outside world can either call this, or call close() on the respective output.
   * @param output the output to remove.
   */
  removeOutput(output: Output): void {
    if (this.#outputs.has(output.name)) {
      this.#outputs.delete(output.name);
      output.close(); //Close will call here again, but it's already deleted so it doesn't recurse.
    }
  }

  /**
   * Starts up the station.
   * @param source the source to play from.
   */
  start(source: Source): void {
    if (this.#running === true) {
      throw new Errors.InvalidOperation("This station is already running.");
    }
    this.#currentSource = source;
    this.#startTime = performance.now();
    this.#samplesPlayed = 0;
    this.#tick(); //It will run itself from here.
  }

  /**
   * Stop the station from transmitting and clean up its resources.
   * Idempotent.
   */
  close() {
    this.#running = false;
    clearTimeout(this.#timeout);
    this.#outputs.forEach((output) => output.close());
  }
}
