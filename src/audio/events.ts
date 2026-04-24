/**
* Casturria playout engine
* Support layer event translation
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

//This list originates from and should remain in sync with src/events.h from casturria_support (https://github.com/caturria/casturria_support).

enum EventCodes {
          /**
         * A milestone was reached during setup.
         */
        EVENTTYPE_SETUP_MILESTONE,

        /**
         * A failure occurred during setup.
         */
        EVENTTYPE_SETUP_FAILURE,

        /**
         * Demuxing of an audio asset is complete.
         */
        EVENTTYPE_DEMUX_COMPLETE,

        /**
         * Decoding of an audio asset is complete.
         */
        EVENTTYPE_DECODE_COMPLETE,

        /**
         * A filter graph has reached the end of its input.
         */
        EVENTTYPE_FILTER_COMPLETE,

        /**
         * A failure occurred during operation.
         */
        EVENTTYPE_OPERATION_FAILURE,

        /**
         * An error occurred while writing packets to an output file.
         * This is the key event to watch for while streaming to a network-based protocol such as Icecast.
         */
        EVENTTYPE_OUTPUT_ERROR,

}

export type EventCallback = Deno.UnsafeCallback<
  { readonly parameters: readonly ["u32", "buffer"]; readonly result: "void" }>

  /**
   * Converts a type code into a string suitable for use with EventTarget.
   * @param code the type code to translate.
   */
  function translateEventType(type: number): string
  {
        switch(type)
        {
                case EventCodes.EVENTTYPE_DECODE_COMPLETE:
                        return "decodeComplete";
                        case EventCodes.EVENTTYPE_FILTER_COMPLETE:
                                return "filterComplete";
                                case EventCodes.EVENTTYPE_DEMUX_COMPLETE:
                                        return "demuxComplete";
                                        case EventCodes.EVENTTYPE_OPERATION_FAILURE:
                                                return "operationFailure";
                                                case EventCodes.EVENTTYPE_OUTPUT_ERROR:
                                                        return "outputError";
                                                        case EventCodes.EVENTTYPE_SETUP_FAILURE:
                                                                return "setupFailure";
                                                                case EventCodes.EVENTTYPE_SETUP_MILESTONE:
                                                                        return "setupMilestone";
                                                                        default:
                                                                                return "unknownEvent";

        }
  }

/**
 * Creates an event callback for use with the support layer.
 * @param callback the function to call after translation.
 */
function makeEventCallback(callback: (code: number, type: string, message: string) => void): EventCallback
{

            return new Deno.UnsafeCallback({
      parameters: ["u32", "buffer"],
      result: "void",
    }, (type: number, message: Deno.PointerValue <unknown>) => callback(type, translateEventType(type), message === null? "<Message unavailable>": Deno.UnsafePointerView.getCString(message)));

}

/**
 * An event representing a message about an encoder, decoder ETC from the support layer.
 */
class AudioEvent extends Event
{
        code: EventCodes;
        message: string;

        /**
         * Constructor.
         * @param type the type of event.
         * @param code the raw support layer event code.
         * @param message the message returned from the support layer.
         */
        constructor(type: string, code: EventCodes, message: string)
        {
                super(type);
                this.code = code;
                this.message = message;
        }

}

export { EventCodes, AudioEvent, makeEventCallback};
