import { Decoder } from "decoder";
import { Encoder } from "encoder";
import { expect } from "@std/expect";
const { BadResource } = Deno.errors;
Deno.test("Decoder should fail fast on invalid configuration", async (_t: Deno.TestContext) => {
  await using decoder = new Decoder();

  //This is definitely a bogus protocol identifier.
  await expect(decoder.open("bad://fail.mp3", 48000, 2)).rejects.toThrow(
    "Protocol not found",
  );

  //Posix-specific no such file or directory error (revisit this if we ever target native Windows).
  await expect(decoder.open("file:/zz:/~/fail.mp3", 48000, 2)).rejects.toThrow(
    "No such file or directory",
  );

  //Invalid sample rates and channel counts:
  await expect(decoder.open("file:test.flac", -1031, 2)).rejects.toThrow(
    RangeError,
  );
  await expect(decoder.open("file:test.flac", 44100.1031, 2)).rejects.toThrow(
    TypeError,
  );
  await expect(decoder.open("file:test.flac", 44100, 255)).rejects.toThrow(
    RangeError,
  );
  await expect(decoder.open("file:test.flac", 44100, 2.468)).rejects.toThrow(
    TypeError,
  );
  //The read-only decoder properties should still be zero because it hasn't been successfully opened.
  expect(decoder.sampleRate).toStrictEqual(0);
  expect(decoder.channels).toBe(0);
});
Deno.test("Decoder should detect API abuse", async (_t: Deno.TestContext) => {
  await using decoder = new Decoder();

  //Can't decode if it hasn't been opened:
  await expect(decoder.decode(1024)).rejects.toThrow(BadResource);

  //Encode some nothingness just so we have something to open:
  await using encoder = new Encoder();
  await expect(encoder.open("file:test.flac", 48000, 2, {})).resolves
    .toBeUndefined();
  await expect(encoder.encode(new Float32Array(86420))).resolves
    .toBeUndefined();
  await expect(encoder.close()).resolves.toBeUndefined();

  //Corrupt the file by reading and writing it as a UTF-8 string:
  await expect(
    Deno.writeTextFile(
      "./corrupted.flac",
      await Deno.readTextFile("./test.flac"),
    ),
  ).resolves.toBeUndefined();

  //The decoder should not be able to open this file:
  await expect(decoder.open("file:./corrupted.flac", 48000, 2)).rejects.toThrow(
    "Invalid data found when processing input",
  );

  //Attempt to double-open the valid file:
  await expect(decoder.open("file:./test.flac", 48000, 2)).resolves
    .toBeUndefined();
  await expect(decoder.open("file:test.flac", 48000, 2)).rejects.toThrow(
    BadResource,
  );

  //The read-only properties shouldn't have been changed by the previous bad call:
  expect(decoder.sampleRate).toStrictEqual(48000);
  expect(decoder.channels).toStrictEqual(2);

  //The decoder shouldn't allow multiple operations to happen in parallel. The runtime will crash if this doesn't hold because decoders aren't threadsafe.
  for (let i = 0; i < 1000; i++) {
    decoder.decode(32);
  }
  //This close() call will have to wait for the above to complete:
  await expect(decoder.close()).resolves.toBeUndefined();

  //The close() call should be idempotent:
  await expect(decoder.close()).resolves.toBeUndefined();

  //The read-only properties should be zeroed out:
  expect(decoder.sampleRate).toStrictEqual(0);
  expect(decoder.channels).toStrictEqual(0);

  //It shouldn't try to decode again:
  await expect(decoder.decode(32)).rejects.toThrow(BadResource);

  //It can't be opened again either:
  await expect(decoder.open("file:./test.flac", 48000, 2)).rejects.toThrow(
    BadResource,
  );

  //Clean up the test files:
  await expect(Deno.remove("./test.flac")).resolves.toBeUndefined();
  await expect(Deno.remove("./corrupted.flac")).resolves.toBeUndefined();
});
