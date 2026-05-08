/**
* Casturria playout engine
* Application-specific errors
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
 * Something requiring a unique key reports that the key has already been taken.
 */
export class AlreadyTaken extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "AlreadyTaken";
  }
}

/**
 * Invalid operation (such as starting a station that's already running).
 */
export class InvalidOperation extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    name = "InvalidOperation";
  }
}
