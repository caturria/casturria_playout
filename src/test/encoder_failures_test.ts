import { Encoder } from "encoder";
import { expect } from "@std/expect";
const { BadResource } = Deno.errors;

Deno.test("Encoder should fail fast on invalid configuration", async (_t: Deno.TestContext) => {
  await using encoder = new Encoder();

  //This invalid URL will cause the encoder to complain about being unable to figure out an output format.
  await expect(encoder.open("bad://fail", 48000, 2, {})).rejects.toThrow(
    "Unable to determine an appropriate output format",
  );

  //This is definitely a bogus protocol identifier.
  await expect(encoder.open("bad://fail.mp3", 48000, 2, {})).rejects.toThrow(
    "Protocol not found",
  );

  //Posix-specific no such file or directory error (revisit this if we ever target native Windows).
  await expect(encoder.open("file:/zz:/~/fail.mp3", 48000, 2, {})).rejects
    .toThrow("No such file or directory");

  //Inappropriate container / codec pair (gives vague "Invalid argument" error).
  await expect(
    encoder.open("file:./inappropriate_container_codec.ogg", 48000, 2, {
      codec: "libmp3lame",
    }),
  ).rejects.toThrow("Invalid argument");

  //This one leaves a junk file behind:
  await expect(Deno.remove("./inappropriate_container_codec.ogg")).resolves
    .toBeUndefined();

  //No such codec:
  await expect(
    encoder.open("file:./no_codec.ogg", 48000, 2, { codec: "libnosuchcodec" }),
  ).rejects.toThrow("Invalid value 'libnosuchcodec'");

  //JSON keys with incorrectly-typed values.
  await expect(
    encoder.open("file:./incorrectly_typed.ogg", 48000, 2, {
      outSampleRate: "five",
      outChannels: "two",
    }),
  ).rejects.toThrow("Problem while parsing a number");

  //Objects with circular references can't be serialized to JSON.
  const circular = { circle: {} };
  circular.circle = circular;
  await expect(encoder.open("file:./circular.ogg", 48000, 2, circular)).rejects
    .toThrow(TypeError);

  //Invalid sample rates and channel counts:
  await expect(encoder.open("file:test.flac", -1031, 2, {})).rejects.toThrow(
    RangeError,
  );
  await expect(encoder.open("file:test.flac", 44100.1031, 2, {})).rejects
    .toThrow(TypeError);
  await expect(encoder.open("file:test.flac", 44100, 255, {})).rejects.toThrow(
    RangeError,
  );
  await expect(encoder.open("file:test.flac", 44100, 2.468, {})).rejects
    .toThrow(TypeError);

  //The read-only encoder properties should still be zero because it hasn't been successfully opened.
  expect(encoder.sampleRate).toStrictEqual(0);
  expect(encoder.channels).toBe(0);
});

Deno.test("Encoder should detect API abuse", async (_t: Deno.TestContext) => {
  await using encoder = new Encoder();
  //It shouldn't be possible to send data to an encoder that hasn't been opened.
  await expect(encoder.encode(new Float32Array(128))).rejects.toThrow(
    "This encoder has not yet been opened.",
  );

  //It shouldn't be possible to finalize an encoder before starting it.
  await expect(encoder.finalize()).rejects.toThrow(BadResource);

  //Should successfully open a file for writing in the current directory.
  await expect(encoder.open("file:./test.mp3", 48000, 2, {})).resolves
    .toBeUndefined();

  //It's open, so another open call is improper API use.
  await expect(encoder.open("file:./another_test.wav", 44100, 1, {})).rejects
    .toThrow(BadResource);

  //The read-only properties shouldn't have been changed by the previous bad call:
  expect(encoder.sampleRate).toStrictEqual(48000);
  expect(encoder.channels).toStrictEqual(2);

  //It shouldn't accept a misaligned sample buffer (not divisible by number of channels).
  await expect(encoder.encode(new Float32Array(31))).rejects.toThrow(
    RangeError,
  );

  //The encoder shouldn't allow multiple operations to happen in parallel. The runtime will crash if this doesn't hold because encoders aren't threadsafe.
  for (let i = 0; i < 1000; i++) {
    encoder.encode(new Float32Array(1024));
  }
  encoder.finalize();

  //This close() call would crash if it happened too early:
  await expect(encoder.close()).resolves.toBeUndefined();

  //Cleanup:
  await expect(Deno.remove("./test.mp3")).resolves.toBeUndefined();

  //The close() call should be idempotent:
  await expect(encoder.close()).resolves.toBeUndefined();

  //The read-only properties should be zeroed out:
  expect(encoder.channels).toStrictEqual(0);
  expect(encoder.sampleRate).toStrictEqual(0);

  //It shouldn't accept more input after it's been closed:
  await expect(encoder.encode(new Float32Array(1024))).rejects.toThrow(
    BadResource,
  );

  //Nor should it accept another finalize command:
  await expect(encoder.finalize()).rejects.toThrow(BadResource);

  //It can't be opened again:
  await expect(encoder.open("file:./not_reusable.opus", 44100, 1, {})).rejects
    .toThrow(BadResource);
});
