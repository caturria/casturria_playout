/**
* Casturria playout engine
* Audio parameter validation rules
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

const minSampleRate = 2000;
const maxSampleRate = 192000;
const minChannels = 1;
const maxChannels = 6;

const {InvalidData} = Deno.errors;

/**
 * Verifies that a sample rate is within the acceptable range.
 * @param rate the value to validate.
 * @throws {InvalidData} if the supplied value is invalid.
 * @returns the supplied value.
 */
function validateSampleRate(rate: number): number
{
    if (
      !Number.isSafeInteger(rate) || rate < minSampleRate ||
      rate > maxSampleRate
    ) {
      throw new InvalidData(
        `The 'sampleRate' argument must be an integer between ${minSampleRate} and ${maxSampleRate}.`,
      );
    }
    return rate;

}

/**
 * Verifies that a channel count is within the acceptable range.
 * @param channels the channel count to validate.
 * @throws {BadData} if the supplied value is invalid.
 * @returns the supplied value.
 */
function validateChannelCount(channels: number): number
{
    if (
      !Number.isSafeInteger(channels) || channels < minChannels ||
      channels > maxChannels
    ) {
      throw new InvalidData(
        `The 'channels' argument must be an integer between ${minChannels} and ${maxChannels}.`,
      );
    }
return channels;
}
export {validateChannelCount, validateSampleRate};