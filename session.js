/* Signed session tokens: the app issues "tok_<userId>"; with SEMACHAT_SECRET set the server hands out "tok_<userId>.<hmac>"
 * and rejects anything unsigned, so tokens can no longer be guessed from a user id. */
'use strict';
const crypto = require('crypto');
module.exports = secret => {
  const mac = t => crypto.createHmac('sha256', secret).update(t).digest('base64url').slice(0, 32);
  return {
    enabled: !!secret,
    sign: t => secret ? t + '.' + mac(t) : t,
    // returns the plain token, or '' when the signature is missing/wrong
    verify(t) {
      t = String(t || ''); if (!secret) return t;
      const i = t.lastIndexOf('.'); if (i < 0) return '';
      const base = t.slice(0, i), a = Buffer.from(t.slice(i + 1)), b = Buffer.from(mac(base));
      return a.length === b.length && crypto.timingSafeEqual(a, b) ? base : '';
    }
  };
};
