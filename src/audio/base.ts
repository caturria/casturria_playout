/**
* Casturria playout engine
* Audio processing base
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
import * as SupportLayer from "./supportlayer.ts";
import * as Events from "./events.ts";
import * as Validation from "validation";

const { BadResource } = Deno.errors;

export class AudioBase extends EventTarget {
  #pHandle: number = 0; //Raw asset from the support layer.
  #callback: (code: number, pMessage: number) => void; //The support layer uses this callback to report various success/ failure events.
  #pCallbackHandle: number = 0; //Returned from addFunction().
  #closed: boolean = false; //used to make close idempotent.
  #inSampleRate: number = 0;
  #inChannels: number = 0;
  #outSampleRate: number = 0;
  #outChannels: number = 0;

  #lastError: string | null = null; //We can't throw an error from a support layer callback, so we use this to defer it.

  /**
   * Verifies that the object is in a state that makes sense for a particular operation.
   * @param forOpening if true, verifies that the encoder is ready to be opened. Otherwise verify that it's already opened.
   */
  protected verify(forOpening: boolean = false) {
    if (this.#closed === true) {
      throw new BadResource("This resource has already been closed.");
    }
    if (forOpening === true && this.#pHandle !== 0) {
      throw new BadResource("This resource has already been opened.");
    }
    if (forOpening !== true && this.#pHandle === 0) {
      throw new BadResource("This resource has not yet been opened.");
    }
  }

  constructor() {
    super();
    this.#callback = (code: number, pMessage: number): void => {
      const message = SupportLayer.instance.UTF8ToString(pMessage);
      if (code === Events.EventCodes.EVENTTYPE_SETUP_FAILURE) {
        this.#lastError = message;
        return;
      }
      this.dispatchEvent(
        new Events.AudioEvent(Events.translateEventType(code), code, message),
      );
    };
    this.#pCallbackHandle = SupportLayer.instance.addFunction(
      this.#callback,
      "vip",
    );
  }

  get inChannels(): number {
    return this.#inChannels;
  }

  protected set inChannels(channels: number) {
    this.#inChannels = Validation.validateChannelCount(channels);
  }

  get inSampleRate(): number {
    return this.#inSampleRate;
  }

  protected set inSampleRate(rate: number) {
    this.#inSampleRate = Validation.validateSampleRate(rate);
  }

  get outChannels(): number {
    return this.#outChannels;
  }

  protected set outChannels(channels: number) {
    this.#outChannels = Validation.validateChannelCount(channels);
  }

  get outSampleRate(): number {
    return this.#outSampleRate;
  }

  protected set outSampleRate(rate: number) {
    this.#outSampleRate = Validation.validateSampleRate(rate);
  }

  protected get pHandle() {
    return this.#pHandle;
  }

  protected set pHandle(pValue: number) {
    this.verify(true);
    this.#pHandle = pValue;
    if (this.#pHandle === 0) {
      throw new Error(this.#lastError ?? "Unknown error");
    }
  }

  protected get pCallbackHandle() {
    return this.#pCallbackHandle;
  }

  /**
   * Frees the external resources held by this encoder.
   * Idempotent.
   * Subclasses must override this to clean up their own resources.
   * They must also call super.close().
   */
  protected close() {
    if (this.#closed === false) {
      SupportLayer.instance.removeFunction(this.#pCallbackHandle);
      this.#closed = true;
    }
    this.#pHandle = 0;
    this.#inChannels = 0;
    this.#inSampleRate = 0;

    this.#outChannels = 0;
    this.#outSampleRate = 0;
  }

  [Symbol.dispose]() {
    this.close();
  }
}
