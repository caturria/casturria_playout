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
import * as Errors from "errors";

export type StationToken = Record<PropertyKey, never>;
export type configureSourceCallback = () => void; //Temporary signature because Source doesn't exist yet.
export type configureOutputCallback = () => void; //Temporary signature because no outputs have been created yet.

const constructorKey = {};
let stationBeingConfiguredForInput: Station | null = null; //Refers to the station that's currently configuring sources.
let stationBeingConfiguredForOutput: Station | null = null; //Refers to the station that's currently configuring outputs.

export class Station {
  #name: string;
  #sampleRate: number;
  #channels: number;
  #logger: Logtape.Logger;
  #startTime: number = 0; //High-res timestamp when the station's clock was started.
  #running: boolean = false;
  #timeout: number = 0; //Current timeout ID while the station is running.
  #timeoutCallback: () => void; //Just an instance-bound tick() for use with setTimeout.
  #currentTick: Record<PropertyKey, never> = {}; //Used as an authenticator to prove that a call to a source or output came from the station.

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
  constructor(
    key: StationToken,
    name: string,
    sampleRate: number,
    channels: number,
  ) {
    if (key !== constructorKey) {
      throw new TypeError(
        "The 'Station' constructor is not part of the public API. Please call Station.configure instead.",
      );
    }
    this.#name = name;
    this.#sampleRate = Validation.validateSampleRate(sampleRate);
    this.#channels = Validation.validateChannelCount(channels);
    this.#logger = Logtape.getLogger(["Stations", name]);
    this.#timeoutCallback = this.#tick.bind(this);
  }

  /**
   * Internal: used by sources and outputs to confirm that a call came from the station.
   * @param token an empty object.
   * @returns true if the call came from the station.
   */
  verifyCallFromStation(token: Record<PropertyKey, never>) {
    if (token !== this.#currentTick) {
      throw new Errors.NotPublic();
    }
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
   * Configures a new station.
   * @param name the station's name for logging purposes.
   * @param sampleRate the station's output sampling rate.
   * @param channels the station's output channel count.
   * @param configureSourceCallback a function that configures and returns the station's input source.
   * @param configureOutputCallback a function that will configure and return the station's initial outputs.
   */
  static async configure(
    name: string,
    sampleRate: number,
    channels: number,
    configureSourceCallback: configureSourceCallback,
    configureOutputCallback: configureOutputCallback,
  ): Promise<Station> {
    if (
      stationBeingConfiguredForInput !== null ||
      stationBeingConfiguredForOutput !== null
    ) {
      throw new Errors.NotNestable(
        "Only one station can be configured at a time.",
      );
    }

    if (typeof configureSourceCallback !== "function") {
      throw new TypeError(
        "The 'configureSourceCallback' argument must be a function.",
      );
    }

    if (typeof configureOutputCallback !== "function") {
      throw new TypeError(
        "The 'configureOutputCallback' argument must be a function.",
      );
    }
    const station = new Station(constructorKey, name, sampleRate, channels);
    stationBeingConfiguredForInput = station;
    stationBeingConfiguredForOutput = station;
    try {
      await configureSourceCallback();
      await configureOutputCallback();
    } finally {
      stationBeingConfiguredForInput = null;
      stationBeingConfiguredForOutput = null;
    }

    station.#tick(); //It will continue on its own from here.
    return station;
  }

  /**
   * Stop the station from transmitting and clean up its resources.
   * Idempotent.
   */
  close() {
    this.#running = false;
    clearTimeout(this.#timeout);
  }
}
