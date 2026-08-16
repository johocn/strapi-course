const STORAGE_KEY = "ssoRedirectAttempts";
const STORAGE_TS = "ssoRedirectLastAt";
const MAX_SSO_ATTEMPTS = 3;
const SSO_REDIRECT_TIMEOUT = 3e3;
function isSsoRedirectBlocked() {
  const count = Number(uni.getStorageSync(STORAGE_KEY) || 0);
  return count >= MAX_SSO_ATTEMPTS;
}
function getSsoRedirectAttempts() {
  return Number(uni.getStorageSync(STORAGE_KEY) || 0);
}
function guardSsoRedirect() {
  const count = Number(uni.getStorageSync(STORAGE_KEY) || 0);
  if (count >= MAX_SSO_ATTEMPTS) {
    console.warn(`[sso-guard] SSO \u8DF3\u8F6C\u5DF2\u8FBE\u4E0A\u9650\uFF08${count}/${MAX_SSO_ATTEMPTS}\uFF09\uFF0C\u963B\u65AD\u5F3A\u5236\u8DF3\u8F6C`);
    return false;
  }
  const next = count + 1;
  uni.setStorageSync(STORAGE_KEY, String(next));
  uni.setStorageSync(STORAGE_TS, String(Date.now()));
  console.log(`[sso-guard] SSO \u8DF3\u8F6C\u8BA1\u6570 ${next}/${MAX_SSO_ATTEMPTS}\uFF0C\u542F\u52A8 3 \u79D2\u8D85\u65F6\u5B9A\u65F6\u5668`);
  setTimeout(() => {
    console.warn(`[sso-guard] SSO \u8DF3\u8F6C 3 \u79D2\u540E\u4ECD\u5728\u539F\u9875\u9762\uFF0C\u53EF\u80FD\u8DF3\u8F6C\u5931\u8D25\uFF08\u7B2C ${next} \u6B21\uFF09`);
  }, SSO_REDIRECT_TIMEOUT);
  return true;
}
function clearSsoRedirectAttempts() {
  uni.removeStorageSync(STORAGE_KEY);
  uni.removeStorageSync(STORAGE_TS);
}
export {
  MAX_SSO_ATTEMPTS,
  SSO_REDIRECT_TIMEOUT,
  clearSsoRedirectAttempts,
  getSsoRedirectAttempts,
  guardSsoRedirect,
  isSsoRedirectBlocked
};
