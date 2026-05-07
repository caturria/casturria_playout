import { Encoder } from "encoder";
import { expect } from "@std/expect";
const { BadResource } = Deno.errors;

Deno.test("Encoder should fail fast on invalid configuration", (_t: Deno.TestContext) => {
  using encoder = new Encoder();

  //This invalid URL will cause the encoder to complain about being unable to figure out an output format.
  expect(() => encoder.open("bad://fail", 48000, 2, {})).toThrow(
    "Unable to determine an appropriate output format",
  );

  //This is definitely a bogus protocol identifier.
  expect(() => encoder.open("bad://fail.mp3", 48000, 2, {})).toThrow(
    "Protocol not found",
  );

  //Posix-specific no such file or directory error (revisit this if we ever target native Windows).
  expect(() => encoder.open("file:/zz:/~/fail.mp3", 48000, 2, {})).toThrow(
    "No such file or directory",
  );

  //Inappropriate container / codec pair (gives vague "Invalid argument" error).
  expect(() =>
    encoder.open("file:./inappropriate_container_codec.ogg", 48000, 2, {
      codec: "libmp3lame",
    })
  ).toThrow("Invalid argument");

  //No such codec:
  expect(() =>
    encoder.open("file:./no_codec.ogg", 48000, 2, { codec: "libnosuchcodec" })
  ).toThrow("Invalid value 'libnosuchcodec'");

  //JSON keys with incorrectly-typed values.
  expect(() =>
    encoder.open("file:./incorrectly_typed.ogg", 48000, 2, {
      outSampleRate: "five",
      outChannels: "two",
    })
  ).toThrow("Problem while parsing a number");

  //Objects with circular references can't be serialized to JSON.
  const circular = { circle: {} };
  circular.circle = circular;
  expect(() => encoder.open("file:./circular.ogg", 48000, 2, circular)).toThrow(
    TypeError,
  );

  //Invalid sample rates and channel counts:
  expect(() => encoder.open("file:test.flac", -1031, 2, {})).toThrow(
    RangeError,
  );
  expect(() => encoder.open("file:test.flac", 44100.1031, 2, {})).toThrow(
    TypeError,
  );
  expect(() => encoder.open("file:test.flac", 44100, 255, {})).toThrow(
    RangeError,
  );
  expect(() => encoder.open("file:test.flac", 44100, 2.468, {})).toThrow(
    TypeError,
  );

  //The read-only encoder properties should still be zero because it hasn't been successfully opened.
  expect(encoder.inSampleRate).toStrictEqual(0);
  expect(encoder.inChannels).toBe(0);
});

Deno.test("Encoder should detect API abuse", (_t: Deno.TestContext) => {
  using encoder = new Encoder();
  //It shouldn't be possible to send data to an encoder that hasn't been opened.
  expect(() => encoder.encode(new Float32Array(128))).toThrow(BadResource);

  //It shouldn't be possible to finalize an encoder before starting it.
  expect(() => encoder.finalize()).toThrow(BadResource);

  //Should successfully open a file for writing in the current directory.
  expect(encoder.open("file:./test.mp3", 48000, 2, {})).toBeUndefined();

  //It's open, so another open call is improper API use.
  expect(() => encoder.open("file:./another_test.wav", 44100, 1, {})).toThrow(
    BadResource,
  );

  //The read-only properties shouldn't have been changed by the previous bad call:
  expect(encoder.inSampleRate).toStrictEqual(48000);
  expect(encoder.inChannels).toStrictEqual(2);

  //It shouldn't accept a misaligned sample buffer (not divisible by number of channels).
  expect(() => encoder.encode(new Float32Array(31))).toThrow(
    RangeError,
  );

  expect(encoder.finalize()).toBeUndefined();
  expect(encoder.close()).toBeUndefined();

  //The close() call should be idempotent:
  expect(encoder.close()).toBeUndefined();

  //The read-only properties should be zeroed out:
  expect(encoder.inChannels).toStrictEqual(0);
  expect(encoder.inSampleRate).toStrictEqual(0);

  //It shouldn't accept more input after it's been closed:
  expect(() => encoder.encode(new Float32Array(1024))).toThrow(
    BadResource,
  );

  //Nor should it accept another finalize command:
  expect(() => encoder.finalize()).toThrow(BadResource);

  //It can't be opened again:
  expect(() => encoder.open("file:./not_reusable.opus", 44100, 1, {}))
    .toThrow(BadResource);
});
