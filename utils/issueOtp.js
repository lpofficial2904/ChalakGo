import { createHash, randomInt } from "node:crypto";

export async function issueOtp({ Model, account, details = {}, email, send }) {
  const otp = String(randomInt(100000, 1000000));
  const otpHash = createHash("sha256").update(otp).digest("hex");
  const now = Date.now();
  const fields = { ...details, otpHash, otpExpiresAt: new Date(now + 600_000), otpAttempts: 0 };
  const cooldown = () => Object.assign(new Error("Please wait 45 seconds before requesting another OTP."), { status: 429 });
  let saved;
  if (account) {
    // Reserve before sending: simultaneous requests must not overwrite the
    // code currently being delivered by another Node worker.
    saved = await Model.findOneAndUpdate({
      _id: account._id,
      $or: [
        { otpExpiresAt: { $exists: false } },
        { otpExpiresAt: null },
        { otpExpiresAt: { $lte: new Date(now + 600_000 - 45_000) } },
      ],
    }, { $set: fields }, { new: true, runValidators: true });
    if (!saved) throw cooldown();
  } else {
    try {
      saved = await Model.create({ email, ...fields });
    } catch (error) {
      if (error.code === 11000) throw cooldown();
      throw error;
    }
  }
  try {
    await send(email, otp);
  } catch (error) {
    // Do not leave an undelivered code active, or erase a newer resend.
    const filter = { _id: saved._id, otpHash };
    if (account) {
      await Model.updateOne(filter, { $unset: { otpHash: 1, otpExpiresAt: 1 }, $set: { otpAttempts: 0 } });
    } else {
      await Model.deleteOne(filter);
    }
    throw error;
  }
}
