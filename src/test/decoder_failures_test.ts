import { Decoder } from "decoder";
import { Encoder } from "encoder";
import { expect } from "@std/expect";
import * as SupportLayer from "supportlayer";
import { fstat } from "node:fs";
const { BadResource } = Deno.errors;
Deno.test("Decoder should fail fast on invalid configuration", (_t: Deno.TestContext) => {
  using decoder = new Decoder();

  //This is definitely a bogus protocol identifier.
  expect(() => decoder.open("bad://fail.mp3", 48000, 2)).toThrow(
    "Protocol not found",
  );

  //Posix-specific no such file or directory error (revisit this if we ever target native Windows).
  expect(() => decoder.open("file:/zz:/~/fail.mp3", 48000, 2)).toThrow(
    "No such file or directory",
  );

  //Invalid sample rates and channel counts:
  expect(() => decoder.open("file:test.flac", -1031, 2)).toThrow(
    RangeError,
  );
  expect(() => decoder.open("file:test.flac", 44100.1031, 2)).toThrow(
    TypeError,
  );
  expect(() => decoder.open("file:test.flac", 44100, 255)).toThrow(
    RangeError,
  );
  expect(() => decoder.open("file:test.flac", 44100, 2.468)).toThrow(
    TypeError,
  );
  //The read-only decoder properties should still be zero because it hasn't been successfully opened.
  expect(decoder.outSampleRate).toStrictEqual(0);
  expect(decoder.outChannels).toBe(0);
});

Deno.test("Decoder should detect API abuse", (_t: Deno.TestContext) => {
  using decoder = new Decoder();

  //Can't decode if it hasn't been opened:
  expect(() => decoder.decode(1024)).toThrow(BadResource);

  //Encode some nothingness just so we have something to open:
  using encoder = new Encoder();
  expect(encoder.open("file:test.flac", 48000, 2, {})).toBeUndefined();
  expect(encoder.encode(new Float32Array(86420))).toBeUndefined();
  expect(encoder.close()).toBeUndefined();

  //Corrupt the file by reading and writing it as a UTF-8 string:
  const buffer = SupportLayer.FS.readFile("test.flac", {encoding: "binary", flags: "r"}) as Uint8Array;
  const corrupted = new TextDecoder().decode(buffer, {});

  expect(
    SupportLayer.FS.writeFile(
      "./corrupted.flac",
      corrupted,
    {flags: "w"}),
  ).toBeUndefined();

  //The decoder should not be able to open this file:
  expect(() => decoder.open("file:./corrupted.flac", 48000, 2)).toThrow(
    "Invalid data found when processing input",
  );

  //Attempt to double-open the valid file:
  expect(decoder.open("file:./test.flac", 48000, 2)).toBeUndefined();
  expect(() => decoder.open("file:test.flac", 48000, 2)).toThrow(
    BadResource,
  );

  //The read-only properties shouldn't have been changed by the previous bad call:
  expect(decoder.outSampleRate).toStrictEqual(48000);
  expect(decoder.outChannels).toStrictEqual(2);

  expect(decoder.close()).toBeUndefined();

  //The close() call should be idempotent:
  expect(decoder.close()).toBeUndefined();

  //The read-only properties should be zeroed out:
  expect(decoder.outSampleRate).toStrictEqual(0);
  expect(decoder.outChannels).toStrictEqual(0);

  //It shouldn't try to decode again:
  expect(() => decoder.decode(32)).toThrow(BadResource);

  //It can't be opened again either:
  expect(() => decoder.open("file:./test.flac", 48000, 2)).toThrow(
    BadResource,
  );
});
