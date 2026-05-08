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
import { type AudioBuffer, Station } from "station";
import { Logger } from "@logtape/logtape";

export abstract class Output {
  #name: string; //A unique name for this output (E.G. "Opus at 192Kb/s").
  #station: Station; //The station to which this output belongs.
  #logger: Logger;

  /**
   * Base constructor.
   * @param name a unique name for this output (E.G. "Opus at 192Kb/s").
   * @param station the station to associate this output with.
   */
  constructor(name: string, station: Station) {
    if (name.length === 0) {
      throw new RangeError(
        "The 'name' argument must contain at least one character.",
      );
    }

    this.#name = name;
    this.#station = station;
    this.#logger = station.logger.getChild(["Output", `<${name}>`]);
  }

  get station() {
    return this.#station;
  }

  get name() {
    return this.#name;
  }

  get logger() {
    return this.#logger;
  }

  /**
   * Allows the station to send an audio frame to this output.
   * @param buffer the audio to send.
   */
  abstract sendFrame(buffer: AudioBuffer): void;

  /**
   * Shuts down an output.
   * This should free encoders or other external resources held by the output.
   * Should be idempotent.
   * Subclasses must call super.close() after performing their own cleanup.
   */
  close(): void {
    this.#station.removeOutput(this);
  }
}
