/**
* Casturria playout engine
* Station source base
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

/**
 * Station source.
 * A source, at its most basic level, is a thing that can supply a constant stream of audio data to a station.
 * The station need not know nor care how a source produces its data.
 * It could draw from a single audio file, rotate a playlist, pick tracks based on social media votes... just as long as it continuously produces samples in the station's input format.
 * Broadly speaking, sources come in two flavours:
 * Producers: these bring audio into the system from some external source (often a decoder). They are responsible for deciding exactly what a station is going to play.
 * Filters: as a rule, these collect audio data from a producer and process it to change what it sounds like. Compressors, limiters or what have you.
 */
export abstract class Source {
  #station: Station; //The station to which this source belongs.
  #currentRelay: Source | null = null; //Any source can be configured to relay another instead of producing its own frames.

  /**
   * Protected constructor.
   * @param station the station to which this source belongs (this determines its output format).
   */
  protected constructor(station: Station) {
    this.#station = station;
  }

  /**
   * Subclasses wishing to produce their own audio rather than relaying other sources should override this method.
   * Should only be called by stations.
   * Note: any source can be put into relay mode even if it's capable of independently producing frames.
   * @param frameSize maximum samples per channel to return.
   * @returns buffer of audio.
   * @throws {TypeError} if the source is not an independent producer.
   * A source must never return more samples than requested, but may at any time return fiewer.
   * This is to support sample-accurate transitions and similar functionality.
   */
  getLocalFrame(_frameSize: number): AudioBuffer {
    throw TypeError("This source is not an independent producer.");
  }

  /**
   * Subclasses wishing to perform transformations on existing audio should override this method.
   * @param buffer the source audio to consume.
   * @returns buffer of filtered audio.
   * Must not return more audio than provided.
   * This method simply returns the original buffer when called on sources that lack postprocessing functionality
   */
  postprocess(input: AudioBuffer): AudioBuffer {
    return input;
  }

  /**
   * This method is called by the station to obtain audio from the source.
   * Subclasses should never override this.
   * Instead, they should override getLocalFrame(), postprocess() or both.
   * @param frameSize the maximum number of samples per channel to return.
   * @returns a buffer of audio.
   * The returned buffer must never be larger than the requested frame size.
   * The returned buffer may at any time be smaller than the requested frame size.
   */
  getFrame(frameSize: number): AudioBuffer {
    if (this.#currentRelay === null) {
      return this.postprocess(this.getLocalFrame(frameSize));
    }
    return this.postprocess(this.#currentRelay.getFrame(frameSize));
  }
}
