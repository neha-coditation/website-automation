import assert from "node:assert/strict";
import test from "node:test";
import { randomBytes } from "node:crypto";
import { decryptSecret, encryptSecret } from "../crypto";

test("encrypts and decrypts social tokens without storing plaintext", () => {
  process.env.SOCIAL_TOKEN_ENCRYPTION_KEY = randomBytes(32).toString("base64");
  const token = "linkedin-access-token-example";
  const encrypted = encryptSecret(token);
  assert.notEqual(encrypted, token);
  assert.equal(decryptSecret(encrypted), token);
});

test("rejects tampered encrypted credentials", () => {
  process.env.SOCIAL_TOKEN_ENCRYPTION_KEY = randomBytes(32).toString("base64");
  const encrypted = encryptSecret("secret");
  const parts = encrypted.split(".");
  parts[2] = Buffer.from("tampered").toString("base64url");
  assert.throws(() => decryptSecret(parts.join(".")));
});

test("rejects invalid encryption key configuration", () => {
  process.env.SOCIAL_TOKEN_ENCRYPTION_KEY = Buffer.from("short").toString("base64");
  assert.throws(() => encryptSecret("secret"), /32-byte key/);
});
