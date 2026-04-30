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

class Station {
  #name: string;
  #sampleRate: number;
  #channels: number;
  #logger: Logtape.Logger;
  #startTime: number = 0; //High-res timestamp when the station's clock was started.
  #running: boolean = false;
  #timeout: number = 0; //Current timeout ID while the station is running.
  #timeoutCallback: () => void; //Just an instance-bound tick() for use with setTimeout.

  /**
   * Pulls the next frame from the station's source and sends it to all configured outputs.
   */
  #tick() {
    this.#timeout = setTimeout(this.#timeoutCallback, 1000); //Temporary.
  }

  /**
   * Constructor.
   * @param name the station's name.
   * @param sampleRate the station's output sampling rate.
   * @param channels the station's output channel count.
   */
  constructor(name: string, sampleRate: number, channels: number) {
    this.#name = name;
    this.#sampleRate = Validation.validateSampleRate(sampleRate);
    this.#channels = Validation.validateChannelCount(channels);
    this.#logger = Logtape.getLogger(["Stations", name]);
    this.#timeoutCallback = this.#tick.bind(this);
  }

  get sampleRate() {
    return this.#sampleRate;
  }

  get channels() {
    return this.#channels;
  }

  get logger() {
    return this.#logger;
  }

  /**
   * Starts up the station.
   * It will begin sending audio data from its source to its inputs at a regular cadence.
   * @throws if the station is already running.
   */
  start() {
    if (this.#running === true) {
      throw new Error("This station is already running.");
    }
    this.#tick(); //It will run by itself from here.
  }

  /**
   * Stop the station from transmitting.
   * Idempotent.
   */
  stop() {
    this.#running = false;
    clearTimeout(this.#timeout);
  }
}
export { Station };
