/**
* Casturria playout engine
* FFmpeg-based file output
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

import { Output } from "output";
import { Station } from "station";
import { Encoder } from "encoder";
import { type AudioBuffer } from "station";

export class FileOutput extends Output {
  #encoder: Encoder;

  /**
   * Private constructor.
   * @param name a unique name for this output (E.G. "Opus at 192Kb/S").
   * @param encoder a preconfigured encoder.
   * @param station the station to associate this output with.
   */
  private constructor(name: string, encoder: Encoder, station: Station) {
    super(name, station);
    this.#encoder = encoder;
  }

  override sendFrame(buffer: AudioBuffer): void {
    this.#encoder.encode(buffer);
  }
  override close(): void {
    this.#encoder.finalize();
    this.#encoder.close();
    super.close();
  }

  /**
   * Creates a file-based output.
   * @param name a unique name for this station (E.G. "Opus at 192Kb/S)".
   * @param path the path to write to.
   * @param options an object containing protocol, format and codec private options.
   * @param station the station to associate this output with.
   */
  static make(
    name: string,
    path: string,
    options: object | null,
    station: Station,
  ): FileOutput {
    const encoder = new Encoder();
    try {
      encoder.open(path, station.sampleRate, station.channels, options);
      const output = new FileOutput(name, encoder, station);
      station.registerOutput(output);
      return output;
    } catch (err) {
      encoder.close();
      throw err;
    }
  }
}
