/**
* Casturria playout engine
* Icecast output client.
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
import { Encoder } from "encoder";
import { AudioBuffer, Station } from "station";
import { FileStream } from "supportlayer";
import * as Support from "supportlayer";

export class IcecastOutput extends Output {
  #encoder: Encoder | null = null;
  #encoderOptions: Record<PropertyKey, unknown> = {}; //We structured clone this and keep it so it can be used for frequent encoder resets.
  #file: FileStream;
  #outputStream: ReadableStream;
  #url: string; //The Icecast URL including mountpoint.
  #source: string; //The Icecast server's source user name.
  #password: string; //The Icecast server's source password.

  /**
   * Private constructor.
   * @param name a unique name for this output (Can be same as the URL).
   * @param url to the target mountpoint on the Icecast server.
   * @param source the Icecast server's source user name.
   * @param password the Icecast server's source password.
   * @param options a list of FFmpeg format and codec private options.
   * @param station the station to which this output belongs.
   */
  private constructor(
    name: string,
    url: string,
    source: string,
    password: string,
    options: Record<PropertyKey, unknown>,
    station: Station,
  ) {
    super(name, station);
    this.#url = url;
    this.#source = source;
    this.#password = password;
    this.#encoderOptions = structuredClone(options);
    const tmpName = `icecast_${new TextEncoder().encode(name).toHex()}`;
    this.#outputStream = new ReadableStream({
      start: (controller: ReadableStreamDefaultController<Uint8Array>) => {
        Support.registerVirtualFile(tmpName, (buffer: Uint8Array) => {
          controller.enqueue(buffer);
        });
      },
    });

    this.#file = Support.FS.open(tmpName, "w", 0o777);
    this.#encoderOptions.fd = this.#file.fd;
  }

  /**
   * Tears down the encoder.
   */
  #closeEncoder() {
    if (this.#encoder !== null) {
      this.#encoder.finalize();
      this.#encoder.close();
      this.#encoder = null;
    }
  }

  /**
   * Tears down the encoder and builds a new one.
   * This method is called for a number of reasons:
   * 1) The output is undergoing initial setup.
   * 2) The connection to the icecast server was lost (ogg-based formats require a fresh state here).
   * 3) A metadata change occurred at the end of a song (ogg-based formats require a fresh state here).
   */
  #resetEncoder() {
    this.#closeEncoder();
    this.#encoder = new Encoder();
    this.#encoder.open(
      "fd:",
      this.station.sampleRate,
      this.station.channels,
      this.#encoderOptions,
    );
  }

  /**
   * Gets the appropriate mime type based on the configured audio format.
   */
  #getMimeType() {
    switch (this.#encoderOptions.format) {
      case "mp3":
        return "audio/mpeg";
      case "ogg":
        return "audio/ogg";
      default:
        return "application/octet-stream";
    }
  }

  /**
   * Builds the authorization header.
   */
  #getAuthorizationHeader(): string {
    const credentials = new TextEncoder().encode(
      `${this.#source}:${this.#password}`,
    ).toBase64();
    return `Basic ${credentials}`;
  }

  /**
   * Establishes the connection to the Icecast server.
   */
  async connect() {
    const response = await fetch(this.#url, {
      method: "put",
      body: this.#outputStream,
      keepalive: true,
      headers: {
        Authorization: this.#getAuthorizationHeader(),
        "Content-Type": this.#getMimeType(),
        "Transfer-Encoding": "chunked",
      },
    });
    //Icecast will not send a body, but we must pretend to expect one in order to keep the connection alive indefinitely.
    const reader = response.body?.getReader();
    reader?.read()
      .then((_v) => Deno.exit(0));
  }

  /**
   * Factory.
   * @param name a unique name for this output.
   * @param url the icecast URL including mountpoint.
   * @param source the source user name as specified by the Icecast server's configuration.
   * @param password the source password as specified by the Icecast server's configuration.
   * @param options a list of FFmpeg muxer and codec private options.
   * @param station the station to which this output will be associated.
   */
  static async make(
    name: string,
    url: string,
    source: string,
    password: string,
    options: Record<PropertyKey, unknown>,
    station: Station,
  ): Promise<Output> {
    const output = new IcecastOutput(
      name,
      url,
      source,
      password,
      options,
      station,
    );
    output.#resetEncoder();
    await output.connect();
    station.registerOutput(output);
    return output;
  }

  override sendFrame(frame: AudioBuffer): void {
    if (this.#encoder === null) {
      return;
    }
    this.#encoder.encode(frame);
  }
  override close(): void {
    this.#closeEncoder();
    Support.FS.close(this.#file);
  }
}
