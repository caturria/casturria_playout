/**
* Casturria playout engine
* Station output base
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
import * as Validation from "validation";
import { Station, type StationToken } from "station";
import { Logger } from "@logtape/logtape";

export type AudioBuffer = Float32Array<ArrayBuffer>;

type ReceiveFrameCallback = (token: StationToken, buffer: AudioBuffer) => void;
type CloseCallback = (token: StationToken) => void;

export class Output {
  #name: string; //A unique name for this output (E.G. "Opus at 192Kb/s").
  #receiveFrame: ReceiveFrameCallback; //A private callback used by the station to submit frames.
  #close: CloseCallback; //A private callback used by the station when an output is no longer needed.
  #sampleRate: number; //Refers to outgoing audio. The incoming rate is expected to be the station's rate.
  #channels: number; //Refers to outgoing audio. The input channel count is expected to be the station's count.
  #station: Station; //The station to which this output belongs.
  #logger: Logger;

  /**
   * Base constructor.
   * @param name a unique name for this output (E.G. "Opus at 192Kb/s").
   * @param sampleRate the sampling rate that this output will output.
   * @param channels the channel count that this output will output.
   * @param receiveFrame a callback that will receive frames from the station and transmit them (provided by subclasses).
   * @param close a callback that will be used by the station when this output is no longer needed.
   * @param station the station that this output belongs to.
   */
  constructor(
    name: string,
    sampleRate: number,
    channels: number,
    receiveFrame: ReceiveFrameCallback,
    close: CloseCallback,
    station: Station,
  ) {
    if (typeof name !== "string") {
      throw new TypeError("The 'name' argument must be a string.");
    }

    if (name.length === 0) {
      throw new RangeError(
        "The 'name' argument must contain at least one character.",
      );
    }
    this.#name = name;

    this.#sampleRate = Validation.validateSampleRate(sampleRate);
    this.#channels = Validation.validateChannelCount(channels);
    if (typeof receiveFrame !== "function") {
      throw new TypeError("The 'receiveFrame' argument must be a function.");
    }

    this.#receiveFrame = receiveFrame;
    if (typeof close !== "function") {
      throw TypeError("The 'close argument must be a function.");
    }
    this.#close = close;

    if (!(station instanceof Station)) {
      throw new TypeError("The 'station' argument must be a Station instance.");
    }

    this.#station = station;
    this.#logger = station.logger.getChild(["Output", name]);
  }

  get sampleRate() {
    return this.#sampleRate;
  }

  get channels() {
    return this.#channels;
  }

  get station() {
    return this.#station;
  }

  get logger() {
    return this.#logger;
  }

  /**
   * Allows the station to send an audio frame to this output.
   * Not to be overridden by subclasses: the station will call the base implementation.
   * @param token the station's token.
   * @param buffer the audio to send.
   */
  sendFrame(token: Record<PropertyKey, never>, buffer: AudioBuffer) {
    this.#station.verifyCallFromStation(token);
    this.#receiveFrame(token, buffer);
  }

  /** */
}
