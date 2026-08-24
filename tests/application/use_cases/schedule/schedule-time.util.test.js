const {
  timeToMinutes,
  invertAction,
  toDateOnly,
  toDateKey,
  addDays,
  isCrossMidnight,
  getOccupiedDates,
  getScheduleStartDate,
  isOccurringOnDate,
  occurrenceDatesOverlap,
  timeRangesOverlap,
  isStartDue,
  isEndDue,
} = require("../../../../src/application/use_cases/schedule/schedule-time.util");

describe("timeToMinutes", () => {
  test("konversi waktu normal ke menit", () => {
    expect(timeToMinutes("00:00")).toBe(0);
    expect(timeToMinutes("14:30")).toBe(870);
    expect(timeToMinutes("23:59")).toBe(1439);
  });

  test("[negative] format jam tanpa leading zero tetap ke-parse", () => {
    expect(timeToMinutes("9:05")).toBe(545);
  });
});

describe("invertAction", () => {
  test("on <-> off", () => {
    expect(invertAction("on")).toBe("off");
    expect(invertAction("off")).toBe("on");
  });

  test("[negative - tidak mungkin lewat API karena divalidasi controller] action selain on/off dianggap 'on'", () => {
    expect(invertAction("invalid")).toBe("on");
    expect(invertAction(undefined)).toBe("on");
    expect(invertAction(null)).toBe("on");
  });
});

describe("toDateOnly & toDateKey", () => {
  test("strip waktu, sisain tanggal aja (local midnight)", () => {
    const d = toDateOnly(new Date("2026-08-23T15:45:30.000Z"));
    expect(d.getHours()).toBe(0);
    expect(d.getMinutes()).toBe(0);
    expect(toDateKey(d)).toBe("2026-08-23");
  });

  test("toDateKey format YYYY-MM-DD", () => {
    expect(toDateKey(new Date("2026-08-23T15:45:30.000Z"))).toBe("2026-08-23");
  });

  test("[negative] input tanggal invalid menghasilkan Invalid Date, bukan throw", () => {
    const d = toDateOnly(new Date("bukan-tanggal"));
    expect(d.toString()).toBe("Invalid Date");
  });
});

describe("addDays", () => {
  test("nambah & ngurang hari, termasuk lintas bulan/tahun", () => {
    expect(toDateKey(addDays(new Date("2026-08-23"), 1))).toBe("2026-08-24");
    expect(toDateKey(addDays(new Date("2026-01-01"), -1))).toBe("2025-12-31");
    expect(toDateKey(addDays(new Date("2026-08-31"), 1))).toBe("2026-09-01");
  });

  test("addDays(x, 0) gak ngubah apa-apa", () => {
    expect(toDateKey(addDays(new Date("2026-08-23"), 0))).toBe("2026-08-23");
  });
});

describe("isCrossMidnight", () => {
  test("endTime > startTime -> bukan cross-midnight", () => {
    expect(isCrossMidnight({ startTime: "08:00", endTime: "17:00" })).toBe(
      false,
    );
  });

  test("endTime < startTime -> cross-midnight", () => {
    expect(isCrossMidnight({ startTime: "23:00", endTime: "01:00" })).toBe(
      true,
    );
  });

  test("[edge] endTime === startTime -> dianggap cross-midnight (24 jam penuh)", () => {
    // Dokumentasi behavior: <= dipakai, bukan <, jadi durasi 0 dianggap cross-midnight.
    // Kasus ini realistis kalau user gak sengaja isi start=end.
    expect(isCrossMidnight({ startTime: "10:00", endTime: "10:00" })).toBe(
      true,
    );
  });

  test("gak ada endTime -> bukan cross-midnight", () => {
    expect(isCrossMidnight({ startTime: "10:00", endTime: null })).toBe(false);
  });
});

