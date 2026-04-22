/**
* Casturria playout engine
* Promise-based mutex utility
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

/**
 * A simple mutex for protecting assets such as support layer handles from concurrent access.
 */

class Mutex {
  #promise: PromiseWithResolvers<void> = Promise.withResolvers();

  constructor() {
    //Start it's life in a resolved (unlocked) state.
    this.#promise.resolve();
  }

  /**
   * Waits until the lock is available.
   */
  async #obtainLock(): Promise<void> {
    while (true) {
      const promise = this.#promise;
      await promise.promise;
      //If the promise on the object has been changed, then someone else got the lock first, so we keep waiting.
      if (this.#promise === promise) {
        //Got it.
        this.#promise = Promise.withResolvers(); //The next one to come out of await sees that it lost and queues up on the new one.
        break;
      }
    }
  }

  /**
   * Obtains the lock, then executes the provided callback.
   * @param callback will be called when the lock is obtained.
   * @throws whatever the callback throws, but the lock will resolve in any case.
   * @returns whatever the callback returns.
   */
  async lock<t>(callback: () => Promise<t> | t): Promise<t> {
    await this.#obtainLock();
    try {
      return await callback();
    } catch (err) {
      throw err;
    } finally {
      this.#promise.resolve();
    }
  }
}

export { Mutex };
