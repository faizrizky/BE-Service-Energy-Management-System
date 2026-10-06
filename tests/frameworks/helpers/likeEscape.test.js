const { escapeLike } = require("../../../src/frameworks/helpers/likeEscape");

describe("escapeLike", () => {
  test("[positive] % dan _ di-escape biar dicari sebagai karakter biasa", () => {
    expect(escapeLike("50%_off")).toBe("50\\%\\_off");
  });

  test("[positive] backslash ikut di-escape (biar nggak jadi escape palsu)", () => {
    expect(escapeLike("a\\b")).toBe("a\\\\b");
  });

  test("[positive] teks biasa & angka nggak berubah", () => {
    expect(escapeLike("Ruang Server 2")).toBe("Ruang Server 2");
    expect(escapeLike("15")).toBe("15");
  });

  test("[negative] bukan string (undefined/null) dibalikin apa adanya", () => {
    expect(escapeLike(undefined)).toBeUndefined();
    expect(escapeLike(null)).toBeNull();
  });
});