describe("getOccupiedDates", () => {
  test("non cross-midnight -> cuma 1 tanggal", () => {
    const dates = getOccupiedDates({
      scheduledDate: "2026-08-23",
      startTime: "08:00",
      endTime: "17:00",
    });
    expect(dates.map(toDateKey)).toEqual(["2026-08-23"]);
  });

  test("cross-midnight -> 2 tanggal (hari ini + besok)", () => {
    const dates = getOccupiedDates({
      scheduledDate: "2026-08-23",
      startTime: "23:00",
      endTime: "01:00",
    });
    expect(dates.map(toDateKey)).toEqual(["2026-08-23", "2026-08-24"]);
  });
});

describe("isOccurringOnDate - repeatType: none", () => {
  const schedule = {
    repeatType: "none",
    scheduledDate: "2026-08-23",
    startTime: "10:00",
    endTime: "12:00",
  };

  test("match persis di tanggalnya", () => {
    expect(isOccurringOnDate(schedule, new Date("2026-08-23"))).toBe(true);
  });

  test("[negative] gak match di tanggal lain", () => {
    expect(isOccurringOnDate(schedule, new Date("2026-08-24"))).toBe(false);
    expect(isOccurringOnDate(schedule, new Date("2026-08-22"))).toBe(false);
  });

  test("cross-midnight -> match di 2 hari", () => {
    const cm = {
      repeatType: "none",
      scheduledDate: "2026-08-23",
      startTime: "23:00",
      endTime: "01:00",
    };
    expect(isOccurringOnDate(cm, new Date("2026-08-23"))).toBe(true);
    expect(isOccurringOnDate(cm, new Date("2026-08-24"))).toBe(true);
    expect(isOccurringOnDate(cm, new Date("2026-08-25"))).toBe(false);
  });
});

describe("isOccurringOnDate - repeatType: daily", () => {
  const schedule = {
    repeatType: "daily",
    scheduledDate: "2026-08-20",
    startTime: "10:00",
  };

  test("match tiap hari SETELAH/SAMA DENGAN scheduledDate", () => {
    expect(isOccurringOnDate(schedule, new Date("2026-08-20"))).toBe(true);
    expect(isOccurringOnDate(schedule, new Date("2026-08-25"))).toBe(true);
    expect(isOccurringOnDate(schedule, new Date("2027-01-01"))).toBe(true);
  });

  test("[negative] gak match SEBELUM scheduledDate mulai berlaku", () => {
    expect(isOccurringOnDate(schedule, new Date("2026-08-19"))).toBe(false);
  });
});

describe("isOccurringOnDate - repeatType: weekly", () => {
  // 2026-08-23 adalah hari Minggu (getUTCDay() === 0)
  const schedule = {
    repeatType: "weekly",
    scheduledDate: "2026-08-16",
    startTime: "10:00",
    repeatDays: [0, 3],
  };

  test("match kalau getUTCDay() ada di repeatDays", () => {
    expect(isOccurringOnDate(schedule, new Date("2026-08-23"))).toBe(true); // Minggu
    expect(isOccurringOnDate(schedule, new Date("2026-08-26"))).toBe(true); // Rabu
  });

  test("[negative] gak match kalau hari gak ada di repeatDays", () => {
    expect(isOccurringOnDate(schedule, new Date("2026-08-24"))).toBe(false); // Senin
  });

  test("[negative] gak match sebelum scheduledDate walau harinya cocok", () => {
    expect(isOccurringOnDate(schedule, new Date("2026-08-09"))).toBe(false); // Minggu, tapi sebelum start
  });

  test("[negative - tidak mungkin lewat API tapi bisa dari data korup] repeatDays null/undefined dianggap array kosong", () => {
    const broken = {
      repeatType: "weekly",
      scheduledDate: "2026-08-16",
      startTime: "10:00",
      repeatDays: null,
    };
    expect(isOccurringOnDate(broken, new Date("2026-08-23"))).toBe(false);
  });

  test("[negative] repeatDays bukan array (misal object dari JSON korup)", () => {
    const broken = {
      repeatType: "weekly",
      scheduledDate: "2026-08-16",
      startTime: "10:00",
      repeatDays: { 0: true },
    };
    expect(isOccurringOnDate(broken, new Date("2026-08-23"))).toBe(false);
  });
});

