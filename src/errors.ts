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
 * An internal API was called from outside.
 * As a rule, this should be constructed with no arguments to use the default message.
 */

export class NotPublic extends Error {
  constructor(message?: string, options?: ErrorOptions) {
    super(message ?? "This method is not part of the public API.", options);
    this.name = "NotPublic";
  }
}

/**
 * Something that does not support nesting was used in a nested fashion
 */

export class NotNestable extends Error {
  constructor(message?: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "NotNestable";
  }
}
