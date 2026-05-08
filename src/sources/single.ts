/**
* Casturria playout engine
* Single-use track station source
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

import { Source } from "source";
import { Decoder } from "decoder";
import { type AudioBuffer, Station } from "station";

/**
 * A consumable source that plays a single audio track once.
 * Generally, one would not attach this source to a station directly as it becomes spent after playing one audio track.
 * This is the basic building block for higher-level track based producers.
 */

export class Single extends Source {
  #decoder: Decoder;

  /**
   * Private constructor.
   * @param decoder the decoder to source audio from.
   * @param station the station to which this source belongs.
   */
  private constructor(decoder: Decoder, station: Station) {
    super(station);
    this.#decoder = decoder;
  }

  override getLocalFrame(frameSize: number): AudioBuffer {
    return this.#decoder.decode(frameSize);
  }

  /**
   * Factory.
   * @param path the URL to decode from.
   * @param station the station to which this source belongs.
   */
  static make(path: string, station: Station) {
    const decoder = new Decoder();
    try {
      decoder.open(path, station.sampleRate, station.channels);
      return new Single(decoder, station);
    } catch (err) {
      decoder.close();
      throw err;
    }
  }
}