describe("isOccurringOnDate - [negative] repeatType tidak dikenal", () => {
  test("repeatType di luar none/daily/weekly selalu false (fail-safe)", () => {
    const broken = {
      repeatType: "monthly",
      scheduledDate: "2026-08-16",
      startTime: "10:00",
    };
    expect(isOccurringOnDate(broken, new Date("2026-08-23"))).toBe(false);

    const empty = {
      repeatType: "",
      scheduledDate: "2026-08-16",
      startTime: "10:00",
    };
    expect(isOccurringOnDate(empty, new Date("2026-08-23"))).toBe(false);
  });
});

describe("occurrenceDatesOverlap", () => {
  test("none vs none, tanggal sama -> overlap", () => {
    const a = {
      repeatType: "none",
      scheduledDate: "2026-08-23",
      startTime: "10:00",
    };
    const b = {
      repeatType: "none",
      scheduledDate: "2026-08-23",
      startTime: "14:00",
    };
    expect(occurrenceDatesOverlap(a, b)).toBe(true);
  });

  test("[negative] none vs none, tanggal beda -> gak overlap", () => {
    const a = {
      repeatType: "none",
      scheduledDate: "2026-08-23",
      startTime: "10:00",
    };
    const b = {
      repeatType: "none",
      scheduledDate: "2026-08-24",
      startTime: "10:00",
    };
    expect(occurrenceDatesOverlap(a, b)).toBe(false);
  });

  test("none vs daily -> overlap kalau tanggal none masuk window daily", () => {
    const a = {
      repeatType: "none",
      scheduledDate: "2026-08-25",
      startTime: "10:00",
    };
    const b = {
      repeatType: "daily",
      scheduledDate: "2026-08-20",
      startTime: "10:00",
    };
    expect(occurrenceDatesOverlap(a, b)).toBe(true);
  });

  test("[negative] none vs daily -> gak overlap kalau tanggal none SEBELUM daily mulai", () => {
    const a = {
      repeatType: "none",
      scheduledDate: "2026-08-10",
      startTime: "10:00",
    };
    const b = {
      repeatType: "daily",
      scheduledDate: "2026-08-20",
      startTime: "10:00",
    };
    expect(occurrenceDatesOverlap(a, b)).toBe(false);
  });

  test("weekly vs weekly, ada hari yang sama -> overlap", () => {
    const a = {
      repeatType: "weekly",
      scheduledDate: "2026-08-01",
      startTime: "10:00",
      repeatDays: [1, 3],
    };
    const b = {
      repeatType: "weekly",
      scheduledDate: "2026-08-01",
      startTime: "14:00",
      repeatDays: [3, 5],
    };
    expect(occurrenceDatesOverlap(a, b)).toBe(true); // sama-sama Rabu (3)
  });

  test("[negative] weekly vs weekly, gak ada hari yang sama -> gak overlap", () => {
    const a = {
      repeatType: "weekly",
      scheduledDate: "2026-08-01",
      startTime: "10:00",
      repeatDays: [1],
    };
    const b = {
      repeatType: "weekly",
      scheduledDate: "2026-08-01",
      startTime: "10:00",
      repeatDays: [2],
    };
    expect(occurrenceDatesOverlap(a, b)).toBe(false);
  });

  test("daily vs daily -> selalu overlap (cepat atau lambat ketemu)", () => {
    const a = {
      repeatType: "daily",
      scheduledDate: "2026-08-01",
      startTime: "10:00",
    };
    const b = {
      repeatType: "daily",
      scheduledDate: "2026-08-15",
      startTime: "14:00",
    };
    expect(occurrenceDatesOverlap(a, b)).toBe(true);
  });
});

describe("timeRangesOverlap", () => {
  test("overlap biasa", () => {
    expect(timeRangesOverlap("10:00", "12:00", "11:00", "13:00")).toBe(true);
  });

  test("[negative] gak overlap sama sekali", () => {
    expect(timeRangesOverlap("08:00", "09:00", "10:00", "11:00")).toBe(false);
  });

  test("[edge] bersinggungan persis di batas -> dianggap overlap", () => {
    expect(timeRangesOverlap("10:00", "11:00", "11:00", "12:00")).toBe(true);
  });

  test("cross-midnight vs range biasa", () => {
    expect(timeRangesOverlap("23:00", "01:00", "00:30", "02:00")).toBe(true);
  });

  test("[negative] cross-midnight tapi beneran gak overlap", () => {
    expect(timeRangesOverlap("23:00", "23:30", "01:00", "02:00")).toBe(false);
  });

  test("point-in-time (gak ada endTime) dianggap sesaat", () => {
    expect(timeRangesOverlap("10:00", null, "09:00", "11:00")).toBe(true);
    expect(timeRangesOverlap("10:00", null, "10:01", "11:00")).toBe(false);
  });
});

describe("isStartDue", () => {
  test("match waktu + tanggal", () => {
    const schedule = {
      repeatType: "none",
      scheduledDate: "2026-08-23",
      startTime: "10:00",
    };
    expect(isStartDue(schedule, new Date("2026-08-23T10:00:00"))).toBe(true);
  });

  test("[negative] waktu cocok tapi tanggal salah", () => {
    const schedule = {
      repeatType: "none",
      scheduledDate: "2026-08-23",
      startTime: "10:00",
    };
    expect(isStartDue(schedule, new Date("2026-08-24T10:00:00"))).toBe(false);
  });

  test("[negative] tanggal cocok tapi waktu salah", () => {
    const schedule = {
      repeatType: "none",
      scheduledDate: "2026-08-23",
      startTime: "10:00",
    };
    expect(isStartDue(schedule, new Date("2026-08-23T10:01:00"))).toBe(false);
  });
});

describe("isEndDue", () => {
  test("[negative] gak ada endTime -> selalu false", () => {
    const schedule = {
      repeatType: "none",
      scheduledDate: "2026-08-23",
      startTime: "10:00",
      endTime: null,
    };
    expect(isEndDue(schedule, new Date("2026-08-23T10:00:00"))).toBe(false);
  });

  test("non cross-midnight, match hari yang sama", () => {
    const schedule = {
      repeatType: "none",
      scheduledDate: "2026-08-23",
      startTime: "10:00",
      endTime: "12:00",
    };
    expect(isEndDue(schedule, new Date("2026-08-23T12:00:00"))).toBe(true);
  });

  test("cross-midnight, endTime jatuh di HARI BERIKUTNYA", () => {
    const schedule = {
      repeatType: "none",
      scheduledDate: "2026-08-23",
      startTime: "23:00",
      endTime: "01:00",
    };
    expect(isEndDue(schedule, new Date("2026-08-24T01:00:00"))).toBe(true);
  });

  test("[negative] cross-midnight, endTime dicek di hari yang SALAH", () => {
    const schedule = {
      repeatType: "none",
      scheduledDate: "2026-08-23",
      startTime: "23:00",
      endTime: "01:00",
    };

    expect(isEndDue(schedule, new Date("2026-08-23T01:00:00"))).toBe(false);
  });

  test("[dokumentasi limitation] cross-midnight, catch-up telat >1 hari tetap dianggap due", () => {
    const schedule = {
      repeatType: "none",
      scheduledDate: "2026-08-23",
      startTime: "23:00",
      endTime: "01:00",
    };
    expect(isEndDue(schedule, new Date("2026-08-25T01:00:00"))).toBe(true);
  });
});
